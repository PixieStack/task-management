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
      title: 'Smart Inbox',
      icon: 'https://cdn-icons-png.flaticon.com/512/725/725643.png',
      description: 'AI captures and organizes your to-dos effortlessly.',
    },
    {
      title: 'Task Boards',
      icon: 'https://cdn-icons-png.flaticon.com/512/2866/2866450.png',
      description: 'Drag-and-drop boards for your daily workflow.',
    },
    {
      title: 'Calendar View',
      icon: 'https://cdn-icons-png.flaticon.com/512/1055/1055646.png',
      description: 'Visualize tasks on a built-in schedule view.',
    },
    {
      title: 'AI Assistant',
      icon: 'https://cdn-icons-png.flaticon.com/512/4712/4712107.png',
      description: 'Summarizes, reminds, and boosts your focus.',
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
