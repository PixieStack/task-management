import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, of, switchMap, timeout } from 'rxjs';

import { Task, TaskService } from '../../shared/services/task.service';
import {
  DailyTodo,
  ProductivityPriority,
  ProductivityService,
  TimeSession,
  TimedItemType,
  apiTimestampMilliseconds,
} from '../../shared/services/productivity.service';

type TodoFilter = 'active' | 'completed' | 'archived';

@Component({
  selector: 'app-focus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './focus.component.html',
  styleUrls: ['./focus.component.scss'],
})
export class FocusComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  todos: DailyTodo[] = [];
  activeTimer: TimeSession | null = null;
  now = Date.now();
  loading = true;
  errorMessage = '';
  successMessage = '';
  todoFilter: TodoFilter = 'active';
  todoSearch = '';
  todoPriorityFilter: 'all' | ProductivityPriority = 'all';

  newTodo = {
    title: '',
    notes: '',
    priority: 'Medium' as ProductivityPriority,
  };

  private clockInterval?: number;
  private readonly hashHandler = () => this.scrollToRequestedSection();

  constructor(
    private changeDetector: ChangeDetectorRef,
    private taskService: TaskService,
    private productivityService: ProductivityService,
  ) {}

  ngOnInit(): void {
    window.addEventListener('hashchange', this.hashHandler);
    this.loadWorkspace();
    this.clockInterval = window.setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) window.clearInterval(this.clockInterval);
    window.removeEventListener('hashchange', this.hashHandler);
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  }

  get completedTodos(): number {
    return this.todos.filter((todo) => todo.completed && !todo.archived_at).length;
  }

  get totalTrackedTodaySeconds(): number {
    const base = this.tasks.reduce((sum, task) => sum + (task.time_spent_seconds || 0), 0)
      + this.todos.reduce((sum, todo) => sum + (todo.time_spent_seconds || 0), 0);
    return base + this.currentActiveElapsedSeconds;
  }

  get currentActiveElapsedSeconds(): number {
    if (!this.activeTimer) return 0;
    return Math.max(0, Math.floor((this.now - apiTimestampMilliseconds(this.activeTimer.started_at)) / 1000));
  }

  get activeTodos(): number {
    return this.todos.filter((todo) => !todo.completed && !todo.archived_at).length;
  }

  get filteredTodos(): DailyTodo[] {
    const search = this.todoSearch.trim().toLowerCase();
    return this.todos.filter((todo) => {
      const matchesView = this.todoFilter === 'archived' ? Boolean(todo.archived_at)
        : !todo.archived_at && (this.todoFilter === 'completed' ? todo.completed : !todo.completed);
      return matchesView
        && (this.todoPriorityFilter === 'all' || todo.priority === this.todoPriorityFilter)
        && (!search || `${todo.title} ${todo.notes || ''}`.toLowerCase().includes(search));
    });
  }

  get archivedTodos(): number { return this.todos.filter((todo) => todo.archived_at).length; }
  get visibleTodoTotal(): number { return this.todos.filter((todo) => !todo.archived_at).length; }

  get activeItemElapsedSeconds(): number {
    if (!this.activeTimer) return 0;
    if (this.activeTimer.item_type === 'task') {
      const task = this.tasks.find((item) => item.id === this.activeTimer?.task_id);
      return (task?.time_spent_seconds || (task?.time_spent || 0) * 60) + this.currentActiveElapsedSeconds;
    }
    const todo = this.todos.find((item) => item.id === this.activeTimer?.todo_id);
    return (todo?.time_spent_seconds || 0) + this.currentActiveElapsedSeconds;
  }

  get activeTimerLabel(): string {
    if (!this.activeTimer) return '';
    if (this.activeTimer.item_type === 'task') {
      return this.tasks.find((task) => task.id === this.activeTimer?.task_id)?.title || 'Task';
    }
    return this.todos.find((todo) => todo.id === this.activeTimer?.todo_id)?.title || 'Daily todo';
  }

  loadWorkspace(): void {
    this.loading = true;
    const failedParts: string[] = [];

    forkJoin({
      tasks: this.taskService.getTasks().pipe(
        timeout(12000),
        catchError(() => {
          failedParts.push('tasks');
          return of([] as Task[]);
        }),
      ),
      todos: this.productivityService.getTodos(this.localDateString()).pipe(
        timeout(12000),
        catchError(() => {
          failedParts.push('todos');
          return of([] as DailyTodo[]);
        }),
      ),
      timer: this.productivityService.getActiveTimer().pipe(
        timeout(12000),
        catchError(() => {
          failedParts.push('active timer');
          return of(null as TimeSession | null);
        }),
      ),
    })
      .pipe(finalize(() => {
        this.loading = false;
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: ({ tasks, todos, timer }) => {
          this.tasks = tasks;
          this.todos = todos;
          this.activeTimer = timer;
          if (failedParts.length) {
            this.showError(`Todo opened, but ${failedParts.join(', ')} could not be loaded. Check that the backend is running and try again.`);
          }
          window.setTimeout(() => this.scrollToRequestedSection(), 0);
        },
        error: (error) => {
          this.showError(error?.message || 'Todo could not load. Check that the backend is running and try again.');
        },
      });
  }

  createTodo(): void {
    const title = this.newTodo.title.trim();
    if (!title) {
      this.showError('Todo title is required.');
      return;
    }

    this.productivityService.createTodo({
      title,
      notes: this.newTodo.notes.trim(),
      priority: this.newTodo.priority,
      todo_date: this.localDateString(),
    }).subscribe({
      next: (todo) => {
        this.todos = [todo, ...this.todos];
        this.todoFilter = 'active';
        this.newTodo = { title: '', notes: '', priority: 'Medium' };
        this.showSuccess('Added to today.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  toggleTodo(todo: DailyTodo): void {
    const completed = !todo.completed;
    const update$ = completed && this.isTimingTodo(todo)
      ? this.productivityService.stopTimer().pipe(
          switchMap(() => this.productivityService.updateTodo(todo.id, { completed })),
        )
      : this.productivityService.updateTodo(todo.id, { completed });
    update$.subscribe({
      next: (updated) => {
        if (completed) this.activeTimer = null;
        this.todos = this.todos.map((item) => item.id === updated.id ? updated : item);
        this.showSuccess(updated.completed ? 'Todo completed and tracked time saved.' : 'Todo reopened.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  deleteTodo(todo: DailyTodo): void {
    if (!window.confirm(`Delete "${todo.title}"?`)) return;
    this.productivityService.deleteTodo(todo.id).subscribe({
      next: () => {
        this.todos = this.todos.filter((item) => item.id !== todo.id);
        this.showSuccess('Todo deleted.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  startTimer(itemType: TimedItemType, itemId: number): void {
    if (this.activeTimer) {
      this.showError(`A timer is already running for ${this.activeTimerLabel}. Stop it first.`);
      return;
    }
    this.productivityService.startTimer(itemType, itemId).subscribe({
      next: (session) => {
        this.activeTimer = session;
        this.now = Date.now();
        this.showSuccess('Timer started.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  pauseTimer(): void {
    if (!this.activeTimer) return;
    this.productivityService.stopTimer().subscribe({
      next: (session) => {
        this.activeTimer = null;
        this.loadWorkspace();
        this.showSuccess(`Paused and saved ${this.formatDuration(session.elapsed_seconds)}. Resume from the list when ready.`);
      },
      error: (error) => this.showError(error.message),
    });
  }

  isTimingTodo(todo: DailyTodo): boolean {
    return this.activeTimer?.item_type === 'todo' && this.activeTimer.todo_id === todo.id;
  }

  todoElapsed(todo: DailyTodo): number {
    return (todo.time_spent_seconds || 0) + (this.isTimingTodo(todo) ? this.currentActiveElapsedSeconds : 0);
  }

  formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  }

  formatRunningDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }

  trackById(_: number, item: { id?: number }): number | undefined {
    return item.id;
  }

  private tick(): void {
    this.now = Date.now();
    this.changeDetector.markForCheck();
  }

  private scrollToRequestedSection(): void {
    const requested = window.location.hash.replace('#', '');
    const target = requested === 'pomodoro' ? 'timer' : requested;
    if (!['todos', 'timer'].includes(target)) return;
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  private localDateString(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private showError(message: string): void {
    this.errorMessage = message || 'Something went wrong.';
    this.changeDetector.markForCheck();
    window.setTimeout(() => {
      this.errorMessage = '';
      this.changeDetector.markForCheck();
    }, 5000);
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.changeDetector.markForCheck();
    window.setTimeout(() => {
      this.successMessage = '';
      this.changeDetector.markForCheck();
    }, 3000);
  }
}
