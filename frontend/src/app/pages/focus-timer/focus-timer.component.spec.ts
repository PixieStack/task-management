import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FocusTimerComponent } from './focus-timer.component';

describe('FocusTimerComponent', () => {
  let fixture: ComponentFixture<FocusTimerComponent>;

  beforeEach(async () => {
    localStorage.removeItem('focus_pomodoro');
    await TestBed.configureTestingModule({ imports: [FocusTimerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FocusTimerComponent);
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem('focus_pomodoro');
  });

  it('sets a custom local countdown without a data service', () => {
    const component = fixture.componentInstance;
    component.minutes = 12;
    component.applyCustom();

    expect(component.display()).toBe('12:00');
    expect(JSON.parse(localStorage.getItem('focus_pomodoro') || '{}').remaining).toBe(720);
  });

  it('persists running state for refresh restoration', () => {
    const component = fixture.componentInstance;
    component.minutes = 1;
    component.applyCustom();
    component.toggle();

    const state = JSON.parse(localStorage.getItem('focus_pomodoro') || '{}');
    expect(state.running).toBe(true);
    expect(state.endAt).toBeGreaterThan(Date.now());
  });
});
