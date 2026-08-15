import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { FooterComponent } from './shared/footer/footer.component';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { WorkspaceSidebarComponent } from './shared/components/workspace-sidebar/workspace-sidebar.component';
import { AuthService } from './shared/services/auth.service';
import { AppUpdateService, AppUpdateState } from './shared/services/app-update.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, WorkspaceSidebarComponent, FooterComponent],
  template: `
    <div class="app-wrapper" [class.admin-route]="isAdminRoute">
      <app-navbar *ngIf="!isAdminRoute && !isLoggedIn"></app-navbar>
      <app-workspace-sidebar *ngIf="!isAdminRoute && isLoggedIn"></app-workspace-sidebar>
      <aside class="update-banner" *ngIf="!isAdminRoute && isLoggedIn && updateState.updateAvailable" role="status">
        <i class="fas fa-cloud-arrow-down" aria-hidden="true"></i>
        <span><strong>App update available</strong> Version {{ updateState.latestVersion }} is ready for this device.</span>
        <a routerLink="/downloads">View update</a>
      </aside>
      <main [class.workspace-main]="!isAdminRoute && isLoggedIn">
        <router-outlet></router-outlet>
      </main>
      <app-footer *ngIf="!isAdminRoute && !isLoggedIn"></app-footer>
    </div>
  `,
  styles: [`
    .app-wrapper { display:flex; flex-direction:column; min-height:100vh; }
    main { flex:1; min-width:0; min-height:calc(100vh - 260px); }
    .workspace-main { margin-left:248px; min-height:100vh; background:var(--bg-0,#070b14); }
    .admin-route main { min-height:100vh; }
    .update-banner { position:fixed; z-index:850; top:14px; right:14px; width:min(430px,calc(100% - 28px)); display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.7rem; align-items:center; padding:.8rem .9rem; border:1px solid rgba(245,158,11,.28); border-radius:14px; color:#e8edf8; background:rgba(15,23,42,.97); box-shadow:0 18px 55px rgba(0,0,0,.4); }
    .update-banner i { color:#fbbf24; }
    .update-banner span { font-size:.78rem; line-height:1.4; }
    .update-banner strong { display:block; color:#fff; }
    .update-banner a { padding:.48rem .65rem; border-radius:9px; color:#fff; background:#7c3aed; font-size:.72rem; font-weight:800; text-decoration:none; }
    @media (max-width:900px) { .workspace-main { margin-left:0; } }
    @media (max-width:520px) { .update-banner { grid-template-columns:auto minmax(0,1fr); } .update-banner a { grid-column:1 / -1; text-align:center; } }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  isAdminRoute = false;
  updateState: AppUpdateState;
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private updateSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private appUpdate: AppUpdateService,
  ) {
    this.updateState = this.appUpdate.snapshot;
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.syncRoute(this.router.url);
    this.updateSubscription = this.appUpdate.state$.subscribe((state) => (this.updateState = state));
    void this.appUpdate.initialize();

    this.authSubscription = this.authService.user$.subscribe((user) => {
      this.isLoggedIn = !!user;
    });

    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncRoute(event.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.updateSubscription?.unsubscribe();
  }

  private syncRoute(url: string): void {
    this.isAdminRoute = url === '/admin' || url.startsWith('/admin/');
  }
}
