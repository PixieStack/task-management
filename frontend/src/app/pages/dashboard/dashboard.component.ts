import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AIConversation, AIService } from '../../shared/services/ai.service';
import {
  Challenge,
  ChallengeCreate,
  ChallengeService,
  ChallengeType,
} from '../../shared/services/challenge.service';
import {
  Habit,
  HabitEntry,
  HabitService,
} from '../../shared/services/habit.service';
import {
  ProductivityService,
  TimeSession,
} from '../../shared/services/productivity.service';
import {
  Task,
  TaskCreate,
  TaskService,
} from '../../shared/services/task.service';

type DashboardSection = 'overview' | 'tasks' | 'habits' | 'challenges' | 'ai';
type TaskFilter = 'all' | 'active' | 'completed' | 'overdue';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  activeSection: DashboardSection = 'overview';
  taskFilter: TaskFilter = 'all';

  tasks: Task[] = [];
  habits: Habit[] = [];
  habitEntries: HabitEntry[] = [];
  challenges: Challenge[] = [];
  conversations: AIConversation[] = [];
  activeTimer: TimeSession | null = null;

  loading = {
    tasks: false,
    habits: false,
    challenges: false,
    ai: false,
  };

  errorMessage = '';
  successMessage = '';

  newTask = {
    title: '',
    description: '',
    priority: 'Medium' as Task['priority'],
    due_date: '',
    tags: '',
    time_estimate: 30,
  };

  newHabit = {
    name: '',
    description: '',
    target_count: 1,
  };

  newChallenge = {
    challenge_type: 'meditation' as ChallengeType,
    title: '',
    duration: 21,
    dailyGoal: '10 minutes',
  };

  aiQuestion = '';
  aiSuggestedPrompts = [
    'Create a high-priority task to finish my report tomorrow.',
    'Add Review lecture notes to today\'s todos.',
    'Start a timer for my highest-priority active task.',
    'What should I focus on today?',
  ];

  private readonly hashHandler = () => this.syncSectionFromHash();

  constructor(
    private taskService: TaskService,
    private habitService: HabitService,
    private challengeService: ChallengeService,
    private aiService: AIService,
    private productivityService: ProductivityService,
  ) {}

  ngOnInit(): void {
    this.syncSectionFromHash();
    window.addEventListener('hashchange', this.hashHandler);
    this.loadTasks();
    this.loadHabits();
    this.loadChallenges();
    this.loadAIHistory();
    this.loadActiveTimer();
  }

  ngOnDestroy(): void {
    window.removeEventListener('hashchange', this.hashHandler);
  }

  setSection(section: DashboardSection): void {
    this.activeSection = section;
    if (section === 'overview') {
      window.history.replaceState(null, '', window.location.pathname);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else if (window.location.hash !== `#${section}`) {
      window.location.hash = section;
    }
  }

  get totalTasks(): number {
    return this.tasks.length;
  }

  get completedTasks(): number {
    return this.tasks.filter((task) => task.completed).length;
  }

  get activeTasks(): number {
    return this.tasks.filter((task) => !task.completed).length;
  }

  get overdueTasks(): number {
    const now = new Date();
    return this.tasks.filter((task) => {
      if (!task.due_date || task.completed) return false;
      return new Date(task.due_date).getTime() < now.getTime();
    }).length;
  }

  get completedHabitsToday(): number {
    return this.habits.filter((habit) => this.isHabitDoneToday(habit)).length;
  }

  get activeChallenges(): number {
    return this.challenges.filter((challenge) => !challenge.completed && challenge.is_active).length;
  }

  get filteredTasks(): Task[] {
    switch (this.taskFilter) {
      case 'active':
        return this.tasks.filter((task) => !task.completed);
      case 'completed':
        return this.tasks.filter((task) => task.completed);
      case 'overdue':
        return this.tasks.filter((task) => this.isOverdue(task));
      default:
        return this.tasks;
    }
  }

  loadTasks(): void {
    this.loading.tasks = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.loading.tasks = false;
      },
      error: (error) => {
        this.loading.tasks = false;
        this.showError(error.message);
      },
    });
  }

  createTask(): void {
    const title = this.newTask.title.trim();
    if (!title) {
      this.showError('Task title is required.');
      return;
    }

    const payload: TaskCreate = {
      title,
      description: this.newTask.description.trim(),
      completed: false,
      status: 'Not Started',
      priority: this.newTask.priority,
      due_date: this.newTask.due_date || undefined,
      tags: this.newTask.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      time_estimate: Number(this.newTask.time_estimate) || 0,
      time_spent: 0,
      time_spent_seconds: 0,
    };

    this.taskService.createTask(payload).subscribe({
      next: (task) => {
        this.tasks = [task, ...this.tasks];
        this.newTask = {
          title: '',
          description: '',
          priority: 'Medium',
          due_date: '',
          tags: '',
          time_estimate: 30,
        };
        this.showSuccess('Task created.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  toggleTask(task: Task): void {
    if (!task.id) return;
    const previousCompleted = task.completed;
    const previousStatus = task.status;
    const completed = !task.completed;
    task.completed = completed;
    task.status = completed ? 'Completed' : 'Not Started';

    this.taskService
      .updateTask(task.id, { completed: task.completed, status: task.status })
      .subscribe({
        next: (updated) => this.replaceTask(updated),
        error: (error) => {
          task.completed = previousCompleted;
          task.status = previousStatus;
          this.showError(error.message);
        },
      });
  }

  updateTaskStatus(task: Task, status: Task['status']): void {
    if (!task.id) return;
    this.taskService
      .updateTask(task.id, {
        status,
        completed: status === 'Completed',
      })
      .subscribe({
        next: (updated) => this.replaceTask(updated),
        error: (error) => {
          this.showError(error.message);
          this.loadTasks();
        },
      });
  }

  deleteTask(task: Task): void {
    if (!task.id || !window.confirm(`Delete "${task.title}"?`)) return;
    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter((item) => item.id !== task.id);
        if (this.activeTimer?.task_id === task.id) this.activeTimer = null;
        this.showSuccess('Task deleted.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  toggleTimer(task: Task): void {
    if (!task.id || task.completed) return;
    if (this.isTimerRunning(task)) {
      this.productivityService.stopTimer().subscribe({
        next: (session) => {
          this.activeTimer = null;
          this.loadTasks();
          this.showSuccess(`Saved ${this.formatDuration(session.elapsed_seconds)} to ${task.title}.`);
        },
        error: (error) => this.showError(error.message),
      });
      return;
    }
    if (this.activeTimer) {
      this.showError('Another timer is already running. Stop it first or open Focus & Timers.');
      return;
    }
    this.productivityService.startTimer('task', task.id).subscribe({
      next: (session) => {
        this.activeTimer = session;
        this.loadTasks();
        this.showSuccess(`Timer started for ${task.title}.`);
      },
      error: (error) => this.showError(error.message),
    });
  }

  isTimerRunning(task: Task): boolean {
    return !!task.id && this.activeTimer?.item_type === 'task' && this.activeTimer.task_id === task.id;
  }

  formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return hours > 0
      ? `${hours}h ${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
      : `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  }

  isOverdue(task: Task): boolean {
    return !!(
      task.due_date &&
      !task.completed &&
      new Date(task.due_date).getTime() < Date.now()
    );
  }

  loadHabits(): void {
    this.loading.habits = true;
    this.habitService.getHabits().subscribe({
      next: (habits) => {
        this.habits = habits;
        this.loading.habits = false;
        this.loadHabitEntries();
      },
      error: (error) => {
        this.loading.habits = false;
        this.showError(error.message);
      },
    });
  }

  loadHabitEntries(): void {
    this.habitService.getHabitEntries(undefined, 30).subscribe({
      next: (entries) => (this.habitEntries = entries),
      error: (error) => this.showError(error.message),
    });
  }

  createHabit(): void {
    const name = this.newHabit.name.trim();
    if (!name) {
      this.showError('Habit name is required.');
      return;
    }

    this.habitService
      .createHabit({
        name,
        description: this.newHabit.description.trim(),
        frequency: 'daily',
        target_count: Number(this.newHabit.target_count) || 1,
        category: 'personal',
        icon: 'fas fa-check-circle',
      })
      .subscribe({
        next: (habit) => {
          this.habits = [habit, ...this.habits];
          this.newHabit = { name: '', description: '', target_count: 1 };
          this.showSuccess('Habit created.');
        },
        error: (error) => this.showError(error.message),
      });
  }

  toggleHabit(habit: Habit): void {
    if (!habit.id) return;
    this.habitService.toggleCheckIn(habit.id).subscribe({
      next: () => {
        this.loadHabitEntries();
        this.showSuccess('Habit check-in updated.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  deleteHabit(habit: Habit): void {
    if (!habit.id || !window.confirm(`Delete habit "${habit.name}"?`)) return;
    this.habitService.deleteHabit(habit.id).subscribe({
      next: () => {
        this.habits = this.habits.filter((item) => item.id !== habit.id);
        this.habitEntries = this.habitEntries.filter(
          (entry) => entry.habit_id !== habit.id,
        );
        this.showSuccess('Habit deleted.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  isHabitDoneToday(habit: Habit): boolean {
    if (!habit.id) return false;
    const today = new Date().toDateString();
    return this.habitEntries.some(
      (entry) =>
        entry.habit_id === habit.id &&
        entry.completed &&
        new Date(entry.date).toDateString() === today,
    );
  }

  habitStreak(habit: Habit): number {
    if (!habit.id) return 0;
    const completedDates = new Set(
      this.habitEntries
        .filter((entry) => entry.habit_id === habit.id && entry.completed)
        .map((entry) => new Date(entry.date).toDateString()),
    );

    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 30; i++) {
      if (completedDates.has(cursor.toDateString())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  loadChallenges(): void {
    this.loading.challenges = true;
    this.challengeService.getChallenges().subscribe({
      next: (challenges) => {
        this.challenges = challenges;
        this.loading.challenges = false;
      },
      error: (error) => {
        this.loading.challenges = false;
        this.showError(error.message);
      },
    });
  }

  onChallengeTypeChange(): void {
    if (this.newChallenge.challenge_type === 'meditation') {
      this.newChallenge.dailyGoal = '10 minutes';
      this.newChallenge.title = '';
      this.newChallenge.duration = 21;
    } else {
      this.newChallenge.dailyGoal = '20 pages';
      this.newChallenge.title = '';
      this.newChallenge.duration = 30;
    }
  }

  createChallenge(): void {
    const type = this.newChallenge.challenge_type;
    const title =
      this.newChallenge.title.trim() ||
      (type === 'meditation' ? 'Meditation Challenge' : 'Reading Challenge');

    const payload: ChallengeCreate = {
      title,
      description: `Daily goal: ${this.newChallenge.dailyGoal.trim() || 'show up and make progress'}`,
      duration: Number(this.newChallenge.duration) || 21,
      challenge_type: type,
      icon: type === 'meditation' ? 'fas fa-spa' : 'fas fa-book-open',
    };

    this.challengeService.createChallenge(payload).subscribe({
      next: (challenge) => {
        this.challenges = [challenge, ...this.challenges];
        this.onChallengeTypeChange();
        this.showSuccess('Challenge started.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  checkInChallenge(challenge: Challenge): void {
    this.challengeService.checkIn(challenge.id).subscribe({
      next: (updated) => {
        this.challenges = this.challenges.map((item) =>
          item.id === updated.id ? updated : item,
        );
        this.showSuccess(
          updated.completed ? 'Challenge completed!' : 'Challenge check-in saved.',
        );
      },
      error: (error) => this.showError(error.message),
    });
  }

  deleteChallenge(challenge: Challenge): void {
    if (!window.confirm(`Delete "${challenge.title}"?`)) return;
    this.challengeService.deleteChallenge(challenge.id).subscribe({
      next: () => {
        this.challenges = this.challenges.filter(
          (item) => item.id !== challenge.id,
        );
        this.showSuccess('Challenge deleted.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  checkedInToday(challenge: Challenge): boolean {
    if (!challenge.last_check_in) return false;
    return (
      new Date(challenge.last_check_in).toDateString() === new Date().toDateString()
    );
  }

  loadAIHistory(): void {
    this.aiService.getConversations(20).subscribe({
      next: (conversations) => (this.conversations = conversations),
      error: () => {
        // History is optional; asking the assistant will show any configuration error.
      },
    });
  }

  loadActiveTimer(): void {
    this.productivityService.getActiveTimer().subscribe({
      next: (session) => (this.activeTimer = session),
      error: () => (this.activeTimer = null),
    });
  }

  usePrompt(prompt: string): void {
    this.aiQuestion = prompt;
  }

  askAI(): void {
    const question = this.aiQuestion.trim();
    if (!question || this.loading.ai) return;

    this.loading.ai = true;
    this.aiService
      .askQuestion(question, { active_section: this.activeSection })
      .subscribe({
        next: (conversation) => {
          this.conversations = [conversation, ...this.conversations];
          this.aiQuestion = '';
          this.loading.ai = false;
          const actions = conversation.context?.executed_actions;
          if (Array.isArray(actions) && actions.length > 0) {
            this.loadTasks();
            this.loadHabits();
            this.loadChallenges();
            this.loadActiveTimer();
            this.showSuccess('AI updated your workspace.');
          }
        },
        error: (error) => {
          this.loading.ai = false;
          this.showError(error.message);
        },
      });
  }

  rateAI(conversation: AIConversation, rating: number): void {
    this.aiService.provideFeedback(conversation.id, rating).subscribe({
      next: () => {
        conversation.feedback = rating;
        this.showSuccess('AI feedback saved.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  trackById(_: number, item: { id?: number }): number | undefined {
    return item.id;
  }

  private syncSectionFromHash(): void {
    const section = window.location.hash.replace('#', '') as DashboardSection;
    const valid: DashboardSection[] = ['overview', 'tasks', 'habits', 'challenges', 'ai'];
    this.activeSection = valid.includes(section) ? section : 'overview';
  }

  private replaceTask(updated: Task): void {
    this.tasks = this.tasks.map((task) =>
      task.id === updated.id ? updated : task,
    );
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
