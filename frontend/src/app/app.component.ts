import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { WorkspaceSidebarComponent } from './shared/components/workspace-sidebar/workspace-sidebar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, WorkspaceSidebarComponent, FooterComponent],
  template: `
    <div class="app-wrapper" [class.admin-route]="isAdminRoute">
      <app-navbar *ngIf="!isAdminRoute && !isLoggedIn"></app-navbar>
      <app-workspace-sidebar *ngIf="!isAdminRoute && isLoggedIn"></app-workspace-sidebar>
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
    @media (max-width:900px) { .workspace-main { margin-left:0; } }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  isAdminRoute = false;
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.syncRoute(this.router.url);

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
  }

  private syncRoute(url: string): void {
    this.isAdminRoute = url === '/admin' || url.startsWith('/admin/');
  }
}
