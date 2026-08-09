import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthenticatedNavbarComponent } from './pages/authenticated-navbar/authenticated-navbar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NavbarComponent,
    AuthenticatedNavbarComponent,
    FooterComponent,
  ],
  template: `
    <div class="app-wrapper" [class.admin-route]="isAdminRoute">
      <app-navbar *ngIf="!isAdminRoute && !isLoggedIn"></app-navbar>
      <app-authenticated-navbar *ngIf="!isAdminRoute && isLoggedIn"></app-authenticated-navbar>

      <main>
        <router-outlet></router-outlet>
      </main>

      <app-footer *ngIf="!isAdminRoute && !isLoggedIn"></app-footer>
    </div>
  `,
  styles: [
    `
      .app-wrapper {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      main {
        flex: 1;
        min-height: calc(100vh - 60px - 200px);
      }

      .admin-route main {
        min-height: 100vh;
      }
    `,
  ],
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

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.syncRoute(this.router.url);

    this.authSubscription = this.authService.user$.subscribe((user) => {
      this.isLoggedIn = !!user;
    });

    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncRoute(event.urlAfterRedirects));
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  private syncRoute(url: string): void {
    this.isAdminRoute = url === '/admin' || url.startsWith('/admin/');
  }
}
