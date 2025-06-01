import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-key-features',
  templateUrl: './key-features.component.html',
  styleUrls: ['./key-features.component.scss'],
  imports: [CommonModule],
})
export class KeyFeaturesComponent {
  features = [
    {
      title: 'Smart Inbox',
      icon: 'https://cdn-icons-png.flaticon.com/512/4712/4712107.png',
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
      icon: 'https://cdn-icons-png.flaticon.com/512/9736/9736253.png',
      description: 'Summarizes, reminds, and boosts your focus.',
    },
  ];

  taskCategories = [
    {
      icon: 'https://cdn-icons-png.flaticon.com/512/2665/2665696.png',
      title: 'Everyday Tasks',
      description: 'Grocery shopping, errands, cleaning, and other recurring tasks.',
    },
    {
      icon: 'https://cdn-icons-png.flaticon.com/512/2936/2936875.png',
      title: 'Timetable Reminders',
      description: 'Stay on top of school, university, or shift schedules.',
    },
    {
      icon: 'https://cdn-icons-png.flaticon.com/512/2983/2983781.png',
      title: 'Health & Fitness',
      description: 'Schedule workouts, meal planning, and water reminders.',
    },
    {
      icon: 'https://cdn-icons-png.flaticon.com/512/3771/3771461.png',
      title: 'Meetings & Work',
      description: 'Plan Zoom calls, deadlines, team tasks, and sprints.',
    },
  ];
}
