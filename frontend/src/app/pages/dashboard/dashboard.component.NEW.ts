import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { TaskService, Task } from '../../shared/services/task.service';
import { ChallengeService, Challenge } from '../../shared/services/challenge.service';
import { DietService } from '../../shared/services/diet.service';
import { AIService } from '../../shared/services/ai.service';
import { GamificationService } from '../../shared/services/gamification.service';
import { NotificationService } from '../../shared/services/notification.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Subject, takeUntil } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('progressChart') progressChartRef?: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();

  // Active Section
  activeSection: 'overview' | 'challenges' | 'projects' | 'habits' | 'diet' | 'gamification' = 'overview';

  // Backend Data
  tasks: Task[] = [];
  challenges: any[] = [];
  activeChallenges: any[] = [];
  completedChallenges: any[] = [];
  projects: any[] = [];
  roadmaps: any[] = [];
  habits: any[] = [];
  dietPreferences: any = null;
  mealPlan: any = null;
  meals: any[] = [];
  waterEntries: any[] = [];
  userStats: any = {
    level: 1,
    total_xp: 0,
    xp_to_next_level: 2000,
    challenges_completed: 0,
    rank: 'Beginner'
  };

  // UI State
  showAddChallengeModal = false;
  showAddProjectModal = false;
  showAddRoadmapModal = false;
  showAddTaskModal = false;
  showDietModal = false;
  showDietPreferencesModal = false;
  showAiAssistant = false;
  showCustomChallengeModal = false;
  showMealLogModal = false;
  isLoading = false;
  currentTime = new Date();

  // Forms
  newChallenge: any = {
    title: '',
    description: '',
    duration: 21,
    challenge_type: '',
    icon: 'fas fa-trophy'
  };

  newProject: any = {
    title: '',
    description: '',
    category: '',
    duration: '3 months',
    milestones: []
  };

  newRoadmap: any = {
    title: '',
    description: '',
    year: new Date().getFullYear()
  };

  newTask: Task = {
    title: '',
    description: '',
    completed: false,
    status: 'Not Started',
    priority: 'Medium'
  };

  mealLog: any = {
    meal_type: 'breakfast',
    description: '',
    calories: null
  };

  waterAmount = 250; // ml

  aiInput = '';
  aiMessages: any[] = [];

  // Challenge Templates (Generalized for normal people, not IT-focused)
  challengeTemplates = [
    { title: 'Healthy Eating', icon: '🥗', duration: 21, type: 'eating', description: 'Eat balanced, nutritious meals' },
    { title: 'Daily Meditation', icon: '🧘', duration: 30, type: 'meditation', description: '10 minutes of mindfulness daily' },
    { title: 'Morning Exercise', icon: '💪', duration: 21, type: 'exercise', description: '30 minutes of physical activity' },
    { title: 'No Social Media', icon: '📵', duration: 21, type: 'no-social', description: 'Digital detox challenge' },
    { title: 'Read Daily', icon: '📚', duration: 30, type: 'reading', description: 'Read for 30 minutes each day' },
    { title: 'Early Sleep', icon: '😴', duration: 21, type: 'sleep', description: 'Sleep by 10 PM every night' },
    { title: 'Save Money', icon: '💰', duration: 30, type: 'finance', description: 'Track and reduce expenses' },
    { title: 'Learn Something New', icon: '🎓', duration: 30, type: 'learning', description: 'Dedicate time to learning' },
    { title: 'Gratitude Journal', icon: '📝', duration: 21, type: 'journaling', description: 'Write 3 things you\'re grateful for' },
    { title: 'Drink More Water', icon: '💧', duration: 21, type: 'hydration', description: 'Drink 8 glasses daily' }
  ];

  // Project Categories (Generalized)
  projectCategories = [
    'Personal Development',
    'Health & Fitness',
    'Creative Projects',
    'Home Improvement',
    'Career Goals',
    'Relationships',
    'Financial Planning',
    'Travel & Adventure',
    'Learning & Education',
    'Community Service'
  ];

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private challengeService: ChallengeService,
    private dietService: DietService,
    private aiService: AIService,
    private gamificationService: GamificationService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    this.startWaterReminders();
    this.updateTime();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllData(): void {
    this.loadTasks();
    this.loadChallenges();
    this.loadProjects();
    this.loadDietData();
    this.loadUserStats();
  }

  // ==================== TASKS ====================
  loadTasks(): void {
    this.taskService.getTasks().pipe(takeUntil(this.destroy$)).subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading tasks:', error)
    });
  }

  addTask(): void {
    if (!this.newTask.title) return;

    this.taskService.createTask(this.newTask).pipe(takeUntil(this.destroy$)).subscribe({
      next: (task) => {
        this.tasks.push(task);
        this.showAddTaskModal = false;
        this.newTask = {
          title: '',
          description: '',
          completed: false,
          status: 'Not Started',
          priority: 'Medium'
        };
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error adding task:', error)
    });
  }

  toggleTask(task: Task): void {
    if (!task.id) return;

    const updatedTask = { ...task, completed: !task.completed };
    this.taskService.updateTask(task.id, updatedTask).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        task.completed = !task.completed;
        if (task.completed) {
          // Award XP for completing task
          this.gamificationService.addXP(50, 'Task completed').subscribe();
        }
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error updating task:', error)
    });
  }

  deleteTask(task: Task): void {
    if (!task.id || !confirm('Delete this task?')) return;

    this.taskService.deleteTask(task.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.tasks = this.tasks.filter(t => t.id !== task.id);
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error deleting task:', error)
    });
  }

  // ==================== CHALLENGES ====================
  loadChallenges(): void {
    this.challengeService.getChallenges().pipe(takeUntil(this.destroy$)).subscribe({
      next: (challenges) => {
        this.challenges = challenges;
        this.activeChallenges = challenges.filter((c: any) => c.is_active && !c.completed);
        this.completedChallenges = challenges.filter((c: any) => c.completed);
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading challenges:', error)
    });
  }

  startChallenge(template: any): void {
    const challenge = {
      title: template.title,
      description: template.description,
      duration: template.duration,
      challenge_type: template.type,
      icon: template.icon,
      xp_reward: template.duration === 30 ? 200 : 150
    };

    this.challengeService.createChallenge(challenge).pipe(takeUntil(this.destroy$)).subscribe({
      next: (newChallenge) => {
        this.challenges.push(newChallenge);
        this.activeChallenges.push(newChallenge);
        alert(`Started "${template.title}" challenge!`);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error starting challenge:', error);
        alert('Failed to start challenge');
      }
    });
  }

  createCustomChallenge(): void {
    if (!this.newChallenge.title || !this.newChallenge.duration) {
      alert('Please fill in all required fields');
      return;
    }

    if (this.newChallenge.duration < 21 || this.newChallenge.duration > 30) {
      alert('Challenge duration must be between 21-30 days');
      return;
    }

    this.challengeService.createChallenge(this.newChallenge).pipe(takeUntil(this.destroy$)).subscribe({
      next: (challenge) => {
        this.challenges.push(challenge);
        this.activeChallenges.push(challenge);
        this.showCustomChallengeModal = false;
        this.newChallenge = {
          title: '',
          description: '',
          duration: 21,
          challenge_type: '',
          icon: 'fas fa-trophy'
        };
        alert('Custom challenge created!');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error creating custom challenge:', error);
        alert('Failed to create challenge');
      }
    });
  }

  checkInChallenge(challenge: any): void {
    this.challengeService.checkIn(challenge.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updatedChallenge) => {
        // Update local challenge
        const index = this.challenges.findIndex((c: any) => c.id === challenge.id);
        if (index !== -1) {
          this.challenges[index] = updatedChallenge;
        }

        alert(`Checked in! Current streak: ${updatedChallenge.current_streak} days`);
        
        // Reload challenges to update UI
        this.loadChallenges();
        this.loadUserStats(); // Refresh stats if challenge completed
      },
      error: (error) => {
        if (error.status === 400) {
          alert('Cannot check in yet! You must wait 24 hours between check-ins.');
        } else {
          console.error('Check-in error:', error);
          alert('Failed to check in: ' + (error.error?.detail || 'Unknown error'));
        }
      }
    });
  }

  canCheckIn(challenge: any): boolean {
    if (!challenge.last_check_in) return true;
    
    const lastCheckIn = new Date(challenge.last_check_in);
    const now = new Date();
    const hoursSince = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60);
    
    return hoursSince >= 24;
  }

  getHoursUntilNextCheckIn(challenge: any): number {
    if (!challenge.last_check_in) return 0;
    
    const lastCheckIn = new Date(challenge.last_check_in);
    const now = new Date();
    const hoursSince = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60);
    
    return Math.max(0, 24 - hoursSince);
  }

  // ==================== PROJECTS ====================
  loadProjects(): void {
    // TODO: Implement project service and API calls
    console.log('Projects loading not yet implemented');
  }

  createProject(): void {
    console.log('Project creation not yet implemented');
  }

  // ==================== DIET & HYDRATION ====================
  loadDietData(): void {
    // Load diet preferences
    this.dietService.getPreferences().pipe(takeUntil(this.destroy$)).subscribe({
      next: (prefs) => {
        this.dietPreferences = prefs;
        this.loadMealPlan();
      },
      error: (error) => {
        if (error.status === 404) {
          // No preferences set yet
          this.dietPreferences = null;
        }
      }
    });

    // Load today's meals
    this.dietService.getMeals(1).pipe(takeUntil(this.destroy$)).subscribe({
      next: (meals) => {
        this.meals = meals;
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading meals:', error)
    });

    // Load today's water entries
    this.dietService.getWaterEntries(1).pipe(takeUntil(this.destroy$)).subscribe({
      next: (entries) => {
        this.waterEntries = entries;
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading water entries:', error)
    });
  }

  loadMealPlan(): void {
    this.dietService.getMealPlan().pipe(takeUntil(this.destroy$)).subscribe({
      next: (plan) => {
        this.mealPlan = plan;
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading meal plan:', error)
    });
  }

  setDietPreferences(preferences: any): void {
    this.dietService.setPreferences(preferences).pipe(takeUntil(this.destroy$)).subscribe({
      next: (prefs) => {
        this.dietPreferences = prefs;
        this.loadMealPlan();
        this.showDietPreferencesModal = false;
        alert('Diet preferences saved! AI will create your meal plan.');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error saving preferences:', error);
        alert('Failed to save preferences');
      }
    });
  }

  logMeal(): void {
    if (!this.mealLog.description) {
      alert('Please enter meal description');
      return;
    }

    this.dietService.logMeal(this.mealLog).pipe(takeUntil(this.destroy$)).subscribe({
      next: (meal) => {
        this.meals.push(meal);
        this.showMealLogModal = false;
        this.mealLog = {
          meal_type: 'breakfast',
          description: '',
          calories: null
        };
        alert('Meal logged successfully!');
        this.gamificationService.addXP(10, 'Meal logged').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (error.status === 400) {
          alert(`You have already logged ${this.mealLog.meal_type} for today!`);
        } else {
          console.error('Error logging meal:', error);
          alert('Failed to log meal');
        }
      }
    });
  }

  logWater(): void {
    this.dietService.logWater(this.waterAmount).pipe(takeUntil(this.destroy$)).subscribe({
      next: (entry) => {
        this.waterEntries.push(entry);
        alert(`Logged ${this.waterAmount}ml of water!`);
        this.gamificationService.addXP(5, 'Water logged').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error logging water:', error);
        alert('Failed to log water');
      }
    });
  }

  getTotalWaterToday(): number {
    const today = new Date().toDateString();
    return this.waterEntries
      .filter((e: any) => new Date(e.date).toDateString() === today)
      .reduce((sum: number, e: any) => sum + e.amount_ml, 0);
  }

  hasMealLoggedToday(mealType: string): boolean {
    const today = new Date().toDateString();
    return this.meals.some((m: any) => 
      m.meal_type === mealType && new Date(m.date).toDateString() === today
    );
  }

  // ==================== GAMIFICATION ====================
  loadUserStats(): void {
    this.gamificationService.getStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (stats) => {
        this.userStats = stats;
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading stats:', error)
    });
  }

  getXPProgress(): number {
    return (this.userStats.total_xp / this.userStats.xp_to_next_level) * 100;
  }

  // ==================== AI ASSISTANT ====================
  askAI(): void {
    if (!this.aiInput.trim()) return;

    const context = {
      level: this.userStats.level,
      active_challenges: this.activeChallenges.length,
      completed_tasks_today: this.tasks.filter(t => t.completed).length
    };

    this.aiService.askQuestion(this.aiInput, context).pipe(takeUntil(this.destroy$)).subscribe({
      next: (conversation) => {
        this.aiMessages.push({
          question: conversation.question,
          answer: conversation.answer,
          time: new Date()
        });
        this.aiInput = '';
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('AI error:', error);
        alert('Failed to get AI response');
      }
    });
  }

  // ==================== UTILITY ====================
  startWaterReminders(): void {
    this.notificationService.requestPermission();
    this.notificationService.startWaterReminders();
  }

  updateTime(): void {
    setInterval(() => {
      this.currentTime = new Date();
      this.cdr.markForCheck();
    }, 60000); // Update every minute
  }

  changeSection(section: any): void {
    this.activeSection = section;
    this.cdr.markForCheck();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }
}
