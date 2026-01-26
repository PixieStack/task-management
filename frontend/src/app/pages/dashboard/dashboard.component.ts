import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { TaskService, Task } from '../../shared/services/task.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Subject, interval, takeUntil } from 'rxjs';

Chart.register(...registerables);

// Interfaces (keep the same as before)
interface Challenge {
  id: string;
  title: string;
  description: string;
  duration: number;
  type: ChallengeType;
  startDate: Date;
  currentStreak: number;
  bestStreak: number;
  completed: boolean;
  xpReward: number;
  icon: string;
  progress: number;
}

interface Project {
  id: string;
  title: string;
  description: string;
  duration: string;
  milestones: Milestone[];
  startDate: Date;
  endDate: Date;
  progress: number;
  status: ProjectStatus;
  category: string;
}

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate: Date;
  tasks: TaskItem[];
}

interface TaskItem {
  id?: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  tags: string[];
  timeEstimate: number;
  timeSpent: number;
  isTimerRunning: boolean;
  timerStart?: Date;
  isCountdownTimer: boolean;
  remainingTime?: number;
  xpReward?: number;
}

interface HabitEntry {
  id: string;
  habitId: string;
  date: Date;
  completed: boolean;
  mood?: number;
  energy?: number;
  notes?: string;
}

interface DietEntry {
  id: string;
  date: Date;
  mealTime: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories?: number;
  waterIntake: number;
}

interface UserStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalChallengesCompleted: number;
  currentStreaks: { [key: string]: number };
  badges: Badge[];
  rank?: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedDate?: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

enum ChallengeType {
  Eating = 'eating',
  NoSocial = 'no-social',
  Productivity = 'productivity',
  Meditation = 'meditation',
  Coding = 'coding',
  Reading = 'reading',
  Exercise = 'exercise',
  Sleep = 'sleep',
  Finance = 'finance',
  Language = 'language'
}

enum TaskStatus {
  NotStarted = 'Not Started',
  InProgress = 'In Progress',
  Pending = 'Pending',
  Completed = 'Completed'
}

enum Priority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

enum ProjectStatus {
  Planning = 'Planning',
  Active = 'Active',
  OnHold = 'On Hold',
  Completed = 'Completed'
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  // ViewChild references
  @ViewChild('progressChart') progressChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('habitChart') habitChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('xpChart') xpChartRef?: ElementRef<HTMLCanvasElement>;

  // Observables
  private destroy$ = new Subject<void>();

  // Main sections
  activeSection: 'overview' | 'challenges' | 'projects' | 'habits' | 'diet' | 'gamification' = 'overview';
  
  // State
  tasks: TaskItem[] = [];
  challenges: Challenge[] = [];
  activeProjects: Project[] = [];
  todaysHabits: HabitEntry[] = [];
  dietEntries: DietEntry[] = [];
  userStats: UserStats = {
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    totalChallengesCompleted: 0,
    currentStreaks: {},
    badges: []
  };
  
  // UI State
  showAddChallengeModal = false;
  showAddProjectModal = false;
  showAddTaskModal = false;
  showDietModal = false;
  showAiAssistant = false;
  isLoading = false;
  currentTime = new Date();
  showFabMenu = false;
  
  // AI Assistant
  aiSuggestions: string[] = [];
  aiMotivationalQuote = '';
  aiApiKey: string = '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';
  aiInput: string = '';
  aiResponse: string = '';
  aiError: string = '';
  // Allow user to set their own API key for the AI assistant
  setApiKey(key: string): void {
    this.aiApiKey = key;
    localStorage.setItem('mob_ai_api_key', key);
  }

  // Load API key from localStorage if present
  loadApiKey(): void {
    const key = localStorage.getItem('mob_ai_api_key');
    if (key) {
      this.aiApiKey = key;
    }
  }

  // Call OpenAI API (or similar) for suggestions or motivational quote
  async callAiAssistant(prompt: string): Promise<string> {
    if (!this.aiApiKey) {
      this.aiError = 'No API key set.';
      return '';
    }
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 60
        })
      });
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        this.aiError = 'No response from AI.';
        return '';
      }
    } catch (err) {
      this.aiError = 'Error contacting AI service.';
      return '';
    }
  }

  // Example: Use AI for motivational quote if API key is set
  async updateMotivationalQuote(): Promise<void> {
    if (this.aiApiKey) {
      const prompt = 'Give me a short, motivational quote for productivity.';
      const quote = await this.callAiAssistant(prompt);
      this.aiMotivationalQuote = quote || 'Success is the sum of small efforts repeated day in and day out.';
    } else {
      const quotes = [
        'Success is the sum of small efforts repeated day in and day out.',
        'The only way to do great work is to love what you do.',
        "Don’t watch the clock; do what it does. Keep going.",
        'The future depends on what you do today.',
        "Excellence is not a skill, it’s an attitude."
      ];
      this.aiMotivationalQuote = quotes[Math.floor(Math.random() * quotes.length)];
    }
  }

  // Example: Use AI for suggestions if API key is set
  async generateAISuggestions(): Promise<void> {
    if (this.aiApiKey) {
      const prompt = 'Give me 3 personalized productivity suggestions for the next hour.';
      const aiText = await this.callAiAssistant(prompt);
      if (aiText) {
        this.aiSuggestions = aiText.split(/\n|\d+\.|•/).map(s => s.trim()).filter(Boolean).slice(0, 3);
      } else {
        this.aiSuggestions = [];
      }
    } else {
      // fallback to local logic
      const hour = this.currentHour;
      const suggestions: string[] = [];
      if (hour >= 6 && hour < 9) {
        suggestions.push('Start your day with the most challenging task');
        suggestions.push('Review your daily goals and priorities');
      } else if (hour >= 12 && hour < 14) {
        suggestions.push('Take a break and have a healthy lunch');
        suggestions.push('Perfect time for a short meditation session');
      } else if (hour >= 15 && hour < 18) {
        suggestions.push('Last meal window approaching - plan your dinner');
        suggestions.push('Review your progress and adjust evening plans');
      } else if (hour >= 18) {
        suggestions.push('Focus on water and herbal tea only');
        suggestions.push('Great time for reading or light exercise');
      }
      this.challenges.forEach(challenge => {
        if (challenge.currentStreak > 0 && challenge.currentStreak % 7 === 0) {
          suggestions.push(`Amazing! ${challenge.currentStreak} days on ${challenge.title}`);
        }
      });
      this.aiSuggestions = suggestions.slice(0, 3);
    }
  }
  
  // Diet Management
  lastMealTime?: Date;
  waterIntakeToday = 0;
  waterIntakeGoal = 2000;
  currentHour = new Date().getHours();
  
  // User
  username = '';
  userAvatar = '';
  
  // Charts
  private progressChart?: Chart;
  private habitChart?: Chart;
  private xpChart?: Chart;

  // Predefined challenges
  // using any[] here because some templates include UI-only flags (e.g. isCustom)
  challengeTemplates: any[] = [
    {
      title: 'Custom Challenge',
      description: 'Create a custom challenge for 1-12 months (choose months when starting)',
      duration: 30,
      type: ChallengeType.Productivity,
      xpReward: 0,
      icon: 'fas fa-sliders-h',
      // UI-only flag to indicate custom behaviour
      isCustom: true
    },
    {
      title: 'Eating/Fasting Challenge',
      description: 'Intermittent fasting with last meal by 6 PM',
      duration: 21,
      type: ChallengeType.Eating,
      xpReward: 500,
      icon: 'fas fa-apple-alt'
    },
    {
      title: 'No Social Media',
      description: 'Digital detox from all social platforms',
      duration: 21,
      type: ChallengeType.NoSocial,
      xpReward: 600,
      icon: 'fas fa-ban'
    },
    {
      title: 'Daily Productivity',
      description: 'Complete 3 key tasks every day',
      duration: 30,
      type: ChallengeType.Productivity,
      xpReward: 800,
      icon: 'fas fa-bolt'
    },
    {
      title: 'Meditation Journey',
      description: '15 minutes of daily meditation',
      duration: 21,
      type: ChallengeType.Meditation,
      xpReward: 400,
      icon: 'fas fa-spa'
    },
    {
      title: 'Code Every Day',
      description: 'Write code for at least 1 hour daily',
      duration: 30,
      type: ChallengeType.Coding,
      xpReward: 1000,
      icon: 'fas fa-code'
    },
    {
      title: 'Reading Challenge',
      description: 'Read 30 pages every day',
      duration: 30,
      type: ChallengeType.Reading,
      xpReward: 700,
      icon: 'fas fa-book-open'
    }
  ];

  

  // Project templates
  projectTemplates = [
    {
      title: 'AI/ML Project',
      category: 'Technology',
      duration: '3-6 months',
      icon: '🤖'
    },
    {
      title: 'Data Dashboard',
      category: 'Analytics',
      duration: '3 months',
      icon: '📊'
    },
    {
      title: 'Mobile App',
      category: 'Development',
      duration: '6 months',
      icon: '📱'
    },
    {
      title: 'Side Business',
      category: 'Entrepreneurship',
      duration: '6-12 months',
      icon: '🚀'
    }
  ];

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private cdr: ChangeDetectorRef
  ) {
    // Ensure a finance savings challenge exists in the templates
    const hasFinance = this.challengeTemplates.some((t: any) => t.title && t.title.toLowerCase().includes('finance'));
    if (!hasFinance) {
      this.challengeTemplates.push({
        title: 'Finance Savings',
        description: 'Build disciplined savings habits. Save a target amount weekly or monthly.',
        duration: 30,
        type: ChallengeType.Finance,
        xpReward: 600,
        icon: 'fas fa-coins'
      });
    }
  }

  ngOnInit(): void {
    this.loadApiKey();
    this.initializeUser();
    this.loadData();
    this.startTimers();
    this.initializeAI();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
  }

  // Computed properties for template
  get completedTasks(): TaskItem[] {
    return this.tasks.filter(t => t.status === TaskStatus.Completed);
  }

  get incompleteTasks(): TaskItem[] {
    return this.tasks.filter(t => t.status !== TaskStatus.Completed);
  }

  get completedTasksToday(): number {
    const today = new Date().toDateString();
    return this.completedTasks.filter(t => {
      // For demo, assume completed today
      return true;
    }).length;
  }

  get activeTasksCount(): number {
    return this.incompleteTasks.length;
  }

  get activeChallenges(): Challenge[] {
    return this.challenges.filter(c => !c.completed);
  }

  get completedProjects(): Project[] {
    return this.activeProjects.filter(p => p.status === ProjectStatus.Completed);
  }

  get dailyStreak(): number {
    return this.userStats.currentStreaks['daily'] || 0;
  }

  // Add missing method
  closeAddModal(): void {
    this.showAddTaskModal = false;
  }

  // Continue with all the methods from before...
  private initializeUser(): void {
    this.username = this.authService.getUsername() || 'User';
    this.userAvatar = this.generateAvatar(this.username);
    this.loadUserStats();
  }

  private generateAvatar(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e67e22&color=fff&size=128&font-size=0.4`;
  }

  private loadData(): void {
    this.isLoading = true;
    
    Promise.all([
      this.loadTasks(),
      this.loadChallenges(),
      this.loadProjects(),
      this.loadHabits(),
      this.loadDietData()
    ]).then(() => {
      this.isLoading = false;
      this.cdr.markForCheck();
      this.initializeCharts();
    });
  }

  private async loadTasks(): Promise<void> {
    try {
      const tasks = await this.taskService.getTasks().toPromise();
      this.tasks = this.convertTasks(tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private loadChallenges(): void {
    const savedChallenges = localStorage.getItem('mob_challenges');
    if (savedChallenges) {
      this.challenges = JSON.parse(savedChallenges);
    }
  }

  private loadProjects(): void {
    const savedProjects = localStorage.getItem('mob_projects');
    if (savedProjects) {
      this.activeProjects = JSON.parse(savedProjects);
    }
  }

  private loadHabits(): void {
    const savedHabits = localStorage.getItem('mob_habits');
    if (savedHabits) {
      this.todaysHabits = JSON.parse(savedHabits);
    }
  }

  private loadDietData(): void {
    const savedDiet = localStorage.getItem('mob_diet');
    if (savedDiet) {
      this.dietEntries = JSON.parse(savedDiet);
      this.calculateWaterIntake();
      this.findLastMealTime();
    }
  }

  private loadUserStats(): void {
    const savedStats = localStorage.getItem('mob_user_stats');
    if (savedStats) {
      this.userStats = JSON.parse(savedStats);
    }
  }

    private convertTasks(backendTasks: any[]): TaskItem[] {
    return backendTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.completed ? TaskStatus.Completed : TaskStatus.NotStarted,
      priority: task.priority || Priority.Medium,
      dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
      tags: Array.isArray(task.tags) ? task.tags : [],
      timeEstimate: task.time_estimate || 30,
      timeSpent: task.time_spent || 0,
      isTimerRunning: false,
      isCountdownTimer: false,
      xpReward: this.calculateXP(task.priority)
    }));
  }

  private calculateXP(priority: string): number {
    switch (priority) {
      case 'High': return 50;
      case 'Medium': return 30;
      case 'Low': return 20;
      default: return 20;
    }
  }

  private startTimers(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentTime = new Date();
        this.currentHour = this.currentTime.getHours();
        this.updateRunningTimers();
        this.checkDietReminders();
        this.cdr.markForCheck();
      });
  }

  private updateRunningTimers(): void {
    this.tasks.forEach(task => {
      if (task.isTimerRunning && task.timerStart) {
        const elapsed = Date.now() - task.timerStart.getTime();
        const elapsedMinutes = Math.floor(elapsed / 60000);
        
        if (task.isCountdownTimer && task.timeEstimate) {
          task.remainingTime = Math.max(0, task.timeEstimate - elapsedMinutes);
          if (task.remainingTime <= 0) {
            this.completeTask(task);
          }
        }
      }
    });
  }

  private initializeAI(): void {
    this.generateAISuggestions();
    this.updateMotivationalQuote();
    
    interval(3600000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.generateAISuggestions();
        this.updateMotivationalQuote();
      });
  }



  private checkDietReminders(): void {
    if (this.currentHour === 15 && this.currentTime.getMinutes() === 30) {
      this.showDietReminder('Last meal window starts in 30 minutes!');
    } else if (this.currentHour === 17 && this.currentTime.getMinutes() === 45) {
      this.showDietReminder('Last meal window closing in 15 minutes!');
    }
  }

  private showDietReminder(message: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('M.O.B Diet Reminder', {
        body: message,
        icon: '/assets/logo.png'
      });
    }
  }

  private calculateWaterIntake(): void {
    const today = new Date().toDateString();
    this.waterIntakeToday = this.dietEntries
      .filter(entry => new Date(entry.date).toDateString() === today)
      .reduce((total, entry) => total + (entry.waterIntake || 0), 0);
  }

  private findLastMealTime(): void {
    const today = new Date().toDateString();
    const todaysMeals = this.dietEntries
      .filter(entry => new Date(entry.date).toDateString() === today)
      .filter(entry => entry.mealType !== 'snack')
      .sort((a, b) => new Date(b.mealTime).getTime() - new Date(a.mealTime).getTime());
    
    if (todaysMeals.length > 0) {
      this.lastMealTime = new Date(todaysMeals[0].mealTime);
    }
  }

  private initializeCharts(): void {
    if (this.activeSection === 'overview' || this.activeSection === 'habits') {
      this.createProgressChart();
      this.createHabitChart();
      this.createXPChart();
    }
  }

  private createProgressChart(): void {
    if (!this.progressChartRef) return;
    
    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    this.progressChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.getLast7Days(),
        datasets: [
          {
            label: 'Tasks Completed',
            data: this.getTaskCompletionData(),
            borderColor: '#e67e22',
            backgroundColor: 'rgba(230, 126, 34, 0.1)',
            tension: 0.4
          },
          {
            label: 'XP Earned',
            data: this.getXPData(),
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#ecf0f1' }
          }
        },
        scales: {
          y: {
            ticks: { color: '#ecf0f1' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y1: {
            position: 'right',
            ticks: { color: '#ecf0f1' },
            grid: { drawOnChartArea: false }
          },
          x: {
            ticks: { color: '#ecf0f1' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });
  }

  private createHabitChart(): void {
    if (!this.habitChartRef) return;
    
    const ctx = this.habitChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    this.habitChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Productivity', 'Health', 'Learning', 'Mindfulness', 'Fitness'],
        datasets: [{
          label: 'This Week',
          data: [80, 65, 90, 75, 85],
          borderColor: '#e67e22',
          backgroundColor: 'rgba(230, 126, 34, 0.2)'
        }, {
          label: 'Last Week',
          data: [70, 60, 85, 70, 75],
          borderColor: '#95a5a6',
          backgroundColor: 'rgba(149, 165, 166, 0.2)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#ecf0f1' }
          }
        },
        scales: {
          r: {
            ticks: { color: '#ecf0f1' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: { color: '#ecf0f1' }
          }
        }
      }
    });
  }

  private createXPChart(): void {
    if (!this.xpChartRef) return;
    
    const ctx = this.xpChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    this.xpChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Tasks', 'Challenges', 'Streaks', 'Habits'],
        datasets: [{
          data: [300, 500, 200, 150],
          backgroundColor: [
            '#e67e22',
            '#3498db',
            '#2ecc71',
            '#9b59b6'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#ecf0f1' }
          }
        }
      }
    });
  }

  private destroyCharts(): void {
    this.progressChart?.destroy();
    this.habitChart?.destroy();
    this.xpChart?.destroy();
  }

  getLast7Days(): string[] {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toLocaleDateString('en', { weekday: 'short' }));
    }
    return days;
  }

  private getTaskCompletionData(): number[] {
    return [5, 8, 6, 9, 7, 10, 8];
  }

  private getXPData(): number[] {
    return [150, 240, 180, 270, 210, 300, 240];
  }

  // Public methods
  setActiveSection(section: typeof this.activeSection): void {
    this.activeSection = section;
    if (section === 'overview' || section === 'habits') {
      setTimeout(() => this.initializeCharts(), 100);
    }
    this.cdr.markForCheck();
  }

  startChallenge(template: Partial<Challenge>): void {
    const challenge: Challenge = {
      id: this.generateId(),
      title: template.title!,
      description: template.description!,
      duration: template.duration!,
      type: template.type!,
      startDate: new Date(),
      currentStreak: 0,
      bestStreak: 0,
      completed: false,
      xpReward: template.xpReward!,
      icon: template.icon!,
      progress: 0
    };
    
    this.challenges.push(challenge);
    this.saveChallenges();
    this.showNotification(`Started ${challenge.title}!`);
  }

  updateChallengeProgress(challengeId: string): void {
    const challenge = this.challenges.find(c => c.id === challengeId);
    if (!challenge || challenge.completed) return;
    
    challenge.currentStreak++;
    challenge.progress = (challenge.currentStreak / challenge.duration) * 100;
    
    if (challenge.currentStreak > challenge.bestStreak) {
      challenge.bestStreak = challenge.currentStreak;
    }
    
    if (challenge.currentStreak >= challenge.duration) {
      this.completeChallenge(challenge);
    }
    
    this.saveChallenges();
    this.cdr.markForCheck();
  }

  private completeChallenge(challenge: Challenge): void {
    challenge.completed = true;
    this.addXP(challenge.xpReward);
    this.userStats.totalChallengesCompleted++;
    this.saveUserStats();
    this.showNotification(`Congratulations! Completed ${challenge.title}`);
    this.checkForBadges();
  }

  addXP(amount: number): void {
    this.userStats.xp += amount;
    
      while (this.userStats.xp >= this.userStats.xpToNextLevel) {
    this.userStats.xp -= this.userStats.xpToNextLevel;
    this.userStats.level++;
    this.userStats.xpToNextLevel = this.calculateXPForLevel(this.userStats.level);
    this.showNotification(`Level Up! You're now level ${this.userStats.level}`);
  }
  
  this.saveUserStats();
}

private calculateXPForLevel(level: number): number {
  return Math.floor(100 * level * 1.5);
}

private checkForBadges(): void {
  const badges: Badge[] = [];
  
  if (this.userStats.totalChallengesCompleted >= 5) {
    badges.push({
      id: 'challenger',
      name: 'Challenge Master',
      description: 'Complete 5 challenges',
      icon: '🏆',
      rarity: 'rare'
    });
  }
  
  if (this.userStats.level >= 10) {
    badges.push({
      id: 'level10',
      name: 'Dedicated User',
      description: 'Reach level 10',
      icon: '⭐',
      rarity: 'epic'
    });
  }
  
  badges.forEach(badge => {
    if (!this.userStats.badges.find(b => b.id === badge.id)) {
      badge.unlockedDate = new Date();
      this.userStats.badges.push(badge);
      this.showNotification(`New Badge Unlocked: ${badge.name}!`);
    }
  });
  
  this.saveUserStats();
}

createProject(template: any): void {
  const project: Project = {
    id: this.generateId(),
    title: template.title,
    description: '',
    duration: template.duration,
    milestones: this.generateMilestones(template.duration),
    startDate: new Date(),
    endDate: this.calculateEndDate(template.duration),
    progress: 0,
    status: ProjectStatus.Planning,
    category: template.category
  };
  
  this.activeProjects.push(project);
  this.saveProjects();
}

private generateMilestones(duration: string): Milestone[] {
  const months = parseInt(duration.split('-')[0]);
  const milestones: Milestone[] = [];
  
  for (let i = 1; i <= months; i++) {
    const milestone: Milestone = {
      id: this.generateId(),
      title: `Month ${i} Milestone`,
      completed: false,
      dueDate: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)),
      tasks: []
    };
    milestones.push(milestone);
  }
  
  return milestones;
}

private calculateEndDate(duration: string): Date {
  const months = parseInt(duration.split('-')[1] || duration.split('-')[0]);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);
  return endDate;
}

toggleTimer(task: TaskItem): void {
  if (task.isTimerRunning) {
    this.stopTimer(task);
  } else {
    this.startTimer(task);
  }
}

private startTimer(task: TaskItem): void {
  task.isTimerRunning = true;
  task.timerStart = new Date();
  this.saveTasks();
}

private stopTimer(task: TaskItem): void {
  if (!task.timerStart) return;
  
  const elapsed = Date.now() - task.timerStart.getTime();
  const elapsedMinutes = Math.floor(elapsed / 60000);
  task.timeSpent += elapsedMinutes;
  task.isTimerRunning = false;
  task.timerStart = undefined;
  
  this.saveTasks();
}

completeTask(task: TaskItem): void {
  task.status = TaskStatus.Completed;
  if (task.xpReward) {
    this.addXP(task.xpReward);
  }
  this.saveTasks();
  this.updateProjectProgress();
  this.showNotification(`Task completed! +${task.xpReward} XP`);
}

private updateProjectProgress(): void {
  this.activeProjects.forEach(project => {
    let completedMilestones = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    
    project.milestones.forEach(milestone => {
      totalTasks += milestone.tasks.length;
      completedTasks += milestone.tasks.filter(t => t.status === TaskStatus.Completed).length;
      
      if (milestone.tasks.length > 0 && 
          milestone.tasks.every(t => t.status === TaskStatus.Completed)) {
        milestone.completed = true;
        completedMilestones++;
      }
    });
    
    project.progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    if (completedMilestones === project.milestones.length && project.milestones.length > 0) {
      project.status = ProjectStatus.Completed;
      this.addXP(1000);
      this.showNotification(`Project "${project.title}" completed! +1000 XP`);
    }
  });
  
  this.saveProjects();
}

addWaterIntake(amount: number): void {
  const entry: DietEntry = {
    id: this.generateId(),
    date: new Date(),
    mealTime: new Date(),
    mealType: 'snack',
    description: `Water ${amount}ml`,
    waterIntake: amount
  };
  
  this.dietEntries.push(entry);
  this.waterIntakeToday += amount;
  this.saveDietData();
  
  if (this.waterIntakeToday >= this.waterIntakeGoal) {
    this.addXP(20);
    this.showNotification('Daily water goal achieved! +20 XP');
  }
}

logMeal(mealType: string): void {
  if (this.currentHour >= 18 && mealType !== 'snack') {
    this.showNotification('Remember: No meals after 6 PM!', 'warning');
    return;
  }
  
  this.showDietModal = true;
}

getDietSuggestion(): string {
  const hour = this.currentHour;
  
  if (hour < 12) {
    return 'Start your day with a protein-rich breakfast and plenty of water';
  } else if (hour < 16) {
    return 'Perfect time for a balanced lunch with vegetables and whole grains';
  } else if (hour < 18) {
    return 'Last meal window! Make it count with a nutritious dinner';
  } else {
    return 'Fasting time! Stick to water and herbal teas only';
  }
}

getMotivationalMessage(): string {
  if (this.currentHour >= 18 && this.lastMealTime) {
    const hoursSinceLastMeal = (Date.now() - this.lastMealTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMeal > 2) {
      return `Great job! ${Math.floor(hoursSinceLastMeal)} hours into your fasting window!`;
    }
  }
  return this.aiMotivationalQuote;
}

private showNotification(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
  console.log(`[${type}] ${message}`);
  // Implement toast notification here
  this.cdr.markForCheck();
}

private generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

private saveTasks(): void {
  localStorage.setItem('mob_tasks', JSON.stringify(this.tasks));
}

private saveChallenges(): void {
  localStorage.setItem('mob_challenges', JSON.stringify(this.challenges));
}

private saveProjects(): void {
  localStorage.setItem('mob_projects', JSON.stringify(this.activeProjects));
}

private saveDietData(): void {
  localStorage.setItem('mob_diet', JSON.stringify(this.dietEntries));
}

private saveUserStats(): void {
  localStorage.setItem('mob_user_stats', JSON.stringify(this.userStats));
}

// Computed properties for template
get waterIntakePercentage(): number {
  return Math.min((this.waterIntakeToday / this.waterIntakeGoal) * 100, 100);
}

get canEatMeal(): boolean {
  return this.currentHour < 18;
}

get levelProgress(): number {
  return (this.userStats.xp / this.userStats.xpToNextLevel) * 100;
}

get activeChallengesCount(): number {
  return this.activeChallenges.length;
}

get activeProjectsCount(): number {
  return this.activeProjects.filter(p => p.status === ProjectStatus.Active).length;
}

getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#95a5a6';
    case 'rare': return '#3498db';
    case 'epic': return '#9b59b6';
    case 'legendary': return '#f39c12';
    default: return '#95a5a6';
  }
}

getChallengeTypeIcon(type: ChallengeType): string {
  const icons = {
    [ChallengeType.Eating]: '🍎',
    [ChallengeType.NoSocial]: '📵',
    [ChallengeType.Productivity]: '⚡',
    [ChallengeType.Meditation]: '🧘',
    [ChallengeType.Coding]: '💻',
    [ChallengeType.Reading]: '📚',
    [ChallengeType.Exercise]: '💪',
    [ChallengeType.Sleep]: '😴',
    [ChallengeType.Finance]: '💰',
    [ChallengeType.Language]: '🗣️'
  };
  return icons[type] || '🎯';
}

formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

getBadgeCount(): number {
  return this.userStats.badges.length;
}

// Fixed template methods
getCompletedTasksCount(): number {
  return this.completedTasks.length;
}

getActiveTasksDisplay(): string {
  return `${this.activeTasksCount}`;
}

getCompletedTodayDisplay(): string {
  return `${this.completedTasksToday} completed today`;
}

getActiveChallengesDisplay(): string {
  return `${this.activeChallengesCount}`;
}

getCompletedProjectsDisplay(): string {
  return `${this.completedProjects.length} completed`;
}

toggleMobileMenu(): void {
  // NOTE: Implement logic to show/hide the sidebar on mobile
  console.log('Mobile menu toggled');
}

toggleFabMenu(): void {
  this.showFabMenu = !this.showFabMenu;
  this.cdr.markForCheck();
}
}