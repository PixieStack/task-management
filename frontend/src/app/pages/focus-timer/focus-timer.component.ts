import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type TimerMode = 'focus' | 'short' | 'long';

interface StoredTimerState {
  mode?: TimerMode;
  minutes?: number;
  remaining?: number;
  running?: boolean;
  endAt?: number | null;
  completed?: number;
}

@Component({
  selector: 'app-focus-timer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './focus-timer.component.html',
  styleUrls: ['./focus-timer.component.scss'],
})
export class FocusTimerComponent implements OnInit, OnDestroy {
  mode: TimerMode = 'focus';
  minutes = 25;
  remainingSeconds = 25 * 60;
  running = false;
  endAt: number | null = null;
  completedSessions = 0;
  message = '';

  private clockInterval?: number;
  private readonly storageKey = 'focus_pomodoro';

  constructor(private changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.restore();
    this.clockInterval = window.setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) window.clearInterval(this.clockInterval);
  }

  setMode(mode: TimerMode): void {
    this.mode = mode;
    this.minutes = mode === 'focus' ? 25 : mode === 'short' ? 5 : 15;
    this.remainingSeconds = this.minutes * 60;
    this.running = false;
    this.endAt = null;
    this.message = '';
    this.save();
  }

  applyCustom(): void {
    this.minutes = Math.max(1, Math.min(Number(this.minutes) || 25, 180));
    this.remainingSeconds = this.minutes * 60;
    this.running = false;
    this.endAt = null;
    this.message = `Custom timer set for ${this.minutes} minute${this.minutes === 1 ? '' : 's'}.`;
    this.save();
  }

  toggle(): void {
    this.message = '';
    if (this.running) {
      this.running = false;
      this.endAt = null;
    } else {
      if (this.remainingSeconds <= 0) this.remainingSeconds = this.minutes * 60;
      this.running = true;
      this.endAt = Date.now() + this.remainingSeconds * 1000;
    }
    this.save();
  }

  reset(): void {
    this.running = false;
    this.endAt = null;
    this.remainingSeconds = this.minutes * 60;
    this.message = '';
    this.save();
  }

  display(): string {
    const minutes = Math.floor(this.remainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.remainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  get modeLabel(): string {
    return this.mode === 'focus' ? 'Focused work' : this.mode === 'short' ? 'Short break' : 'Long break';
  }

  private tick(): void {
    if (!this.running || !this.endAt) return;
    this.remainingSeconds = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
    if (this.remainingSeconds === 0) {
      this.running = false;
      this.endAt = null;
      if (this.mode === 'focus') this.completedSessions += 1;
      this.message = this.mode === 'focus' ? 'Focus session complete.' : 'Break complete.';
    }
    this.save();
    this.changeDetector.markForCheck();
  }

  private save(): void {
    localStorage.setItem(this.storageKey, JSON.stringify({
      mode: this.mode,
      minutes: this.minutes,
      remaining: this.remainingSeconds,
      running: this.running,
      endAt: this.endAt,
      completed: this.completedSessions,
    }));
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const state = JSON.parse(raw) as StoredTimerState;
      if (state.mode && ['focus', 'short', 'long'].includes(state.mode)) this.mode = state.mode;
      this.minutes = Math.max(1, Math.min(Number(state.minutes) || 25, 180));
      this.remainingSeconds = Math.max(0, Number(state.remaining) || this.minutes * 60);
      this.running = Boolean(state.running);
      this.endAt = state.endAt ? Number(state.endAt) : null;
      this.completedSessions = Math.max(0, Number(state.completed) || 0);
      if (this.running && this.endAt) {
        this.remainingSeconds = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
        if (this.remainingSeconds === 0) {
          this.running = false;
          this.endAt = null;
          if (this.mode === 'focus') this.completedSessions += 1;
          this.message = this.mode === 'focus' ? 'Focus session complete while you were away.' : 'Break complete.';
          this.save();
        }
      }
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }
}
