import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';

interface AboutFeature {
  icon: string;
  title: string;
  description: string;
  accent: 'violet' | 'cyan' | 'amber' | 'green';
}

interface ProductPillar {
  title: string;
  description: string;
}

interface TechnologyStackItem {
  name: string;
  description: string;
}

interface TrustLayer {
  key: 'you' | 'assistant' | 'safety';
  label: string;
  icon: string;
  title: string;
  description: string;
  points: string[];
}

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about-us.component.html',
  styleUrls: ['./about-us.component.scss'],
})
export class AboutUsComponent {
  showTechnologyStack = false;
  activeTrustKey: TrustLayer['key'] = 'you';

  readonly trustLayers: TrustLayer[] = [
    { key: 'you', label: 'You lead', icon: 'fa-user-astronaut', title: 'Your intention starts everything.', description: 'You decide what matters, what changes and when work is complete. The product is designed to amplify your choices.', points: ['Plain-language requests', 'Visible progress', 'Full account control'] },
    { key: 'assistant', label: 'AI assists', icon: 'fa-wand-magic-sparkles', title: 'AI removes friction—not ownership.', description: 'The assistant understands your request and can perform a limited set of productivity actions after the app validates them.', points: ['Account-scoped context', 'Validated actions', 'Clear results'] },
    { key: 'safety', label: 'Safety holds', icon: 'fa-shield-halved', title: 'Sensitive decisions stay manual.', description: 'Passwords, email changes and account deletion remain protected workflows that the assistant cannot silently perform.', points: ['Secure sessions', 'Email verification', 'Protected credentials'] },
  ];

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
        'Tasks, habits, reading and project progress stay connected to your account so the dashboard reflects the work you actually completed.',
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
      title: 'Capture',
      description:
        'Turn ideas and responsibilities into clear tasks or daily actions before they disappear into notes and tabs.',
    },
    {
      title: 'Focus',
      description:
        'Use priority, Pomodoro and persistent time tracking to stay on one meaningful piece of work at a time.',
    },
    {
      title: 'Build consistency',
      description:
        'Keep habits, reading and projects visible alongside work instead of treating personal progress as a separate system.',
    },
    {
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

  readonly technologyStack: TechnologyStackItem[] = [
    {
      name: 'Frontend',
      description: 'Angular 22, TypeScript 6, SCSS, RxJS, Chart.js and Font Awesome',
    },
    {
      name: 'Backend',
      description: 'Python 3.14, FastAPI, Pydantic and Uvicorn',
    },
    {
      name: 'Database',
      description: 'Supabase-hosted PostgreSQL with SQLAlchemy 2 and psycopg',
    },
    {
      name: 'Authentication',
      description: 'JWT sessions, bcrypt password hashing, email verification and secure password recovery',
    },
    {
      name: 'AI assistant',
      description: 'Groq chat completions with validated, account-scoped productivity actions',
    },
    {
      name: 'Email',
      description: 'Brevo SMTP for verification, password reset and account-security messages',
    },
    {
      name: 'Apps & tooling',
      description: 'Angular PWA, Tauri 2, npm, Angular CLI, Vitest, Playwright and GitHub Actions',
    },
  ];

  openTechnologyStack(): void {
    this.showTechnologyStack = true;
  }

  closeTechnologyStack(): void {
    this.showTechnologyStack = false;
  }

  get activeTrustLayer(): TrustLayer {
    return this.trustLayers.find((layer) => layer.key === this.activeTrustKey) || this.trustLayers[0];
  }

  @HostListener('document:keydown.escape')
  closeTechnologyStackOnEscape(): void {
    this.closeTechnologyStack();
  }

  trackByTitle(_: number, item: { title: string }): string {
    return item.title;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }

  trackByStackName(_: number, item: TechnologyStackItem): string {
    return item.name;
  }
}
