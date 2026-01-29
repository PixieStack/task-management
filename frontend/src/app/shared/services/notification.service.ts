import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private permission: NotificationPermission = 'default';
  private waterReminderInterval: any;

  constructor() {
    this.requestPermission();
  }

  async requestPermission(): Promise<void> {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission();
    }
  }

  showNotification(title: string, body: string, icon?: string): void {
    if (this.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/assets/logo.png',
        badge: '/assets/logo.png'
      });
    }
  }

  startWaterReminders(): void {
    // Clear any existing interval
    this.stopWaterReminders();

    // Check current time
    const checkAndNotify = () => {
      const now = new Date();
      const hour = now.getHours();

      // Only send reminders between 8 AM and 10 PM
      if (hour >= 8 && hour < 22) {
        this.showNotification(
          '💧 Time to Hydrate!',
          'Remember to drink water. Stay healthy and hydrated!'
        );
      }
    };

    // Check immediately
    checkAndNotify();

    // Set up hourly reminders
    this.waterReminderInterval = setInterval(checkAndNotify, 60 * 60 * 1000); // Every hour
  }

  stopWaterReminders(): void {
    if (this.waterReminderInterval) {
      clearInterval(this.waterReminderInterval);
      this.waterReminderInterval = null;
    }
  }

  sendChallengeReminder(challengeName: string): void {
    this.showNotification(
      '🎯 Challenge Check-in',
      `Don't forget to check in to your "${challengeName}" challenge today!`
    );
  }

  sendLevelUpNotification(newLevel: number): void {
    this.showNotification(
      '🎉 Level Up!',
      `Congratulations! You've reached Level ${newLevel}!`
    );
  }

  sendBadgeEarnedNotification(badgeName: string): void {
    this.showNotification(
      '🏆 Badge Earned!',
      `You've unlocked the "${badgeName}" badge!`
    );
  }
}
