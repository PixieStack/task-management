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
import { ProjectService, Project } from '../../shared/services/project.service';
import { RoadmapService, Roadmap } from '../../shared/services/roadmap.service';
import { HabitService, Habit, HabitEntry } from '../../shared/services/habit.service';
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
  projects: Project[] = [];
  activeProjects: Project[] = [];
  archivedProjects: Project[] = [];
  roadmaps: Roadmap[] = [];
  activeRoadmaps: Roadmap[] = [];
  archivedRoadmaps: Roadmap[] = [];
  habits: Habit[] = [];
  habitEntries: HabitEntry[] = [];
  todaysHabits: any[] = [];
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
  showAddHabitModal = false;
  showAddTaskModal = false;
  showDietModal = false;
  showDietPreferencesModal = false;
  showAiAssistant = false;
  showCustomChallengeModal = false;
  showMealLogModal = false;
  showQuarterlyCheckInModal = false;
  showHabitEntryModal = false;
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

  selectedRoadmap: Roadmap | null = null;
  quarterlyCheckIn: any = {
    quarter: 1,
    accomplishments: [''],
    conclusion: ''
  };

  newHabit: Partial<Habit> = {
    name: '',
    description: '',
    category: '',
    frequency: 'daily',
    target_count: 1,
    icon: '✓',
    color: '#3498db'
  };

  newHabitEntry: Partial<HabitEntry> = {
    habit_id: 0,
    date: new Date().toISOString(),
    completed: false,
    count: 1,
    mood: 3,
    energy: 3,
    notes: ''
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
    private projectService: ProjectService,
    private roadmapService: RoadmapService,
    private habitService: HabitService,
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
    this.loadRoadmaps();
    this.loadHabits();
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
    this.projectService.getProjects(false).pipe(takeUntil(this.destroy$)).subscribe({
      next: (projects) => {
        this.projects = projects;
        this.activeProjects = projects.filter(p => !p.is_archived);
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading projects:', error)
    });

    this.projectService.getProjects(true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (projects) => {
        this.archivedProjects = projects.filter(p => p.is_archived);
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading archived projects:', error)
    });
  }

  createProject(): void {
    if (!this.newProject.title || !this.newProject.duration) {
      alert('Please fill in required fields');
      return;
    }

    this.projectService.createProject(this.newProject).pipe(takeUntil(this.destroy$)).subscribe({
      next: (project) => {
        this.projects.push(project);
        this.activeProjects.push(project);
        this.showAddProjectModal = false;
        this.newProject = {
          title: '',
          description: '',
          category: '',
          duration: '3 months',
          milestones: []
        };
        alert('Project created successfully!');
        this.gamificationService.addXP(100, 'Project created').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error creating project:', error);
        alert('Failed to create project');
      }
    });
  }

  updateProjectProgress(project: Project, newProgress: number): void {
    if (!project.id) return;

    this.projectService.updateProject(project.id, { progress: newProgress }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const index = this.projects.findIndex(p => p.id === project.id);
        if (index !== -1) {
          this.projects[index] = updated;
        }
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error updating project:', error)
    });
  }

  archiveProject(project: Project): void {
    if (!project.id || !confirm('Archive this project?')) return;

    this.projectService.archiveProject(project.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.activeProjects = this.activeProjects.filter(p => p.id !== project.id);
        if (project.progress === 100) {
          this.gamificationService.addXP(500, 'Project completed').subscribe();
        }
        alert('Project archived!');
        this.loadProjects();
      },
      error: (error) => {
        console.error('Error archiving project:', error);
        alert('Failed to archive project');
      }
    });
  }

  deleteProject(project: Project): void {
    if (!project.id || !confirm('Delete this project permanently?')) return;

    this.projectService.deleteProject(project.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.projects = this.projects.filter(p => p.id !== project.id);
        this.activeProjects = this.activeProjects.filter(p => p.id !== project.id);
        alert('Project deleted!');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error deleting project:', error);
        alert('Failed to delete project');
      }
    });
  }

  // ==================== ROADMAPS ====================
  loadRoadmaps(): void {
    this.roadmapService.getRoadmaps(false).pipe(takeUntil(this.destroy$)).subscribe({
      next: (roadmaps) => {
        this.roadmaps = roadmaps;
        this.activeRoadmaps = roadmaps.filter(r => !r.is_archived);
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading roadmaps:', error)
    });

    this.roadmapService.getRoadmaps(true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (roadmaps) => {
        this.archivedRoadmaps = roadmaps.filter(r => r.is_archived);
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading archived roadmaps:', error)
    });
  }

  createRoadmap(): void {
    if (!this.newRoadmap.title) {
      alert('Please enter a title');
      return;
    }

    this.roadmapService.createRoadmap(this.newRoadmap).pipe(takeUntil(this.destroy$)).subscribe({
      next: (roadmap) => {
        this.roadmaps.push(roadmap);
        this.activeRoadmaps.push(roadmap);
        this.showAddRoadmapModal = false;
        this.newRoadmap = {
          title: '',
          description: '',
          year: new Date().getFullYear()
        };
        alert('Roadmap created successfully!');
        this.gamificationService.addXP(150, 'Roadmap created').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (error.status === 400 && error.error?.detail?.includes('3 active roadmaps')) {
          alert('You can only have 3 active roadmaps per year. Please archive one first.');
        } else {
          console.error('Error creating roadmap:', error);
          alert('Failed to create roadmap');
        }
      }
    });
  }

  openQuarterlyCheckIn(roadmap: Roadmap, quarter: number): void {
    this.selectedRoadmap = roadmap;
    this.quarterlyCheckIn = {
      quarter: quarter,
      accomplishments: [''],
      conclusion: ''
    };
    this.showQuarterlyCheckInModal = true;
  }

  addAccomplishment(): void {
    this.quarterlyCheckIn.accomplishments.push('');
  }

  removeAccomplishment(index: number): void {
    this.quarterlyCheckIn.accomplishments.splice(index, 1);
  }

  submitQuarterlyCheckIn(): void {
    if (!this.selectedRoadmap || !this.selectedRoadmap.id) return;

    // Validate conclusion word count (100-500 words)
    const wordCount = this.quarterlyCheckIn.conclusion.trim().split(/\s+/).length;
    if (wordCount < 100 || wordCount > 500) {
      alert(`Conclusion must be between 100-500 words. Current: ${wordCount} words.`);
      return;
    }

    // Remove empty accomplishments
    const accomplishments = this.quarterlyCheckIn.accomplishments.filter((a: string) => a.trim() !== '');
    if (accomplishments.length === 0) {
      alert('Please add at least one accomplishment');
      return;
    }

    const quarter = this.quarterlyCheckIn.quarter;
    const updateData: any = {};
    updateData[`q${quarter}_date`] = new Date().toISOString();
    updateData[`q${quarter}_accomplishments`] = accomplishments;
    updateData[`q${quarter}_conclusion`] = this.quarterlyCheckIn.conclusion;

    this.roadmapService.updateQuarterlyCheckIn(this.selectedRoadmap.id, updateData).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        const index = this.roadmaps.findIndex(r => r.id === this.selectedRoadmap?.id);
        if (index !== -1) {
          this.roadmaps[index] = updated;
        }
        this.showQuarterlyCheckInModal = false;
        this.selectedRoadmap = null;
        alert('Quarterly check-in submitted successfully!');
        this.gamificationService.addXP(200, 'Quarterly check-in').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (error.status === 400) {
          alert(error.error?.detail || 'Cannot check in yet. Must wait 3 months between check-ins.');
        } else {
          console.error('Error submitting check-in:', error);
          alert('Failed to submit check-in');
        }
      }
    });
  }

  canCheckInQuarter(roadmap: Roadmap, quarter: number): boolean {
    const quarterDateField = `q${quarter}_date` as keyof Roadmap;
    const lastCheckIn = roadmap[quarterDateField];
    
    if (!lastCheckIn) return true;
    
    const lastDate = new Date(lastCheckIn as string);
    const now = new Date();
    const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSince >= 90; // 3 months ≈ 90 days
  }

  archiveRoadmap(roadmap: Roadmap): void {
    if (!roadmap.id || !confirm('Archive this roadmap?')) return;

    this.roadmapService.archiveRoadmap(roadmap.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.activeRoadmaps = this.activeRoadmaps.filter(r => r.id !== roadmap.id);
        alert('Roadmap archived!');
        this.loadRoadmaps();
      },
      error: (error) => {
        console.error('Error archiving roadmap:', error);
        alert('Failed to archive roadmap');
      }
    });
  }

  deleteRoadmap(roadmap: Roadmap): void {
    if (!roadmap.id || !confirm('Delete this roadmap permanently?')) return;

    this.roadmapService.deleteRoadmap(roadmap.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.roadmaps = this.roadmaps.filter(r => r.id !== roadmap.id);
        this.activeRoadmaps = this.activeRoadmaps.filter(r => r.id !== roadmap.id);
        alert('Roadmap deleted!');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error deleting roadmap:', error);
        alert('Failed to delete roadmap');
      }
    });
  }

  // ==================== HABITS ====================
  loadHabits(): void {
    this.habitService.getHabits().pipe(takeUntil(this.destroy$)).subscribe({
      next: (habits) => {
        this.habits = habits;
        this.loadHabitEntries();
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading habits:', error)
    });
  }

  loadHabitEntries(): void {
    this.habitService.getHabitEntries(undefined, 7).pipe(takeUntil(this.destroy$)).subscribe({
      next: (entries) => {
        this.habitEntries = entries;
        this.prepareTodaysHabits();
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error loading habit entries:', error)
    });
  }

  prepareTodaysHabits(): void {
    const today = new Date().toDateString();
    this.todaysHabits = this.habits.map(habit => {
      const todayEntry = this.habitEntries.find(e => 
        e.habit_id === habit.id && new Date(e.date).toDateString() === today
      );
      return {
        ...habit,
        todayEntry: todayEntry,
        completed: todayEntry?.completed || false
      };
    });
  }

  createHabit(): void {
    if (!this.newHabit.name) {
      alert('Please enter a habit name');
      return;
    }

    this.habitService.createHabit(this.newHabit).pipe(takeUntil(this.destroy$)).subscribe({
      next: (habit) => {
        this.habits.push(habit);
        this.showAddHabitModal = false;
        this.newHabit = {
          name: '',
          description: '',
          category: '',
          frequency: 'daily',
          target_count: 1,
          icon: '✓',
          color: '#3498db'
        };
        alert('Habit created successfully!');
        this.prepareTodaysHabits();
        this.gamificationService.addXP(50, 'Habit created').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error creating habit:', error);
        alert('Failed to create habit');
      }
    });
  }

  logHabitEntry(habit: any): void {
    const entry: Partial<HabitEntry> = {
      habit_id: habit.id,
      date: new Date().toISOString(),
      completed: true,
      count: 1
    };

    this.habitService.createHabitEntry(entry).pipe(takeUntil(this.destroy$)).subscribe({
      next: (newEntry) => {
        this.habitEntries.push(newEntry);
        habit.completed = true;
        habit.todayEntry = newEntry;
        alert('Habit logged!');
        this.gamificationService.addXP(20, 'Habit completed').subscribe();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error logging habit:', error);
        alert('Failed to log habit');
      }
    });
  }

  deleteHabit(habit: Habit): void {
    if (!habit.id || !confirm('Delete this habit?')) return;

    this.habitService.deleteHabit(habit.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.habits = this.habits.filter(h => h.id !== habit.id);
        this.prepareTodaysHabits();
        alert('Habit deleted!');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error deleting habit:', error);
        alert('Failed to delete habit');
      }
    });
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
