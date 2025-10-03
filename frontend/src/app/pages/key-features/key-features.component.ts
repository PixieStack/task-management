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
  // MAIN 8 FEATURES
  mainFeatures = [
    {
      icon: 'fas fa-calendar-check',
      title: '21-30 Day Challenges',
      description: 'Transform your life with eating/fasting, no-social-media, productivity, meditation, coding, and reading challenges.',
      gradient: 'challenge-gradient'
    },
    {
      icon: 'fas fa-project-diagram',
      title: '3-6 Month Projects',
      description: 'Build AI projects, data dashboards, apps, or launch a side business with structured milestone tracking.',
      gradient: 'project-gradient'
    },
    {
      icon: 'fas fa-road',
      title: '12 Month Roadmaps',
      description: 'Long-term professional development, startup launch plans, and quarterly goal tracking for major achievements.',
      gradient: 'roadmap-gradient'
    },
    {
      icon: 'fas fa-utensils',
      title: 'Smart Diet Management',
      description: 'Time-based meal suggestions, hunger tracking, and hydration reminders. Last meal by 6 PM with AI motivation.',
      gradient: 'diet-gradient'
    },
    {
      icon: 'fas fa-chart-line',
      title: 'Habit Analytics',
      description: 'Track daily habits, weekly progress, monthly summaries, and correlate mood/energy with your activities.',
      gradient: 'analytics-gradient'
    },
    {
      icon: 'fas fa-robot',
      title: 'AI-Powered Assistant',
      description: 'Get personalized recommendations, automated tracking, weekly summaries, and optimization suggestions.',
      gradient: 'ai-gradient'
    },
    {
      icon: 'fas fa-trophy',
      title: 'Gamification System',
      description: 'Earn XP, unlock badges, level up from beginner to expert, and compete on optional leaderboards.',
      gradient: 'gamification-gradient'
    },
    {
      icon: 'fas fa-mobile-alt',
      title: 'Cross-Platform Support',
      description: 'Available on Mac, Windows, Android, and iOS with offline mode and seamless data sync across devices.',
      gradient: 'platform-gradient'
    }
  ];

  // CHALLENGE TYPES (21-30 Days) - Updated with 4 more
  challengeTypes = [
    { icon: 'fas fa-hamburger', name: 'Eating/Fasting', duration: '21 days' },
    { icon: 'fas fa-ban', name: 'No Social Media', duration: '21 days' },
    { icon: 'fas fa-tasks', name: 'Productivity', duration: '30 days' },
    { icon: 'fas fa-om', name: 'Meditation', duration: '21 days' },
    { icon: 'fas fa-code', name: 'Daily Coding', duration: '30 days' },
    { icon: 'fas fa-book', name: 'Reading Challenge', duration: '30 days' },
    { icon: 'fas fa-dumbbell', name: 'Daily Exercise', duration: '30 days' },
    { icon: 'fas fa-bed', name: 'Sleep Optimization', duration: '21 days' },
    { icon: 'fas fa-money-bill', name: 'Financial Discipline', duration: '30 days' },
    { icon: 'fas fa-language', name: 'Language Learning', duration: '30 days' }
  ];

  // PROJECT TYPES (3-12 Months)
  projectTypes = [
    { icon: 'fas fa-brain', name: 'AI/ML Projects', duration: '3-12 months' },
    { icon: 'fas fa-chart-bar', name: 'Data Dashboards', duration: '3-6 months' },
    { icon: 'fas fa-mobile', name: 'App Development', duration: '6 months' },
    { icon: 'fas fa-briefcase', name: 'Business Launch', duration: '6-12 months' }
  ];

  // DIET FEATURES
  dietFeatures = [
    { time: 'Before 4 PM', suggestion: 'Healthy snacks, fruits, water' },
    { time: '4-6 PM', suggestion: 'Last meal window reminder' },
    { time: 'After 6 PM', suggestion: 'Water & herbal tea only' }
  ];

  // GAMIFICATION ELEMENTS
  gamificationElements = [
    { icon: 'fas fa-star', name: 'XP Points' },
    { icon: 'fas fa-medal', name: 'Achievement Badges' },
    { icon: 'fas fa-level-up-alt', name: 'Level Progression' },
    { icon: 'fas fa-fire', name: 'Streak Tracking' }
  ];
}