import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-workspace-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './workspace-sidebar.component.html',
  styleUrls: ['./workspace-sidebar.component.scss'],
})
export class WorkspaceSidebarComponent implements OnInit, OnDestroy {
  user: User | null = null;
  currentUrl = '';

  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private readonly hashHandler = () => {
    this.currentUrl = `${window.location.pathname}${window.location.hash}`;
  };

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.currentUrl = this.router.url;
    this.userSubscription = this.authService.user$.subscribe((user) => (this.user = user));
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => (this.currentUrl = event.urlAfterRedirects));
    window.addEventListener('hashchange', this.hashHandler);
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    window.removeEventListener('hashchange', this.hashHandler);
  }

  isActive(path: string, fragment?: string): boolean {
    const currentPath = this.currentUrl.split('#')[0].split('?')[0];
    const currentFragment = this.currentUrl.includes('#') ? this.currentUrl.split('#')[1] : '';
    if (currentPath !== path) return false;
    if (fragment) return currentFragment === fragment;
    return !currentFragment || (path === '/focus' && !['todos', 'pomodoro', 'task-timers'].includes(currentFragment));
  }

  get initials(): string {
    const username = this.user?.username?.trim() || 'User';
    return username.slice(0, 2).toUpperCase();
  }

  logout(): void {
    this.authService.logout();
  }
}
