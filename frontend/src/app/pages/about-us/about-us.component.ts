import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface AboutFeature {
  icon: string;
  title: string;
  description: string;
  accent: 'violet' | 'cyan' | 'amber' | 'green';
}

interface ProductPillar {
  number: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about-us.component.html',
  styleUrls: ['./about-us.component.scss'],
})
export class AboutUsComponent {
  readonly productFeatures: AboutFeature[] = [
    {
      icon: 'fa-wand-magic-sparkles',
      title: 'AI that takes action',
      description:
        'Ask the assistant to create tasks and daily todos, update your productivity data, or start and stop focus timers through validated backend actions.',
      accent: 'violet',
    },
    {
      icon: 'fa-bullseye',
      title: 'Daily focus workspace',
      description:
        'Plan today, work from a focused todo list, run a Pomodoro session, and see exactly where your time went without switching between apps.',
      accent: 'cyan',
    },
    {
      icon: 'fa-chart-line',
      title: 'Real progress, not busywork',
      description:
        'Tasks, habits, reading and meditation progress stay connected to your account so the dashboard reflects the work you actually completed.',
      accent: 'amber',
    },
    {
      icon: 'fa-laptop-mobile',
      title: 'One experience across devices',
      description:
        'Use the web app or install the native experience on supported desktop and mobile platforms while keeping the same account and data.',
      accent: 'green',
    },
  ];

  readonly pillars: ProductPillar[] = [
    {
      number: '01',
      title: 'Capture',
      description:
        'Turn ideas and responsibilities into clear tasks or daily actions before they disappear into notes and tabs.',
    },
    {
      number: '02',
      title: 'Focus',
      description:
        'Use priority, Pomodoro and persistent time tracking to stay on one meaningful piece of work at a time.',
    },
    {
      number: '03',
      title: 'Build consistency',
      description:
        'Keep habits, reading and meditation visible alongside work instead of treating personal progress as a separate system.',
    },
    {
      number: '04',
      title: 'Use AI intentionally',
      description:
        'The assistant can understand your current app data and perform a limited set of validated productivity actions on your behalf.',
    },
  ];

  readonly platformBadges = [
    'Web + PWA',
    'macOS Intel + Apple Silicon',
    'Windows x64 + ARM64',
    'Android',
    'iPhone + iPad',
  ];

  trackByTitle(_: number, item: { title: string }): string {
    return item.title;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }
}
