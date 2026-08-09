import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [CommonModule, RouterModule],
})
export class HomeComponent {
  user: { name: string } | null = null;

  readonly features = [
    {
      title: 'Plan clearly',
      icon: 'fas fa-list-check',
      description: 'Tasks, priorities, due dates and daily todos keep your next actions visible without unnecessary project complexity.',
    },
    {
      title: 'Focus deeply',
      icon: 'fas fa-stopwatch',
      description: 'Pomodoro and persistent task/todo timers help you stay with the work and understand where your time actually goes.',
    },
    {
      title: 'Build consistency',
      icon: 'fas fa-repeat',
      description: 'Track habits plus reading and meditation challenges alongside the work you need to finish.',
    },
    {
      title: 'Use AI to act',
      icon: 'fas fa-wand-magic-sparkles',
      description: 'Ask naturally and let the assistant perform approved productivity actions through a controlled backend action layer.',
    },
  ];

  constructor(private router: Router) {
    const userData = localStorage.getItem('user');
    this.user = userData ? JSON.parse(userData) : null;
  }

  onGetStarted(): void {
    this.router.navigate(['/register']);
  }
}
