import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, of, timeout } from 'rxjs';

import { Task, TaskService } from '../../shared/services/task.service';
import {
  DailyTodo,
  ProductivityPriority,
  ProductivityService,
  TimeSession,
  TimedItemType,
} from '../../shared/services/productivity.service';

type PomodoroMode = 'focus' | 'short' | 'long';

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

  newTodo = {
    title: '',
    notes: '',
    priority: 'Medium' as ProductivityPriority,
  };

  pomodoroMode: PomodoroMode = 'focus';
  pomodoroMinutes = 25;
  pomodoroRemainingSeconds = 25 * 60;
  pomodoroRunning = false;
  pomodoroEndAt: number | null = null;
  completedFocusSessions = 0;

  private clockInterval?: number;
  private readonly hashHandler = () => this.scrollToRequestedSection();

  constructor(
    private taskService: TaskService,
    private productivityService: ProductivityService,
  ) {}

  ngOnInit(): void {
    this.restorePomodoro();
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

  get activeTasks(): Task[] {
    return this.tasks.filter((task) => !task.completed);
  }

  get completedTodos(): number {
    return this.todos.filter((todo) => todo.completed).length;
  }

  get totalTrackedTodaySeconds(): number {
    const base = this.tasks.reduce((sum, task) => sum + (task.time_spent_seconds || 0), 0)
      + this.todos.reduce((sum, todo) => sum + (todo.time_spent_seconds || 0), 0);
    return base + this.currentActiveElapsedSeconds;
  }

  get currentActiveElapsedSeconds(): number {
    if (!this.activeTimer) return 0;
    return Math.max(0, Math.floor((this.now - new Date(this.activeTimer.started_at).getTime()) / 1000));
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
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ tasks, todos, timer }) => {
          this.tasks = tasks;
          this.todos = todos;
          this.activeTimer = timer;
          if (failedParts.length) {
            this.showError(`Focus opened, but ${failedParts.join(', ')} could not be loaded. Check that the backend is running and try again.`);
          }
          window.setTimeout(() => this.scrollToRequestedSection(), 0);
        },
        error: (error) => {
          this.showError(error?.message || 'Focus could not load. Check that the backend is running and try again.');
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
        this.newTodo = { title: '', notes: '', priority: 'Medium' };
        this.showSuccess('Added to today.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  toggleTodo(todo: DailyTodo): void {
    this.productivityService.updateTodo(todo.id, { completed: !todo.completed }).subscribe({
      next: (updated) => {
        this.todos = this.todos.map((item) => item.id === updated.id ? updated : item);
        this.showSuccess(updated.completed ? 'Todo completed.' : 'Todo reopened.');
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
        this.loadTasksOnly();
        this.showSuccess('Timer started.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  stopTimer(): void {
    if (!this.activeTimer) return;
    this.productivityService.stopTimer().subscribe({
      next: (session) => {
        this.activeTimer = null;
        this.loadWorkspace();
        this.showSuccess(`Saved ${this.formatDuration(session.elapsed_seconds)}.`);
      },
      error: (error) => this.showError(error.message),
    });
  }

  isTimingTask(task: Task): boolean {
    return !!task.id && this.activeTimer?.item_type === 'task' && this.activeTimer.task_id === task.id;
  }

  isTimingTodo(todo: DailyTodo): boolean {
    return this.activeTimer?.item_type === 'todo' && this.activeTimer.todo_id === todo.id;
  }

  taskElapsed(task: Task): number {
    return (task.time_spent_seconds || 0) + (this.isTimingTask(task) ? this.currentActiveElapsedSeconds : 0);
  }

  todoElapsed(todo: DailyTodo): number {
    return (todo.time_spent_seconds || 0) + (this.isTimingTodo(todo) ? this.currentActiveElapsedSeconds : 0);
  }

  setPomodoroMode(mode: PomodoroMode): void {
    this.pomodoroMode = mode;
    this.pomodoroMinutes = mode === 'focus' ? 25 : mode === 'short' ? 5 : 15;
    this.pomodoroRemainingSeconds = this.pomodoroMinutes * 60;
    this.pomodoroRunning = false;
    this.pomodoroEndAt = null;
    this.savePomodoro();
  }

  applyCustomPomodoro(): void {
    const minutes = Math.max(1, Math.min(Number(this.pomodoroMinutes) || 25, 180));
    this.pomodoroMinutes = minutes;
    this.pomodoroRemainingSeconds = minutes * 60;
    this.pomodoroRunning = false;
    this.pomodoroEndAt = null;
    this.savePomodoro();
  }

  togglePomodoro(): void {
    if (this.pomodoroRunning) {
      this.pomodoroRunning = false;
      this.pomodoroEndAt = null;
    } else {
      if (this.pomodoroRemainingSeconds <= 0) {
        this.pomodoroRemainingSeconds = this.pomodoroMinutes * 60;
      }
      this.pomodoroRunning = true;
      this.pomodoroEndAt = Date.now() + this.pomodoroRemainingSeconds * 1000;
    }
    this.savePomodoro();
  }

  resetPomodoro(): void {
    this.pomodoroRunning = false;
    this.pomodoroEndAt = null;
    this.pomodoroRemainingSeconds = this.pomodoroMinutes * 60;
    this.savePomodoro();
  }

  pomodoroDisplay(): string {
    const minutes = Math.floor(this.pomodoroRemainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.pomodoroRemainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  }

  trackById(_: number, item: { id?: number }): number | undefined {
    return item.id;
  }

  private tick(): void {
    this.now = Date.now();
    if (!this.pomodoroRunning || !this.pomodoroEndAt) return;
    const remaining = Math.max(0, Math.ceil((this.pomodoroEndAt - this.now) / 1000));
    this.pomodoroRemainingSeconds = remaining;
    if (remaining === 0) {
      this.pomodoroRunning = false;
      this.pomodoroEndAt = null;
      if (this.pomodoroMode === 'focus') this.completedFocusSessions += 1;
      this.showSuccess(this.pomodoroMode === 'focus' ? 'Focus session complete.' : 'Break complete.');
    }
    this.savePomodoro();
  }

  private loadTasksOnly(): void {
    this.taskService.getTasks().subscribe({
      next: (tasks) => (this.tasks = tasks),
    });
  }

  private scrollToRequestedSection(): void {
    const target = window.location.hash.replace('#', '');
    if (!['todos', 'pomodoro', 'task-timers'].includes(target)) return;
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

  private savePomodoro(): void {
    localStorage.setItem('focus_pomodoro', JSON.stringify({
      mode: this.pomodoroMode,
      minutes: this.pomodoroMinutes,
      remaining: this.pomodoroRemainingSeconds,
      running: this.pomodoroRunning,
      endAt: this.pomodoroEndAt,
      completed: this.completedFocusSessions,
    }));
  }

  private restorePomodoro(): void {
    try {
      const raw = localStorage.getItem('focus_pomodoro');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (['focus', 'short', 'long'].includes(state.mode)) this.pomodoroMode = state.mode;
      this.pomodoroMinutes = Math.max(1, Number(state.minutes) || 25);
      this.pomodoroRemainingSeconds = Math.max(0, Number(state.remaining) || this.pomodoroMinutes * 60);
      this.pomodoroRunning = Boolean(state.running);
      this.pomodoroEndAt = state.endAt ? Number(state.endAt) : null;
      this.completedFocusSessions = Math.max(0, Number(state.completed) || 0);
      if (this.pomodoroRunning && this.pomodoroEndAt) {
        this.pomodoroRemainingSeconds = Math.max(0, Math.ceil((this.pomodoroEndAt - Date.now()) / 1000));
        if (this.pomodoroRemainingSeconds === 0) {
          this.pomodoroRunning = false;
          this.pomodoroEndAt = null;
        }
      }
    } catch {
      localStorage.removeItem('focus_pomodoro');
    }
  }

  private showError(message: string): void {
    this.errorMessage = message || 'Something went wrong.';
    window.setTimeout(() => (this.errorMessage = ''), 5000);
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    window.setTimeout(() => (this.successMessage = ''), 3000);
  }
}
