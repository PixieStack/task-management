import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [CommonModule],
})
export class HomeComponent {
  user: { name: string } | null = null;

  features = [
    {
      title: 'AI Smart Capture',
      // Font Awesome equivalent for Inbox/Data
      icon: 'fas fa-inbox', 
      description: 'Your central hub. AI processes inputs from all sources to queue tasks instantly.',
    },
    {
      title: 'Dynamic Task Boards',
      // Font Awesome equivalent for Grid/Boards
      icon: 'fas fa-th-large', 
      description: 'Flexible Kanban-style layouts for visual workflow management and team syncing.',
    },
    {
      title: 'Time Matrix View',
      // Font Awesome equivalent for Calendar/Time
      icon: 'fas fa-clock', 
      description: 'A holistic calendar view that optimizes deadlines and flags scheduling conflicts.',
    },
    {
      title: 'Hyper-Focus Mode',
      // Font Awesome equivalent for Brain/AI
      icon: 'fas fa-brain', 
      description: 'The assistant auto-prioritizes your list, boosting concentration and productivity.',
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