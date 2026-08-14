import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FocusComponent } from './focus.component';
import { apiTimestampMilliseconds } from '../../shared/services/productivity.service';

describe('FocusComponent', () => {
  let fixture: ComponentFixture<FocusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocusComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FocusComponent);
  });

  afterEach(() => fixture.destroy());

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('treats backend timestamps without an offset as UTC', () => {
    expect(apiTimestampMilliseconds('2026-08-09T06:00:00')).toBe(
      Date.parse('2026-08-09T06:00:00Z'),
    );
  });

  it('shows a running timer in hours, minutes and consecutive seconds', () => {
    const component = fixture.componentInstance;
    expect(component.formatRunningDuration(0)).toBe('0h 00m 00s');
    expect(component.formatRunningDuration(1)).toBe('0h 00m 01s');
    expect(component.formatRunningDuration(2)).toBe('0h 00m 02s');
    expect(component.formatRunningDuration(3)).toBe('0h 00m 03s');
    expect(component.formatRunningDuration(61)).toBe('0h 01m 01s');
    expect(component.formatRunningDuration(3661)).toBe('1h 01m 01s');
  });

  it('separates active and completed todos', () => {
    const component = fixture.componentInstance;
    component.todos = [
      { id: 1, title: 'Active todo', completed: false },
      { id: 2, title: 'Completed todo', completed: true },
    ] as any;

    expect(component.filteredTodos.map((item) => item.title)).toEqual(['Active todo']);
    component.todoFilter = 'completed';
    expect(component.filteredTodos.map((item) => item.title)).toEqual(['Completed todo']);
  });

  it('keeps archived todos in a searchable archive view', () => {
    const component = fixture.componentInstance;
    component.todos = [
      { id: 1, title: 'Call supplier', completed: false, priority: 'High' },
      { id: 2, title: 'Old notes', completed: true, priority: 'Low', archived_at: '2026-08-09T10:00:00Z' },
    ] as any;

    expect(component.archivedTodos).toBe(1);
    component.todoFilter = 'archived';
    component.todoSearch = 'notes';
    component.todoPriorityFilter = 'Low';
    expect(component.filteredTodos.map((item) => item.title)).toEqual(['Old notes']);
  });
});
