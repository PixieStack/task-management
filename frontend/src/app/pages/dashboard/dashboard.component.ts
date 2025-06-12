import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { TaskService, Task } from '../../shared/services/task.service';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';

Chart.register(...registerables);

interface TimerState {
  taskId: number;
  startTime: number;
  timeEstimate: number;
  isCountdown: boolean;
}

// Frontend Task interface (extended from backend)
interface FrontendTask extends Task {
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  tags: string[];
  timeSpent?: number;
  timeEstimate?: number;
  isTimerRunning?: boolean;
  timerStart?: Date;
  timerInterval?: any;
  isCountdownTimer?: boolean;
  remainingTime?: number;
}

interface Analytics {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  total_time_spent: number;
  overdue_tasks: number;
  tasks_by_status: { [key: string]: number };
  tasks_by_priority: { [key: string]: number };
  productivity_trend: Array<{ date: string; completed_tasks: number }>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DragDropModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly Math = Math;
  private subscriptions: Subscription[] = [];
  private globalTimerSubscription?: Subscription;

  username: string | null = null;
  email: string | null = null;
  profilePicture: string | null = null;
  tasks: FrontendTask[] = [];
  analytics: Analytics | null = null;

  // Task lists by status
  notStartedTasks: FrontendTask[] = [];
  inProgressTasks: FrontendTask[] = [];
  pendingTasks: FrontendTask[] = [];
  completedTasks: FrontendTask[] = [];

  filteredTasks: FrontendTask[] = [];

  newTask: FrontendTask = this.getEmptyTask();

  // UI state
  activeView: 'list' | 'kanban' | 'calendar' | 'analytics' = 'list';
  isAddTaskModalOpen = false;
  isTaskDetailsModalOpen = false;
  selectedTask: FrontendTask | null = null;
  isDarkMode = false;
  searchQuery = '';
  selectedTag = 'all';
  selectedPriority = 'all';
  isLoading = false;

  // Timer notification states
  showTimerAlert = false;
  alertTask: FrontendTask | null = null;

  // Charts
  productivityChart: Chart | null = null;
  distributionChart: Chart | null = null;

  // Pomodoro
  pomodoroMinutes = 25;
  pomodoroSeconds = 0;
  isPomodoroPaused = true;
  pomodoroInterval: any;
  pomodoroSessionCount = 0;

  // Calendar properties
  currentDate = new Date();
  calendarDays: Date[] = [];

  // Audio context for timer alerts
  private audioContext?: AudioContext;
  private alertAudio?: HTMLAudioElement;

  // Available tags and colors
  availableTags = [
    { name: 'Work', color: '#3498db' },
    { name: 'Personal', color: '#e74c3c' },
    { name: 'Urgent', color: '#f39c12' },
    { name: 'Learning', color: '#9b59b6' },
    { name: 'Health', color: '#2ecc71' },
  ];

  @ViewChild('productivityCanvas') productivityCanvas?: ElementRef;
  @ViewChild('distributionCanvas') distributionCanvas?: ElementRef;

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {
    this.initializeAudio();
  }

  ngOnInit() {
    this.initializeUser();
    this.loadTasks();
    this.loadAnalytics();
    this.generateCalendarDays();
    this.startGlobalTimer();
    this.restoreTimerStates();

    // Subscribe to task updates
    const tasksSub = this.taskService.tasks$.subscribe((tasks) => {
      this.tasks = this.convertBackendTasksToFrontend(tasks);
      this.applyFilters();
      this.filterTasksByStatus();
    });
    this.subscriptions.push(tasksSub);

    // Listen for page visibility changes to handle tab switching
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.restoreTimerStates();
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.clearTimers();
    this.destroyCharts();
    if (this.globalTimerSubscription) {
      this.globalTimerSubscription.unsubscribe();
    }
  }

  private initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Audio context not supported');
    }

    this.alertAudio = new Audio();
    this.alertAudio.preload = 'auto';

    this.alertAudio.src = this.generateBeepSound();
  }

  private generateBeepSound(): string {
    if (!this.audioContext) return '';

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);

      return 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAAAAAAAAAAAAA==';
    } catch (e) {
      console.warn('Could not generate beep sound');
      return '';
    }
  }

  private startGlobalTimer() {
    this.globalTimerSubscription = interval(1000).subscribe(() => {
      let hasActiveTimers = false;

      this.tasks.forEach((task) => {
        if (task.isTimerRunning && task.timerStart) {
          hasActiveTimers = true;
          this.updateTaskTimer(task);
        }
      });

      if (hasActiveTimers) {
        this.saveTimerStates();
        this.cdr.detectChanges();
      }
    });
  }

  private updateTaskTimer(task: FrontendTask) {
    if (!task.timerStart) return;

    const now = new Date();
    const elapsedMs = now.getTime() - task.timerStart.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    if (task.isCountdownTimer && task.timeEstimate) {
      const remainingMinutes = task.timeEstimate - elapsedMinutes;
      task.remainingTime = Math.max(0, remainingMinutes);

      if (remainingMinutes <= 0 && task.isTimerRunning) {
        this.onTimerComplete(task);
      }
    } else {
      task.remainingTime = elapsedMinutes;
    }
  }

  private onTimerComplete(task: FrontendTask) {
    this.stopTimer(task);

    this.showTimerCompleteAlert(task);

    this.playAlertSound();

    this.sendBrowserNotification(task);

    if (task.isCountdownTimer) {
      task.status = 'Completed';
      this.updateTaskInBackend(task);
    }
  }

  private showTimerCompleteAlert(task: FrontendTask) {
    this.alertTask = task;
    this.showTimerAlert = true;

    // Auto-hide after 10 seconds if user doesn't interact
    setTimeout(() => {
      if (this.alertTask?.id === task.id) {
        this.dismissAlert();
      }
    }, 10000);
  }

  private playAlertSound() {
    if (this.alertAudio) {
      try {
        this.alertAudio.currentTime = 0;
        this.alertAudio.play().catch((e) => {
          console.warn('Could not play alert sound:', e);
        });
      } catch (e) {
        console.warn('Audio playback failed:', e);
      }
    }
  }

  private sendBrowserNotification(task: FrontendTask) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Task Timer Complete!', {
        body: `Timer for "${task.title}" has finished!`,
        icon: '/assets/timer-icon.png',
        tag: `task-${task.id}`,
        requireInteraction: true,
      });
    } else if (
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }
  }

  private saveTimerStates() {
    const activeTimers: TimerState[] = [];

    this.tasks.forEach((task) => {
      if (task.isTimerRunning && task.timerStart) {
        activeTimers.push({
          taskId: task.id!,
          startTime: task.timerStart.getTime(),
          timeEstimate: task.timeEstimate || 0,
          isCountdown: task.isCountdownTimer || false,
        });
      }
    });

    localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
  }

  private restoreTimerStates() {
    const savedTimers = localStorage.getItem('activeTimers');
    if (!savedTimers) return;

    try {
      const timerStates: TimerState[] = JSON.parse(savedTimers);

      timerStates.forEach((timerState) => {
        const task = this.tasks.find((t) => t.id === timerState.taskId);
        if (task) {
          task.isTimerRunning = true;
          task.timerStart = new Date(timerState.startTime);
          task.isCountdownTimer = timerState.isCountdown;
          task.timeEstimate = timerState.timeEstimate;

          // Check if timer should have completed while page was closed
          const now = new Date();
          const elapsedMs = now.getTime() - timerState.startTime;
          const elapsedMinutes = Math.floor(elapsedMs / 60000);

          if (
            timerState.isCountdown &&
            elapsedMinutes >= timerState.timeEstimate
          ) {
            // Timer completed while away
            this.onTimerComplete(task);
          }
        }
      });
    } catch (e) {
      console.warn('Could not restore timer states:', e);
      localStorage.removeItem('activeTimers');
    }
  }

  private clearTimers() {
    if (this.pomodoroInterval) {
      clearInterval(this.pomodoroInterval);
    }

    localStorage.removeItem('activeTimers');
  }

  private destroyCharts() {
    if (this.productivityChart) {
      this.productivityChart.destroy();
    }
    if (this.distributionChart) {
      this.distributionChart.destroy();
    }
  }

  private initializeUser() {
    this.username = this.authService.getUsername();
    this.email = localStorage.getItem('userEmail');
    this.profilePicture = localStorage.getItem('profilePicture');

    const darkModePreference = localStorage.getItem('darkMode');
    this.isDarkMode = darkModePreference === 'true';
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private loadTasks() {
    this.isLoading = true;
    const tasksSub = this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = this.convertBackendTasksToFrontend(tasks);
        this.taskService.updateTasksState(tasks);
        this.applyFilters();
        this.filterTasksByStatus();
        this.restoreTimerStates();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading tasks:', error);
        this.isLoading = false;
      },
    });
    this.subscriptions.push(tasksSub);
  }

  private loadAnalytics() {
    const token = this.authService.getToken();
    const analyticsSub = this.http
      .get<Analytics>('http://localhost:8000/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (analytics) => {
          this.analytics = analytics;
          if (this.activeView === 'analytics') {
            setTimeout(() => this.initializeCharts(), 100);
          }
        },
        error: (error) => {
          console.error('Error loading analytics:', error);
        },
      });
    this.subscriptions.push(analyticsSub);
  }

  private convertBackendTasksToFrontend(backendTasks: Task[]): FrontendTask[] {
    return backendTasks.map((task) => ({
      ...task,
      status: task.completed ? 'Completed' : task.status || 'Not Started',
      priority: (task.priority as 'Low' | 'Medium' | 'High') || 'Medium',
      dueDate: task.due_date
        ? new Date(task.due_date).toISOString().split('T')[0]
        : this.formatDate(new Date()),
      tags: Array.isArray(task.tags)
        ? task.tags
        : task.tags
          ? JSON.parse(task.tags as string)
          : [],
      timeSpent: task.time_spent || 0,
      timeEstimate: task.time_estimate || 0,
      isTimerRunning: false,
      isCountdownTimer: false,
      remainingTime: 0,
    }));
  }

  private convertFrontendTaskToBackend(frontendTask: FrontendTask): any {
    return {
      title: frontendTask.title,
      description: frontendTask.description || '',
      completed: frontendTask.status === 'Completed',
      status: frontendTask.status,
      priority: frontendTask.priority,
      due_date: frontendTask.dueDate
        ? new Date(frontendTask.dueDate).toISOString()
        : null,
      tags: frontendTask.tags || [],
      time_estimate: frontendTask.timeEstimate || 0,
      time_spent: frontendTask.timeSpent || 0,
    };
  }

  // Filtering logic
  applyFilters() {
    this.filteredTasks = this.tasks.filter((task) => {
      if (this.searchQuery && this.searchQuery.trim() !== '') {
        const searchLower = this.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description
          ?.toLowerCase()
          .includes(searchLower);
        if (!matchesTitle && !matchesDescription) {
          return false;
        }
      }

      // Tag filter
      if (this.selectedTag !== 'all') {
        if (!task.tags || !task.tags.includes(this.selectedTag)) {
          return false;
        }
      }

      // Priority filter
      if (this.selectedPriority !== 'all') {
        if (task.priority !== this.selectedPriority) {
          return false;
        }
      }

      return true;
    });
  }

  filterTasksByStatus() {
    this.notStartedTasks = this.filteredTasks.filter(
      (task) => task.status === 'Not Started',
    );
    this.inProgressTasks = this.filteredTasks.filter(
      (task) => task.status === 'In Progress',
    );
    this.pendingTasks = this.filteredTasks.filter(
      (task) => task.status === 'Pending',
    );
    this.completedTasks = this.filteredTasks.filter(
      (task) => task.status === 'Completed',
    );
  }

  initializeCharts() {
    if (!this.analytics) return;

    setTimeout(() => {
      this.initializeProductivityChart();
      this.initializeDistributionChart();
    }, 100);
  }

  private initializeProductivityChart() {
    if (!this.productivityCanvas || !this.analytics) return;

    if (this.productivityChart) {
      this.productivityChart.destroy();
    }

    const ctx = this.productivityCanvas.nativeElement.getContext('2d');

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.analytics.productivity_trend.map((item) =>
          new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        ),
        datasets: [
          {
            label: 'Completed Tasks',
            data: this.analytics.productivity_trend.map(
              (item) => item.completed_tasks,
            ),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    };

    this.productivityChart = new Chart(ctx, config);
  }

  private initializeDistributionChart() {
    if (!this.distributionCanvas || !this.analytics) return;

    if (this.distributionChart) {
      this.distributionChart.destroy();
    }

    const ctx = this.distributionCanvas.nativeElement.getContext('2d');

    const statusData = this.analytics.tasks_by_status;
    const labels = Object.keys(statusData);
    const data = Object.values(statusData);

    const colors = ['#95a5a6', '#3498db', '#f39c12', '#2ecc71'];

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
        },
      },
    };

    this.distributionChart = new Chart(ctx, config);
  }

  // UI Interaction methods
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode.toString());

    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  changeView(view: 'list' | 'kanban' | 'calendar' | 'analytics') {
    this.activeView = view;

    if (view === 'analytics') {
      this.loadAnalytics();
    } else if (view === 'calendar') {
      this.generateCalendarDays();
    }
  }

  openAddTaskModal() {
    this.isAddTaskModalOpen = true;
    this.newTask = this.getEmptyTask();
  }

  closeAddTaskModal() {
    this.isAddTaskModalOpen = false;
  }

  openTaskDetailsModal(task: FrontendTask) {
    this.selectedTask = { ...task };
    this.isTaskDetailsModalOpen = true;
  }

  closeTaskDetailsModal() {
    this.isTaskDetailsModalOpen = false;
    this.selectedTask = null;
  }

  getEmptyTask(): FrontendTask {
    return {
      id: 0,
      title: '',
      description: '',
      completed: false,
      status: 'Not Started',
      priority: 'Medium',
      dueDate: this.formatDate(new Date()),
      tags: [],
      timeEstimate: 0,
      timeSpent: 0,
      isTimerRunning: false,
      isCountdownTimer: false,
      remainingTime: 0,
    };
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  addTask() {
    if (this.newTask.title.trim() === '') return;

    this.isLoading = true;
    const backendTask = this.convertFrontendTaskToBackend(this.newTask);

    const addSub = this.taskService.createTask(backendTask).subscribe({
      next: (task) => {
        const frontendTask = this.convertBackendTasksToFrontend([task])[0];
        this.tasks.push(frontendTask);
        this.taskService.addTaskToState(task);
        this.applyFilters();
        this.filterTasksByStatus();
        this.closeAddTaskModal();
        this.loadAnalytics();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error creating task:', error);
        this.isLoading = false;
      },
    });
    this.subscriptions.push(addSub);
  }

  // UpdateTask method
  updateTask() {
    if (!this.selectedTask || this.selectedTask.title.trim() === '') return;

    this.isLoading = true;
    const backendTask = this.convertFrontendTaskToBackend(this.selectedTask);

    const updateSub = this.taskService
      .updateTask(this.selectedTask.id!, backendTask)
      .subscribe({
        next: (updatedTask) => {
          const index = this.tasks.findIndex(
            (t) => t.id === this.selectedTask!.id,
          );
          if (index !== -1) {
            // Preserve timer state
            const wasTimerRunning = this.tasks[index].isTimerRunning;
            const timerStart = this.tasks[index].timerStart;
            const isCountdownTimer = this.tasks[index].isCountdownTimer;

            this.tasks[index] = this.convertBackendTasksToFrontend([
              updatedTask,
            ])[0];

            // Restore timer state
            if (wasTimerRunning) {
              this.tasks[index].isTimerRunning = wasTimerRunning;
              this.tasks[index].timerStart = timerStart;
              this.tasks[index].isCountdownTimer = isCountdownTimer;
            }

            this.applyFilters();
            this.filterTasksByStatus();
            this.loadAnalytics();
          }
          this.closeTaskDetailsModal();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error updating task:', error);
          this.isLoading = false;
        },
      });
    this.subscriptions.push(updateSub);
  }

  private updateTaskInBackend(task: FrontendTask) {
    const backendTask = this.convertFrontendTaskToBackend(task);
    const updateSub = this.taskService
      .updateTask(task.id!, backendTask)
      .subscribe({
        next: () => {
          this.loadAnalytics();
        },
        error: (error) => {
          console.error('Error updating task in backend:', error);
        },
      });
    this.subscriptions.push(updateSub);
  }

  deleteTask(taskId: number | undefined) {
    if (taskId === undefined) return;

    this.isLoading = true;
    const deleteSub = this.taskService.deleteTask(taskId).subscribe({
      next: () => {
        const taskToDelete = this.tasks.find((t) => t.id === taskId);
        if (taskToDelete && taskToDelete.isTimerRunning) {
          this.stopTimer(taskToDelete);
        }

        this.tasks = this.tasks.filter((t) => t.id !== taskId);
        this.taskService.removeTaskFromState(taskId);
        this.applyFilters();
        this.filterTasksByStatus();
        this.closeTaskDetailsModal();
        this.loadAnalytics();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error deleting task:', error);
        this.isLoading = false;
      },
    });
    this.subscriptions.push(deleteSub);
  }

  toggleTaskTag(task: FrontendTask, tag: string) {
    if (task.tags.includes(tag)) {
      task.tags = task.tags.filter((t) => t !== tag);
    } else {
      task.tags.push(tag);
    }
  }

  //Timer functionality with countdown support
  startTimer(task: FrontendTask, isCountdown: boolean = false) {
    if (task.isTimerRunning) return;

    if (isCountdown && (!task.timeEstimate || task.timeEstimate <= 0)) {
      const estimateMinutes = prompt(
        'Enter time estimate in minutes for countdown timer:',
        '25',
      );
      if (!estimateMinutes || isNaN(Number(estimateMinutes))) {
        return;
      }
      task.timeEstimate = Number(estimateMinutes);
    }

    task.isTimerRunning = true;
    task.timerStart = new Date();
    task.isCountdownTimer = isCountdown;
    task.remainingTime = isCountdown ? task.timeEstimate || 0 : 0;

    this.saveTimerStates();
    this.cdr.detectChanges();
  }

  startCountdownTimer(task: FrontendTask) {
    this.startTimer(task, true);
  }

  startRegularTimer(task: FrontendTask) {
    this.startTimer(task, false);
  }

  stopTimer(task: FrontendTask) {
    if (!task.isTimerRunning || !task.timerStart) return;

    const now = new Date();
    const diffMs = now.getTime() - task.timerStart.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    const actualTimeSpent = task.isCountdownTimer
      ? Math.min(diffMins, task.timeEstimate || 0)
      : diffMins;

    task.timeSpent = (task.timeSpent || 0) + actualTimeSpent;
    task.isTimerRunning = false;
    task.timerStart = undefined;
    task.isCountdownTimer = false;
    task.remainingTime = 0;

    this.saveTimerStates();
    this.updateTaskInBackend(task);
    this.cdr.detectChanges();
  }

  // Timer alert methods
  dismissAlert() {
    this.showTimerAlert = false;
    this.alertTask = null;
  }

  snoozeTimer(minutes: number = 5) {
    if (this.alertTask) {
      this.alertTask.timeEstimate = minutes;
      this.startCountdownTimer(this.alertTask);
      this.dismissAlert();
    }
  }

  markTaskComplete() {
    if (this.alertTask) {
      this.alertTask.status = 'Completed';
      this.updateTaskInBackend(this.alertTask);
      this.applyFilters();
      this.filterTasksByStatus();
      this.dismissAlert();
    }
  }

  // Pomodoro functionality
  startPomodoro() {
    if (!this.isPomodoroPaused) return;

    this.isPomodoroPaused = false;
    this.pomodoroInterval = setInterval(() => {
      if (this.pomodoroSeconds === 0) {
        if (this.pomodoroMinutes === 0) {
          this.pomodoroSessionCount++;
          this.pausePomodoro();

          // Play sound when pomodoro completes
          this.playAlertSound();

          if (this.pomodoroSessionCount % 2 === 1) {
            this.pomodoroMinutes = 5;
          } else {
            this.pomodoroMinutes = 25;
            if (this.pomodoroSessionCount % 8 === 0) {
              this.pomodoroMinutes = 15;
            }
          }
          this.cdr.detectChanges();
          return;
        }
        this.pomodoroMinutes--;
        this.pomodoroSeconds = 59;
      } else {
        this.pomodoroSeconds--;
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  pausePomodoro() {
    this.isPomodoroPaused = true;
    if (this.pomodoroInterval) {
      clearInterval(this.pomodoroInterval);
    }
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.pomodoroMinutes = 25;
    this.pomodoroSeconds = 0;
    this.pomodoroSessionCount = 0;
  }

  // Calendar functionality
  generateCalendarDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    this.calendarDays = [];

    // Generate 42 days (6 weeks) to fill the calendar grid
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      this.calendarDays.push(day);
    }
  }

  getCalendarDays(): Date[] {
    return this.calendarDays;
  }

  getCurrentMonth(): Date {
    return this.currentDate;
  }

  getTasksForCalendarDate(date: Date): FrontendTask[] {
    const dateStr = this.formatDate(date);
    return this.filteredTasks.filter((task) => task.dueDate === dateStr);
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isCurrentMonth(date: Date): boolean {
    return (
      date.getMonth() === this.currentDate.getMonth() &&
      date.getFullYear() === this.currentDate.getFullYear()
    );
  }

  // Calendar navigation
  previousMonth() {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1,
    );
    this.generateCalendarDays();
  }

  nextMonth() {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1,
    );
    this.generateCalendarDays();
  }

  // Fixed search functionality
  onSearchChange() {
    this.applyFilters();
    this.filterTasksByStatus();
  }

  onTagFilterChange() {
    this.applyFilters();
    this.filterTasksByStatus();
  }

  onPriorityFilterChange() {
    this.applyFilters();
    this.filterTasksByStatus();
  }

  clearSearch() {
    this.searchQuery = '';
    this.selectedTag = 'all';
    this.selectedPriority = 'all';
    this.applyFilters();
    this.filterTasksByStatus();
  }

  // Data export functionality
  exportTasks() {
    const dataStr = JSON.stringify(this.tasks, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'tasks.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  getCompletionRate(): number {
    return this.analytics ? this.analytics.completion_rate : 0;
  }

  getTotalTimeSpent(): number {
    return this.analytics ? this.analytics.total_time_spent : 0;
  }

  getOverdueTasksCount(): number {
    return this.analytics ? this.analytics.overdue_tasks : 0;
  }

  getUpcomingTasksCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    return this.tasks.filter((task) => {
      if (task.status === 'Completed') return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= today && dueDate < dayAfterTomorrow;
    }).length;
  }

  getTagColor(tagName: string): string {
    const tag = this.availableTags.find((t) => t.name === tagName);
    return tag ? tag.color : '#95a5a6';
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'High':
        return '#e74c3c';
      case 'Medium':
        return '#f39c12';
      case 'Low':
        return '#3498db';
      default:
        return '#95a5a6';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Not Started':
        return '#95a5a6';
      case 'In Progress':
        return '#3498db';
      case 'Pending':
        return '#f39c12';
      case 'Completed':
        return '#2ecc71';
      default:
        return '#95a5a6';
    }
  }

  formatTimeDisplay(minutes: number): string {
    if (!minutes) return '0h 0m';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hours}h ${mins}m`;
  }

  // Timer display methods
  getTimerDisplay(task: FrontendTask): string {
    if (!task.isTimerRunning) {
      return this.formatTimeDisplay(task.timeSpent || 0);
    }

    if (task.isCountdownTimer) {
      return this.formatTimeDisplay(task.remainingTime || 0);
    } else {
      if (!task.timerStart) return this.formatTimeDisplay(task.timeSpent || 0);

      const now = new Date();
      const diffMs = now.getTime() - task.timerStart.getTime();
      const currentSessionMins = Math.floor(diffMs / 60000);
      const totalMins = (task.timeSpent || 0) + currentSessionMins;

      return this.formatTimeDisplay(totalMins);
    }
  }

  getTimerDisplayWithLabel(task: FrontendTask): string {
    const timeStr = this.getTimerDisplay(task);

    if (task.isTimerRunning) {
      if (task.isCountdownTimer) {
        return `⏰ ${timeStr} remaining`;
      } else {
        return `⏱️ ${timeStr} elapsed`;
      }
    }

    return `🕐 ${timeStr} total`;
  }

  getTimerProgress(task: FrontendTask): number {
    if (!task.isCountdownTimer || !task.timeEstimate) return 0;

    if (!task.isTimerRunning || !task.timerStart) return 0;

    const now = new Date();
    const elapsedMs = now.getTime() - task.timerStart.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const progress = (elapsedMinutes / task.timeEstimate) * 100;

    return Math.min(100, Math.max(0, progress));
  }

  isTimerNearCompletion(task: FrontendTask): boolean {
    if (!task.isCountdownTimer || !task.isTimerRunning) return false;
    return (task.remainingTime || 0) <= 2;
  }

  isTimerOvertime(task: FrontendTask): boolean {
    if (!task.isCountdownTimer || !task.isTimerRunning) return false;
    return (task.remainingTime || 0) <= 0;
  }

  isTaskOverdue(task: FrontendTask): boolean {
    if (task.status === 'Completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate);
    return dueDate < today;
  }

  // Track by methods
  trackByTaskId(index: number, task: FrontendTask): number {
    return task.id || index;
  }

  trackByDate(index: number, date: Date): string {
    return date.toISOString();
  }

  // Timer control methods for UI
  hasActiveTimer(task: FrontendTask): boolean {
    return task.isTimerRunning || false;
  }

  canStartTimer(task: FrontendTask): boolean {
    return !task.isTimerRunning && task.status !== 'Completed';
  }

  canStartCountdown(task: FrontendTask): boolean {
    return !task.isTimerRunning && task.status !== 'Completed';
  }

  // Utility method to format countdown display
  formatCountdownDisplay(minutes: number): string {
    if (minutes <= 0) return '00:00';

    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const secs = 0;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
    } else {
      return `${mins.toString().padStart(2, '0')}:00`;
    }
  }

  getRealTimeCountdown(task: FrontendTask): string {
    if (!task.isTimerRunning || !task.isCountdownTimer || !task.timerStart) {
      return this.formatCountdownDisplay(task.timeEstimate || 0);
    }

    const now = new Date();
    const elapsedMs = now.getTime() - task.timerStart.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

    const totalElapsedMinutes = elapsedMinutes;
    const remainingMinutes = Math.max(
      0,
      (task.timeEstimate || 0) - totalElapsedMinutes,
    );
    const remainingSeconds = remainingMinutes > 0 ? 60 - elapsedSeconds : 0;

    const actualRemainingMinutes =
      remainingSeconds === 60 ? remainingMinutes : remainingMinutes;
    const actualRemainingSeconds =
      remainingSeconds === 60 ? 0 : remainingSeconds;

    if (actualRemainingMinutes >= 60) {
      const hours = Math.floor(actualRemainingMinutes / 60);
      const minutes = actualRemainingMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${actualRemainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${actualRemainingMinutes.toString().padStart(2, '0')}:${actualRemainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  // Method to get timer button text
  getTimerButtonText(task: FrontendTask): string {
    if (task.isTimerRunning) {
      return task.isCountdownTimer ? 'Stop Countdown' : 'Stop Timer';
    }
    return 'Start Timer';
  }

  getCountdownButtonText(task: FrontendTask): string {
    if (task.isTimerRunning && task.isCountdownTimer) {
      return 'Stop Countdown';
    }
    return 'Start Countdown';
  }

  // Method to get timer status class for styling
  getTimerStatusClass(task: FrontendTask): string {
    if (!task.isTimerRunning) return '';

    if (task.isCountdownTimer) {
      if (this.isTimerOvertime(task)) return 'timer-overtime';
      if (this.isTimerNearCompletion(task)) return 'timer-warning';
      return 'timer-countdown';
    }

    return 'timer-active';
  }

  // Method to check if any task has an active timer
  hasAnyActiveTimer(): boolean {
    return this.tasks.some((task) => task.isTimerRunning);
  }

  // Method to get count of active timers
  getActiveTimersCount(): number {
    return this.tasks.filter((task) => task.isTimerRunning).length;
  }

  // Method to stop all active timers
  stopAllTimers() {
    this.tasks.forEach((task) => {
      if (task.isTimerRunning) {
        this.stopTimer(task);
      }
    });
  }

  // Method to get tasks with active timers
  getTasksWithActiveTimers(): FrontendTask[] {
    return this.tasks.filter((task) => task.isTimerRunning);
  }

  // Time estimation helpers
  estimateTimeFromDescription(description: string): number {
    const words = description.toLowerCase().split(' ');
    let baseTime = Math.max(15, Math.min(120, words.length * 2));
    const complexKeywords = [
      'research',
      'analyze',
      'develop',
      'create',
      'design',
      'implement',
    ];
    const simpleKeywords = [
      'update',
      'fix',
      'review',
      'call',
      'email',
      'check',
    ];

    const hasComplexKeywords = complexKeywords.some((keyword) =>
      description.toLowerCase().includes(keyword),
    );
    const hasSimpleKeywords = simpleKeywords.some((keyword) =>
      description.toLowerCase().includes(keyword),
    );

    if (hasComplexKeywords) baseTime *= 1.5;
    if (hasSimpleKeywords) baseTime *= 0.7;

    return Math.round(baseTime);
  }

  // Auto-suggest time estimate for new tasks
  suggestTimeEstimate(task: FrontendTask): number {
    if (task.description) {
      return this.estimateTimeFromDescription(task.description);
    }

    // Default estimates based on priority
    switch (task.priority) {
      case 'High':
        return 60;
      case 'Medium':
        return 30;
      case 'Low':
        return 15;
      default:
        return 30;
    }
  }

  // Apply suggested time estimate
  applySuggestedEstimate(task: FrontendTask) {
    const suggestion = this.suggestTimeEstimate(task);
    task.timeEstimate = suggestion;
  }

  // Batch timer operations
  startTimerForMultipleTasks(
    tasks: FrontendTask[],
    isCountdown: boolean = false,
  ) {
    tasks.forEach((task) => {
      if (this.canStartTimer(task)) {
        this.startTimer(task, isCountdown);
      }
    });
  }

  // Get summary of time tracking
  getTimeTrackingSummary() {
    const totalEstimated = this.tasks.reduce(
      (sum, task) => sum + (task.timeEstimate || 0),
      0,
    );
    const totalSpent = this.tasks.reduce(
      (sum, task) => sum + (task.timeSpent || 0),
      0,
    );
    const activeTimers = this.getActiveTimersCount();

    return {
      totalEstimated,
      totalSpent,
      activeTimers,
      efficiency: totalEstimated > 0 ? (totalSpent / totalEstimated) * 100 : 0,
    };
  }
}
