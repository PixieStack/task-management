import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  detail: string;
  accent: 'violet' | 'cyan' | 'amber' | 'green' | 'rose' | 'blue';
}

@Component({
  standalone: true,
  selector: 'app-key-features',
  templateUrl: './key-features.component.html',
  styleUrls: ['./key-features.component.scss'],
  imports: [CommonModule, RouterModule],
})
export class KeyFeaturesComponent {
  readonly mainFeatures: FeatureItem[] = [
    {
      icon: 'fas fa-list-check',
      title: 'Tasks that stay practical',
      description: 'Create, prioritize, schedule, complete and track the work that matters.',
      detail: 'Priorities, due dates, tags, status, estimates and persistent tracked time are all part of the same task record.',
      accent: 'blue',
    },
    {
      icon: 'fas fa-sparkles',
      title: 'Action-capable AI assistant',
      description: 'Ask for help in natural language and let the assistant perform approved productivity actions.',
      detail: 'It can work with tasks, daily todos, habits, challenges and timers through validated FastAPI actions.',
      accent: 'violet',
    },
    {
      icon: 'fas fa-calendar-day',
      title: 'Daily Todos',
      description: 'Keep today separate from your larger task backlog and focus on what should happen now.',
      detail: 'Daily todos support priority, notes, completion and individual time tracking.',
      accent: 'cyan',
    },
    {
      icon: 'fas fa-stopwatch',
      title: 'Persistent time tracking',
      description: 'Start a timer on a task or todo and keep the running session even after a refresh.',
      detail: 'Tracked time is saved to your account so you can see how long each item actually took.',
      accent: 'amber',
    },
    {
      icon: 'fas fa-clock',
      title: 'Pomodoro focus',
      description: 'Run focused study/work intervals with short breaks, long breaks or a custom duration.',
      detail: 'The Focus workspace combines Pomodoro with your daily list and running task timer.',
      accent: 'rose',
    },
    {
      icon: 'fas fa-repeat',
      title: 'Habit tracking',
      description: 'Create daily or weekly habits, check in and build visible consistency over time.',
      detail: 'Habit history stays connected to your account instead of being stored only in the browser.',
      accent: 'green',
    },
    {
      icon: 'fas fa-book-open-reader',
      title: 'Reading challenges',
      description: 'Create a focused reading commitment and track progress one check-in at a time.',
      detail: 'Reading remains intentionally simple so it supports your routine without turning into another complex project system.',
      accent: 'blue',
    },
    {
      icon: 'fas fa-spa',
      title: 'Meditation challenges',
      description: 'Build a consistent meditation practice alongside your work and study goals.',
      detail: 'Daily check-ins, streaks and progress keep the challenge visible without distracting from your main workflow.',
      accent: 'violet',
    },
    {
      icon: 'fas fa-laptop-mobile',
      title: 'Cross-platform experience',
      description: 'Use the web/PWA experience and supported native builds across desktop and mobile.',
      detail: 'The same FastAPI backend and account data serve web, macOS, Windows, Android and iOS targets.',
      accent: 'cyan',
    },
  ];

  readonly focusFlow = [
    { step: '01', title: 'Capture', text: 'Add the task, habit or daily action before it becomes mental clutter.' },
    { step: '02', title: 'Choose', text: 'Use priority and today’s list to decide what deserves attention now.' },
    { step: '03', title: 'Focus', text: 'Start Pomodoro or a task timer and stay with one meaningful action.' },
    { step: '04', title: 'Review', text: 'Complete the item and keep your real progress and tracked time visible.' },
  ];

  trackByTitle(_: number, item: { title: string }): string {
    return item.title;
  }
}
