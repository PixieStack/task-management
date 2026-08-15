import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps completed workspace items out of active tabs', () => {
    component.tasks = [
      { id: 1, title: 'Active task', completed: false },
      { id: 2, title: 'Completed task', completed: true },
    ] as any;
    component.habits = [
      { id: 1, name: 'Active habit', completed: false, completed_at: null },
      { id: 2, name: 'Completed habit', completed: true, completed_at: '2026-08-09T07:00:00' },
    ] as any;
    component.challenges = [
      { id: 1, title: 'Active challenge', completed: false, is_active: true },
      { id: 2, title: 'Completed challenge', completed: true, is_active: false },
    ] as any;

    expect(component.filteredTasks.map((item) => item.title)).toEqual(['Active task']);
    expect(component.filteredHabits.map((item) => item.name)).toEqual(['Active habit']);
    expect(component.filteredChallenges.map((item) => item.title)).toEqual(['Active challenge']);

    component.taskFilter = 'completed';
    component.habitFilter = 'completed';
    component.challengeFilter = 'completed';
    expect(component.filteredTasks.map((item) => item.title)).toEqual(['Completed task']);
    expect(component.filteredHabits.map((item) => item.name)).toEqual(['Completed habit']);
    expect(component.filteredChallenges.map((item) => item.title)).toEqual(['Completed challenge']);
  });

  it('keeps custom project categories personal and reusable in the project form', () => {
    component.projectCategories = [
      { id: 7, user_id: 42, name: 'Event Planning', created_at: '2026-08-09T10:00:00Z' },
    ];

    expect(component.availableProjectCategories).toContain('Software Development');
    expect(component.availableProjectCategories).toContain('Event Planning');
    expect(component.projectStatusLabel('under_review')).toBe('Under review');
  });

  it('separates active and completed projects', () => {
    component.projects = [
      { id: 1, title: 'Active project', status: 'in_progress' },
      { id: 2, title: 'Completed project', status: 'complete' },
    ] as any;

    expect(component.filteredProjects.map((item) => item.title)).toEqual(['Active project']);
    expect(component.activeProjects).toBe(1);
    component.projectFilter = 'completed';
    expect(component.filteredProjects.map((item) => item.title)).toEqual(['Completed project']);
    expect(component.completedProjects).toBe(1);
  });

  it('offers only the active project lifecycle and opens AI-created items in the right workspace', () => {
    expect(component.projectStatuses.map((item) => item.value)).toEqual([
      'in_progress',
      'under_review',
      'complete',
    ]);
    expect(component.aiActionRoute({ type: 'create_task' })).toBe('/dashboard#tasks');
    expect(component.aiActionRoute({ type: 'create_todo' })).toBe('/todo');
    expect(component.aiActionRoute({ type: 'create_habit' })).toBe('/dashboard#habits');
    expect(component.aiActionRoute({ type: 'create_project' })).toBe('/dashboard#challenges');
    expect(component.aiActionRoute({ type: 'open_focus_timer' })).toBeNull();
    component.taskFilter = 'completed';
    component.taskSearch = 'hidden';
    component.taskPriorityFilter = 'High';
    component.openAIAction({ type: 'create_task', id: 21 });
    expect(component.taskFilter).toBe('active');
    expect(component.taskSearch).toBe('');
    expect(component.taskPriorityFilter).toBe('all');
  });

  it('shows archived items only in their archive and applies search filters', () => {
    component.tasks = [
      { id: 1, title: 'Write launch copy', description: 'Website', completed: false, priority: 'High' },
      { id: 2, title: 'Old report', completed: true, priority: 'Low', archived_at: '2026-08-09T10:00:00Z' },
    ] as any;

    expect(component.archivedTasks).toBe(1);
    expect(component.filteredTasks.map((item) => item.title)).toEqual(['Write launch copy']);
    component.taskSearch = 'launch';
    component.taskPriorityFilter = 'High';
    expect(component.filteredTasks.map((item) => item.title)).toEqual(['Write launch copy']);
    component.taskFilter = 'archived';
    component.taskSearch = '';
    component.taskPriorityFilter = 'all';
    expect(component.filteredTasks.map((item) => item.title)).toEqual(['Old report']);
  });
});
