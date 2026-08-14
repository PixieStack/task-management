import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';

import { AIChat, AIConversation, AIFormField, AIFormOption, AIFormPrompt, AIService, AIStatus } from '../../shared/services/ai.service';
import {
  BookType,
  Challenge,
  ChallengeCreate,
  ChallengeService,
} from '../../shared/services/challenge.service';
import {
  Habit,
  HabitEntry,
  HabitService,
} from '../../shared/services/habit.service';
import {
  apiTimestampMilliseconds,
  ProductivityService,
  TimeSession,
} from '../../shared/services/productivity.service';
import {
  Task,
  TaskCreate,
  TaskService,
} from '../../shared/services/task.service';
import {
  Project,
  ProjectCategory,
  ProjectCreate,
  ProjectService,
  ProjectStatus,
} from '../../shared/services/project.service';

type DashboardSection = 'overview' | 'tasks' | 'habits' | 'challenges' | 'ai';
type TaskFilter = 'active' | 'completed' | 'overdue' | 'archived';
type CompletionFilter = 'active' | 'completed' | 'archived';
type ReadingProjectMode = 'reading' | 'project';
type ChallengeViewTab = 'reading' | 'projects';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('conversationViewport') conversationViewport?: ElementRef<HTMLElement>;

  activeSection: DashboardSection = 'overview';
  taskFilter: TaskFilter = 'active';
  habitFilter: CompletionFilter = 'active';
  challengeFilter: CompletionFilter = 'active';
  projectFilter: CompletionFilter = 'active';
  taskSearch = '';
  taskPriorityFilter: 'all' | Task['priority'] = 'all';
  habitSearch = '';
  habitDurationFilter: 'all' | 'short' | 'standard' | 'long' = 'all';
  challengeSearch = '';
  challengeBookFilter: 'all' | BookType = 'all';
  projectSearch = '';
  projectCategoryFilter = 'all';

  tasks: Task[] = [];
  habits: Habit[] = [];
  habitEntries: HabitEntry[] = [];
  challenges: Challenge[] = [];
  projects: Project[] = [];
  projectCategories: ProjectCategory[] = [];
  conversations: AIConversation[] = [];
  aiChats: AIChat[] = [];
  activeChatId = '';
  aiStatus: AIStatus | null = null;
  aiError = '';
  activeTimer: TimeSession | null = null;
  now = Date.now();

  loading = {
    tasks: false,
    habits: false,
    challenges: false,
    projects: false,
    ai: false,
  };

  errorMessage = '';
  successMessage = '';

  newTask = {
    title: '',
    description: '',
    priority: 'Medium' as Task['priority'],
    due_date: '',
    due_time: '',
    tags: '',
  };

  newHabit = {
    name: '',
    description: '',
    duration_days: 21,
    custom_duration: false,
  };
  readonly habitDurationOptions = [21, 30, 60, 90];
  completedHabit: Habit | null = null;
  completionCelebration: { eyebrow: string; title: string; message: string } | null = null;
  taskDueReview: Task | null = null;
  habitReview: Habit | null = null;
  habitReviewStage: 'question' | 'extend' = 'question';
  additionalHabitDays = 7;
  habitReviewSaving = false;
  readonly celebrationPieces = Array.from({ length: 24 });

  readingProjectMode: ReadingProjectMode = 'reading';
  challengeViewTab: ChallengeViewTab = 'reading';
  newChallenge = {
    challenge_type: 'reading' as const,
    title: '',
    book_type: 'fiction' as BookType,
    duration: 30,
    dailyGoal: '20 pages',
  };
  readonly defaultProjectCategories = [
    'Software Development',
    'Marketing',
    'Design',
    'Research',
    'Operations',
  ];
  readonly projectStatuses: { value: ProjectStatus; label: string }[] = [
    { value: 'in_progress', label: 'In progress' },
    { value: 'under_review', label: 'Under review' },
    { value: 'complete', label: 'Completed' },
  ];
  newProject = {
    title: '',
    description: '',
    category: 'Software Development',
  };
  customProjectCategory = '';
  savingProjectCategory = false;

  aiQuestion = '';
  pendingAIQuestion = '';
  aiFormAnswers: Record<number, Record<string, string | number | null>> = {};
  aiSuggestedPrompts = [
    'Create a high-priority task to finish my report tomorrow.',
    'Add Review lecture notes to today\'s todos.',
    'Create a 21-day habit to drink water every morning.',
    'Start a 14-day reading plan for 20 pages a day.',
    'Create a software development project for my portfolio.',
    'What should I focus on today?',
  ];

  private fragmentSubscription?: Subscription;
  private timerClock?: number;
  private dismissedDueTaskIds = new Set<number>();

  constructor(
    private changeDetector: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService,
    private habitService: HabitService,
    private challengeService: ChallengeService,
    private projectService: ProjectService,
    private aiService: AIService,
    private productivityService: ProductivityService,
  ) {}

  ngOnInit(): void {
    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.syncSectionFromFragment(fragment);
    });
    this.loadTasks();
    this.loadHabits();
    this.loadChallenges();
    this.loadProjects();
    this.loadProjectCategories();
    this.startNewChat();
    this.loadAIChats();
    this.loadAIStatus();
    this.loadActiveTimer();
    this.timerClock = window.setInterval(() => {
      this.now = Date.now();
      this.checkTaskDueReview();
      this.changeDetector.markForCheck();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.fragmentSubscription?.unsubscribe();
    if (this.timerClock) window.clearInterval(this.timerClock);
  }

  setSection(section: DashboardSection): void {
    this.activeSection = section;
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: section === 'overview' ? undefined : section,
      replaceUrl: true,
    });
  }

  get totalTasks(): number {
    return this.tasks.filter((task) => !task.archived_at).length;
  }

  get completedTasks(): number {
    return this.tasks.filter((task) => task.completed && !task.archived_at).length;
  }

  get activeTasks(): number {
    return this.tasks.filter((task) => !task.completed && !task.archived_at).length;
  }

  get overdueTasks(): number {
    const now = new Date();
    return this.tasks.filter((task) => {
      if (task.archived_at) return false;
      if (!task.due_date || task.completed) return false;
      return new Date(task.due_date).getTime() < now.getTime();
    }).length;
  }

  get completedHabitsToday(): number {
    return this.habits.filter((habit) => !habit.archived_at && this.isHabitDoneToday(habit)).length;
  }

  get activeChallenges(): number {
    return this.activeReadingChallenges
      + this.projects.filter((project) => !project.archived_at && project.status !== 'complete').length;
  }

  get activeReadingChallenges(): number {
    return this.challenges.filter((challenge) => !challenge.archived_at && !challenge.completed && challenge.is_active).length;
  }

  get filteredTasks(): Task[] {
    let tasks: Task[];
    switch (this.taskFilter) {
      case 'active':
        tasks = this.tasks.filter((task) => !task.archived_at && !task.completed);
        break;
      case 'completed':
        tasks = this.tasks.filter((task) => !task.archived_at && task.completed);
        break;
      case 'overdue':
        tasks = this.tasks.filter((task) => !task.archived_at && this.isOverdue(task));
        break;
      case 'archived':
        tasks = this.tasks.filter((task) => Boolean(task.archived_at));
        break;
    }
    const search = this.taskSearch.trim().toLowerCase();
    return tasks.filter((task) =>
      (this.taskPriorityFilter === 'all' || task.priority === this.taskPriorityFilter)
      && (!search || `${task.title} ${task.description || ''} ${(task.tags || []).join(' ')}`.toLowerCase().includes(search))
    );
  }

  get filteredHabits(): Habit[] {
    const search = this.habitSearch.trim().toLowerCase();
    return this.habits.filter((habit) => {
      const matchesView = this.habitFilter === 'archived' ? Boolean(habit.archived_at)
        : !habit.archived_at && (this.habitFilter === 'completed' ? habit.completed : !habit.completed);
      const matchesDuration = this.habitDurationFilter === 'all'
        || (this.habitDurationFilter === 'short' && habit.duration_days <= 21)
        || (this.habitDurationFilter === 'standard' && habit.duration_days > 21 && habit.duration_days <= 60)
        || (this.habitDurationFilter === 'long' && habit.duration_days > 60);
      return matchesView && matchesDuration && (!search || `${habit.name} ${habit.description || ''} ${habit.category || ''}`.toLowerCase().includes(search));
    });
  }

  get activeHabits(): number {
    return this.habits.filter((habit) => !habit.archived_at && !habit.completed).length;
  }

  get completedHabits(): number {
    return this.habits.filter((habit) => !habit.archived_at && habit.completed).length;
  }

  get filteredChallenges(): Challenge[] {
    const search = this.challengeSearch.trim().toLowerCase();
    return this.challenges.filter((challenge) => {
      const matchesView = this.challengeFilter === 'archived' ? Boolean(challenge.archived_at)
        : !challenge.archived_at && (this.challengeFilter === 'completed' ? challenge.completed : !challenge.completed && challenge.is_active);
      return matchesView
        && (this.challengeBookFilter === 'all' || challenge.book_type === this.challengeBookFilter)
        && (!search || `${challenge.title} ${challenge.description || ''}`.toLowerCase().includes(search));
    });
  }

  get completedChallenges(): number {
    return this.challenges.filter((challenge) => !challenge.archived_at && challenge.completed).length;
  }

  get filteredProjects(): Project[] {
    const search = this.projectSearch.trim().toLowerCase();
    return this.projects.filter((project) => {
      const matchesView = this.projectFilter === 'archived' ? Boolean(project.archived_at)
        : !project.archived_at && (this.projectFilter === 'completed' ? project.status === 'complete' : project.status !== 'complete');
      return matchesView
        && (this.projectCategoryFilter === 'all' || project.category === this.projectCategoryFilter)
        && (!search || `${project.title} ${project.description || ''} ${project.category}`.toLowerCase().includes(search));
    });
  }

  get activeProjects(): number {
    return this.projects.filter((project) => !project.archived_at && project.status !== 'complete').length;
  }

  get completedProjects(): number {
    return this.projects.filter((project) => !project.archived_at && project.status === 'complete').length;
  }

  get archivedTasks(): number { return this.tasks.filter((task) => task.archived_at).length; }
  get archivedHabits(): number { return this.habits.filter((habit) => habit.archived_at).length; }
  get archivedChallenges(): number { return this.challenges.filter((challenge) => challenge.archived_at).length; }
  get archivedProjects(): number { return this.projects.filter((project) => project.archived_at).length; }
  get overviewTasks(): Task[] { return this.tasks.filter((task) => !task.archived_at).slice(0, 5); }
  get overviewHabits(): Habit[] { return this.habits.filter((habit) => !habit.archived_at).slice(0, 5); }
  get overviewChallenges(): Challenge[] { return this.challenges.filter((challenge) => !challenge.archived_at).slice(0, 4); }
  get overviewProjects(): Project[] { return this.projects.filter((project) => !project.archived_at).slice(0, 4); }
  get projectFilterCategories(): string[] { return [...new Set(this.projects.filter((project) => !project.archived_at).map((project) => project.category))].sort(); }

  loadTasks(): void {
    this.loading.tasks = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.loading.tasks = false;
        this.checkTaskDueReview();
      },
      error: (error) => {
        this.loading.tasks = false;
        this.showError(error.message);
      },
    });
  }

  createTask(): void {
    const title = this.newTask.title.trim();
    if (!title || !this.newTask.priority || !this.newTask.due_date || !this.newTask.due_time) {
      this.showError('Task title, priority, due date, and due time are required.');
      return;
    }

    const payload: TaskCreate = {
      title,
      description: this.newTask.description.trim(),
      completed: false,
      status: 'Not Started',
      priority: this.newTask.priority,
      due_date: this.taskDueDateTime(),
      tags: this.newTask.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      time_estimate: 0,
      time_spent: 0,
      time_spent_seconds: 0,
    };

    this.taskService.createTask(payload).subscribe({
      next: (task) => {
        this.tasks = [task, ...this.tasks];
        this.taskFilter = 'active';
        this.newTask = {
          title: '',
          description: '',
          priority: 'Medium',
          due_date: '',
          due_time: '',
          tags: '',
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

    const update$ = completed && this.isTimerRunning(task)
      ? this.productivityService.stopTimer().pipe(
          switchMap(() => this.taskService.updateTask(task.id!, { completed: true, status: 'Completed' })),
        )
      : this.taskService.updateTask(task.id, { completed: task.completed, status: task.status });
    update$
      .subscribe({
        next: (updated) => {
          if (completed) this.activeTimer = null;
          this.replaceTask(updated);
          if (completed) this.showSuccess('Task completed and tracked time saved.');
        },
        error: (error) => {
          task.completed = previousCompleted;
          task.status = previousStatus;
          this.showError(error.message);
        },
      });
  }

  updateTaskStatus(task: Task, status: Task['status']): void {
    if (!task.id) return;
    const completing = status === 'Completed';
    const update = {
        status,
        completed: completing,
      };
    const update$ = completing && this.isTimerRunning(task)
      ? this.productivityService.stopTimer().pipe(
          switchMap(() => this.taskService.updateTask(task.id!, update)),
        )
      : this.taskService.updateTask(task.id, update);
    update$
      .subscribe({
        next: (updated) => {
          if (completing) this.activeTimer = null;
          this.replaceTask(updated);
          if (completing) this.showSuccess('Task completed and tracked time saved.');
        },
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
          this.showSuccess(`Paused and saved ${this.formatDuration(session.elapsed_seconds)} to ${task.title}.`);
        },
        error: (error) => this.showError(error.message),
      });
      return;
    }
    if (this.activeTimer) {
      this.showError('Another timer is already running. Stop it from the item where it was started first.');
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

  taskElapsed(task: Task): number {
    const stored = task.time_spent_seconds || (task.time_spent || 0) * 60;
    if (!this.isTimerRunning(task) || !this.activeTimer) return stored;
    const activeSeconds = Math.max(
      0,
      Math.floor((this.now - apiTimestampMilliseconds(this.activeTimer.started_at)) / 1000),
    );
    return stored + activeSeconds;
  }

  taskDeadlineLabel(task: Task): string {
    if (!task.due_date) return '';
    const dueAt = new Date(task.due_date).getTime();
    if (!Number.isFinite(dueAt)) return '';
    const remainingSeconds = Math.ceil((dueAt - this.now) / 1000);
    return remainingSeconds <= 0
      ? 'Due time reached'
      : `Due in ${this.formatDuration(remainingSeconds)}`;
  }

  keepDueTaskActive(): void {
    const taskId = this.taskDueReview?.id;
    if (taskId) this.dismissedDueTaskIds.add(taskId);
    this.taskDueReview = null;
  }

  completeDueTask(): void {
    const task = this.taskDueReview;
    if (!task?.id) return;
    this.dismissedDueTaskIds.add(task.id);
    this.taskDueReview = null;
    this.toggleTask(task);
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
        const pendingReview = habits.find((habit) => habit.completion_review_required);
        if (pendingReview && !this.habitReview && !this.completedHabit && !this.taskDueReview) this.openHabitReview(pendingReview);
      },
      error: (error) => {
        this.loading.habits = false;
        this.showError(error.message);
      },
    });
  }

  loadHabitEntries(): void {
    this.habitService.getHabitEntries(undefined, 365).subscribe({
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
        target_count: 1,
        duration_days: Math.max(1, Math.min(365, Number(this.newHabit.duration_days) || 21)),
        category: 'personal',
        icon: 'fas fa-check-circle',
      })
      .subscribe({
        next: (habit) => {
          this.habits = [habit, ...this.habits];
          this.habitFilter = 'active';
          this.newHabit = { name: '', description: '', duration_days: 21, custom_duration: false };
          this.showSuccess('Habit created. Your first daily check-in is ready.');
        },
        error: (error) => this.showError(error.message),
      });
  }

  toggleHabit(habit: Habit): void {
    if (!habit.id) return;
    if (habit.completed) {
      this.showSuccess('This habit is already complete. Well done!');
      return;
    }
    if (habit.completion_review_required) {
      this.openHabitReview(habit);
      return;
    }
    if (!this.canHabitCheckIn(habit)) {
      this.showError(`Your next check-in unlocks in ${this.habitCooldown(habit)}.`);
      return;
    }
    this.habitService.checkIn(habit.id).subscribe({
      next: (result) => {
        this.habits = this.habits.map((item) => item.id === result.habit.id ? result.habit : item);
        this.habitEntries = [result.entry, ...this.habitEntries];
        if (result.review_required) {
          this.openHabitReview(result.habit);
        } else {
          this.showSuccess(`Day ${result.habit.check_in_count} of ${result.habit.duration_days} complete. Come back after 24 hours.`);
        }
      },
      error: (error) => this.showError(error?.error?.detail?.message || error?.error?.detail || error.message),
    });
  }

  private taskDueDateTime(): string {
    return `${this.newTask.due_date}T${this.newTask.due_time}:00`;
  }

  private checkTaskDueReview(): void {
    if (this.taskDueReview || this.habitReview || this.completedHabit) return;
    const dueTask = this.tasks
      .filter((task) => {
        if (!task.id || task.completed || !task.due_date || this.dismissedDueTaskIds.has(task.id)) return false;
        const dueAt = new Date(task.due_date).getTime();
        return Number.isFinite(dueAt) && dueAt <= this.now;
      })
      .sort((left, right) => new Date(left.due_date!).getTime() - new Date(right.due_date!).getTime())[0];
    if (dueTask) this.taskDueReview = dueTask;
  }

  setHabitDuration(days: number | 'custom'): void {
    if (days === 'custom') {
      this.newHabit.custom_duration = true;
      if (this.habitDurationOptions.includes(this.newHabit.duration_days)) this.newHabit.duration_days = 14;
      return;
    }
    this.newHabit.custom_duration = false;
    this.newHabit.duration_days = days;
  }

  closeHabitCelebration(): void {
    this.completedHabit = null;
  }

  closeCompletionCelebration(): void {
    this.completionCelebration = null;
  }

  openHabitReview(habit: Habit): void {
    this.habitReview = habit;
    this.habitReviewStage = 'question';
    this.additionalHabitDays = 7;
  }

  showHabitExtension(): void {
    this.habitReviewStage = 'extend';
  }

  confirmHabitEstablished(): void {
    if (!this.habitReview?.id || this.habitReviewSaving) return;
    this.habitReviewSaving = true;
    this.habitService.reviewCompletion(this.habitReview.id, true).subscribe({
      next: (result) => {
        this.habits = this.habits.map((item) => item.id === result.habit.id ? result.habit : item);
        this.habitReview = null;
        this.habitReviewSaving = false;
        this.completedHabit = result.habit;
        this.showSuccess('Habit completed! Your congratulations email is on its way.');
      },
      error: (error) => {
        this.habitReviewSaving = false;
        this.showError(error?.error?.detail || error.message);
      },
    });
  }

  extendHabitPlan(): void {
    if (!this.habitReview?.id || this.habitReviewSaving) return;
    const additionalDays = Math.max(1, Math.min(365, Number(this.additionalHabitDays) || 1));
    this.habitReviewSaving = true;
    this.habitService.reviewCompletion(this.habitReview.id, false, additionalDays).subscribe({
      next: (result) => {
        this.habits = this.habits.map((item) => item.id === result.habit.id ? result.habit : item);
        this.habitReview = null;
        this.habitReviewStage = 'question';
        this.habitReviewSaving = false;
        this.showSuccess(`${additionalDays} days added. Keep checking in once every 24 hours.`);
      },
      error: (error) => {
        this.habitReviewSaving = false;
        this.showError(error?.error?.detail || error.message);
      },
    });
  }

  habitCooldown(habit: Habit): string {
    if (!habit.next_check_in_at) return '0h 00m 00s';
    const timestamp = habit.next_check_in_at;
    const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`;
    const remaining = Math.max(0, Math.ceil((new Date(normalized).getTime() - this.now) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }

  habitCheckInLabel(habit: Habit): string {
    if (habit.completed) return 'Completed';
    if (habit.completion_review_required) return 'Review habit completion';
    if (this.canHabitCheckIn(habit)) return habit.check_in_count ? 'Continue daily check-in' : 'Start first check-in';
    return `Next check-in in ${this.habitCooldown(habit)}`;
  }

  canHabitCheckIn(habit: Habit): boolean {
    if (habit.completed || habit.completion_review_required) return false;
    if (habit.can_check_in || !habit.next_check_in_at) return true;
    const timestamp = habit.next_check_in_at;
    const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`;
    return new Date(normalized).getTime() <= this.now;
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
    if (!habit.next_check_in_at) return false;
    const timestamp = habit.next_check_in_at;
    const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`;
    return new Date(normalized).getTime() > this.now;
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

  setReadingProjectMode(mode: ReadingProjectMode): void {
    this.readingProjectMode = mode;
  }

  createChallenge(): void {
    const title = this.newChallenge.title.trim();
    const dailyGoal = this.newChallenge.dailyGoal.trim();
    if (!title || !dailyGoal || !this.newChallenge.duration || !this.newChallenge.book_type) {
      this.showError('Book title, book type, duration, and daily goal are required.');
      return;
    }

    const payload: ChallengeCreate = {
      title,
      description: `Daily goal: ${dailyGoal}`,
      duration: Number(this.newChallenge.duration),
      challenge_type: 'reading',
      book_type: this.newChallenge.book_type,
      icon: 'fas fa-book-open',
    };

    this.challengeService.createChallenge(payload).subscribe({
      next: (challenge) => {
        this.challenges = [challenge, ...this.challenges];
        this.challengeFilter = 'active';
        this.challengeViewTab = 'reading';
        this.newChallenge = { challenge_type: 'reading', title: '', book_type: 'fiction', duration: 30, dailyGoal: '20 pages' };
        this.showSuccess('Reading challenge started.');
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
        if (!challenge.completed && updated.completed) {
          this.completionCelebration = {
            eyebrow: 'Reading challenge complete',
            title: 'You finished it!',
            message: `You completed your reading challenge for ${updated.title}.`,
          };
        }
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
    if (!this.activeChatId) return;
    this.aiService.getConversations(this.activeChatId).subscribe({
      next: (conversations) => {
        this.conversations = [...conversations].sort(
          (first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
        );
        this.scrollConversationToBottom();
      },
      error: (error) => (this.aiError = error.message),
    });
  }

  loadProjects(): void {
    this.loading.projects = true;
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.loading.projects = false;
      },
      error: (error) => {
        this.loading.projects = false;
        this.showError(error.message);
      },
    });
  }

  loadProjectCategories(): void {
    this.projectService.getCategories().subscribe({
      next: (categories) => (this.projectCategories = categories),
      error: (error) => this.showError(error.message),
    });
  }

  get availableProjectCategories(): string[] {
    return [...new Set([
      ...this.defaultProjectCategories,
      ...this.projectCategories.map((category) => category.name),
    ])];
  }

  saveProjectCategory(): void {
    const name = this.customProjectCategory.trim();
    if (!name) {
      this.showError('Enter a category name first.');
      return;
    }
    this.savingProjectCategory = true;
    this.projectService.createCategory(name).subscribe({
      next: (category) => {
        if (!this.projectCategories.some((item) => item.id === category.id)) {
          this.projectCategories = [...this.projectCategories, category];
        }
        this.newProject.category = category.name;
        this.customProjectCategory = '';
        this.savingProjectCategory = false;
        this.showSuccess(`“${category.name}” was saved to your categories.`);
      },
      error: (error) => {
        this.savingProjectCategory = false;
        this.showError(error.message);
      },
    });
  }

  createProject(): void {
    const title = this.newProject.title.trim();
    const description = this.newProject.description.trim();
    if (!title || !description || !this.newProject.category) {
      this.showError('Project title, description, and category are required.');
      return;
    }
    const payload: ProjectCreate = {
      title,
      description,
      category: this.newProject.category,
    };
    this.projectService.createProject(payload).subscribe({
      next: (project) => {
        this.projects = [project, ...this.projects];
        this.challengeViewTab = 'projects';
        this.projectFilter = project.status === 'complete' ? 'completed' : 'active';
        this.newProject = {
          title: '',
          description: '',
          category: this.newProject.category,
        };
        this.showSuccess('Project created.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  updateProjectStatus(project: Project, status: ProjectStatus): void {
    const previous = project.status;
    project.status = status;
    this.projectService.updateProject(project.id, { status }).subscribe({
      next: (updated) => {
        this.projects = this.projects.map((item) => item.id === updated.id ? updated : item);
        this.showSuccess(`Project moved to ${this.projectStatusLabel(status)}.`);
        if (previous !== 'complete' && updated.status === 'complete') {
          this.completionCelebration = {
            eyebrow: 'Project complete',
            title: 'Milestone reached!',
            message: `You completed ${updated.title}.`,
          };
        }
      },
      error: (error) => {
        project.status = previous;
        this.showError(error.message);
      },
    });
  }

  deleteProject(project: Project): void {
    if (!window.confirm(`Delete “${project.title}”?`)) return;
    this.projectService.deleteProject(project.id).subscribe({
      next: () => {
        this.projects = this.projects.filter((item) => item.id !== project.id);
        this.showSuccess('Project deleted.');
      },
      error: (error) => this.showError(error.message),
    });
  }

  projectStatusLabel(status: ProjectStatus): string {
    return this.projectStatuses.find((item) => item.value === status)?.label || status;
  }

  loadAIChats(): void {
    this.aiService.getChats().subscribe({
      next: (chats) => (this.aiChats = chats),
      error: (error) => (this.aiError = error.message),
    });
  }

  loadAIStatus(): void {
    this.aiService.getStatus().subscribe({
      next: (status) => (this.aiStatus = status),
      error: (error) => (this.aiError = error.message),
    });
  }

  startNewChat(): void {
    this.activeChatId = this.newChatId();
    this.conversations = [];
    this.aiQuestion = '';
    this.aiError = '';
  }

  selectAIChat(chat: AIChat): void {
    this.activeChatId = chat.chat_id;
    this.aiQuestion = '';
    this.aiError = '';
    this.loadAIHistory();
  }

  get activeChatTitle(): string {
    const chat = this.aiChats.find((item) => item.chat_id === this.activeChatId);
    if (!chat) return 'New conversation';
    return chat.chat_id === 'legacy' ? 'Earlier conversations' : chat.title;
  }

  get currentMessageCount(): number {
    return this.conversations.length * 2;
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
    this.aiError = '';
    this.pendingAIQuestion = question;
    this.scrollConversationToBottom(true);
    this.aiService
      .askQuestion(question, this.activeChatId, { active_section: this.activeSection })
      .subscribe({
        next: (conversation) => {
          this.activeChatId = conversation.chat_id;
          this.conversations = [...this.conversations, conversation];
          this.pendingAIQuestion = '';
          this.aiQuestion = '';
          this.loading.ai = false;
          this.loadAIChats();
          this.scrollConversationToBottom(true);
          const actions = conversation.context?.executed_actions;
          if (Array.isArray(actions) && actions.length > 0) {
            this.loadTasks();
            this.loadHabits();
            this.loadChallenges();
            this.loadProjects();
            this.loadActiveTimer();
            this.showSuccess('AI updated your workspace.');
            this.handleAICompletionCelebration(actions);
            this.handleAIActionNavigation(actions);
          }
        },
        error: (error) => {
          this.loading.ai = false;
          this.pendingAIQuestion = '';
          this.aiError = error.message;
          this.showError(error.message);
        },
      });
  }

  isActiveAIForm(item: AIConversation): boolean {
    const latest = this.conversations[this.conversations.length - 1];
    return latest?.id === item.id && Boolean(item.context?.workflow?.active && item.context?.form_prompt);
  }

  submitAIForm(item: AIConversation): void {
    if (this.loading.ai) return;
    const prompt = this.aiFormPrompt(item);
    if (!prompt) return;
    this.loading.ai = true;
    this.aiError = '';
    this.pendingAIQuestion = `Creating ${this.aiWorkflowName(prompt.workflow_type).toLowerCase()} with your details`;
    this.scrollConversationToBottom(true);
    this.aiService.askQuestion(
      `Use these details to ${prompt.title.toLowerCase()}.`,
      this.activeChatId,
      { active_section: this.activeSection, workflow_values: this.aiFormValues(item, prompt) },
    ).subscribe({
      next: (conversation) => this.handleAIResponse(conversation),
      error: (error) => {
        this.loading.ai = false;
        this.pendingAIQuestion = '';
        this.aiError = error.message;
        this.showError(error.message);
      },
    });
  }

  cancelAIForm(item: AIConversation): void {
    if (this.loading.ai) return;
    this.loading.ai = true;
    this.aiService.askQuestion('Cancel setup', this.activeChatId, {
      active_section: this.activeSection,
      workflow_cancelled: true,
    }).subscribe({
      next: (conversation) => this.handleAIResponse(conversation),
      error: (error) => {
        this.loading.ai = false;
        this.aiError = error.message;
      },
    });
  }

  aiFormPrompt(item: AIConversation): AIFormPrompt | null {
    return item.context?.form_prompt || null;
  }

  aiFormValues(item: AIConversation, prompt?: AIFormPrompt): Record<string, string | number | null> {
    if (!this.aiFormAnswers[item.id]) this.aiFormAnswers[item.id] = { ...(prompt?.values || {}) };
    return this.aiFormAnswers[item.id];
  }

  aiFieldVisible(item: AIConversation, field: AIFormField, prompt: AIFormPrompt): boolean {
    if (!field.depends_on) return true;
    const dependency = this.aiFormValues(item, prompt)[field.depends_on];
    return field.show_when ? String(dependency || '') === field.show_when : Boolean(dependency);
  }

  aiFieldOptions(item: AIConversation, field: AIFormField, prompt: AIFormPrompt): AIFormOption[] {
    const dependency = field.depends_on ? String(this.aiFormValues(item, prompt)[field.depends_on] || '') : '';
    return (field.options || []).filter((option) => !option.when || option.when === dependency);
  }

  aiFormReady(item: AIConversation, prompt: AIFormPrompt): boolean {
    return prompt.fields.every((field) => {
      if (!this.aiFieldVisible(item, field, prompt) || !field.required) return true;
      const value = this.aiFormValues(item, prompt)[field.key];
      return value !== null && value !== undefined && String(value).trim().length > 0;
    });
  }

  selectAIField(item: AIConversation, prompt: AIFormPrompt, field: AIFormField, value: string): void {
    this.aiFormValues(item, prompt)[field.key] = value;
    prompt.errors = { ...(prompt.errors || {}), [field.key]: '' };
    if (field.key === 'item_type') this.aiFormValues(item, prompt)['target'] = null;
  }

  aiWorkflowName(type: string): string {
    const names: Record<string, string> = {
      task: 'Task', todo: 'Todo', habit: 'Habit', challenge: 'Reading challenge',
      project: 'Project', tracked_timer: 'Time tracking', pomodoro: 'Focus session',
    };
    return names[type] || 'Item';
  }

  private handleAIResponse(conversation: AIConversation): void {
    this.activeChatId = conversation.chat_id;
    this.conversations = [...this.conversations, conversation];
    this.pendingAIQuestion = '';
    this.loading.ai = false;
    this.loadAIChats();
    this.scrollConversationToBottom(true);
    const actions = conversation.context?.executed_actions;
    if (Array.isArray(actions) && actions.length > 0) {
      this.loadTasks();
      this.loadHabits();
      this.loadChallenges();
      this.loadProjects();
      this.loadActiveTimer();
      this.showSuccess('AI updated your workspace.');
      this.handleAICompletionCelebration(actions);
      this.handleAIActionNavigation(actions);
    }
  }

  aiActionLabel(action: any): string {
    const labels: Record<string, string> = {
      create_task: 'Created task',
      create_todo: 'Created Todo',
      create_habit: 'Created habit',
      create_challenge: 'Created reading challenge',
      create_project: 'Created project',
      start_timer: 'Started timer',
      stop_timer: 'Stopped timer',
      open_focus_timer: 'Started Pomodoro',
      update_task: 'Updated task',
      update_todo: 'Updated Todo',
      update_project: 'Updated project',
    };
    const suffix = action.title || action.name;
    return `${labels[action.type] || action.type.replaceAll('_', ' ')}${suffix ? `: ${suffix}` : ''}`;
  }

  aiActionRoute(action: any): string | null {
    const routes: Record<string, string> = {
      create_task: '/dashboard#tasks',
      create_todo: '/todo',
      create_habit: '/dashboard#habits',
      create_challenge: '/dashboard#challenges',
      create_project: '/dashboard#challenges',
      start_timer: '/focus-timer',
      open_focus_timer: '/focus-timer',
    };
    return routes[action?.type] || null;
  }

  openAIAction(action: any): void {
    const route = this.aiActionRoute(action);
    if (!route) return;
    if (action?.type === 'create_project') {
      this.challengeViewTab = 'projects';
      this.projectFilter = 'active';
    } else if (action?.type === 'create_challenge') {
      this.challengeViewTab = 'reading';
      this.challengeFilter = 'active';
    }
    void this.router.navigateByUrl(route);
  }

  private handleAICompletionCelebration(actions: any[]): void {
    const completed = actions.find((action) => action?.completed_now);
    if (!completed) return;
    const isProject = completed.type === 'update_project';
    this.completionCelebration = {
      eyebrow: isProject ? 'Project complete' : 'Reading challenge complete',
      title: isProject ? 'Milestone reached!' : 'You finished it!',
      message: isProject
        ? `You completed ${completed.title}.`
        : `You completed your reading challenge for ${completed.title}.`,
    };
  }

  private handleAIActionNavigation(actions: any[]): void {
    const navigation = actions.find((action) => action.navigate_to === '/focus-timer');
    if (!navigation) return;
    const minutes = Math.max(1, Math.min(Number(navigation.minutes) || 25, 180));
    const now = Date.now();
    localStorage.setItem('focus_pomodoro', JSON.stringify({
      mode: 'focus',
      minutes,
      remaining: minutes * 60,
      running: Boolean(navigation.autostart),
      endAt: navigation.autostart ? now + minutes * 60 * 1000 : null,
      completed: 0,
    }));
    void this.router.navigate(['/focus-timer']);
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

  trackByChatId(_: number, chat: AIChat): string {
    return chat.chat_id;
  }

  private syncSectionFromFragment(fragment: string | null): void {
    const section = fragment as DashboardSection;
    const valid: DashboardSection[] = ['overview', 'tasks', 'habits', 'challenges', 'ai'];
    this.activeSection = valid.includes(section) ? section : 'overview';
    this.changeDetector.markForCheck();
  }

  private newChatId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private scrollConversationToBottom(smooth = false): void {
    window.setTimeout(() => {
      const viewport = this.conversationViewport?.nativeElement;
      if (!viewport) return;
      if (typeof viewport.scrollTo === 'function') {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }

  private replaceTask(updated: Task): void {
    this.tasks = this.tasks.map((task) =>
      task.id === updated.id ? updated : task,
    );
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
