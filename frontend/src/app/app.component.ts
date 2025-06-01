import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthenticatedNavbarComponent } from './pages/authenticated-navbar/authenticated-navbar.component';
import { AuthService } from './shared/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, AuthenticatedNavbarComponent],
  template: `
    <!-- Regular navbar shown only when user is not logged in -->
    <app-navbar *ngIf="!isLoggedIn"></app-navbar>
    
    <!-- Authenticated navbar shown only when user is logged in -->
    <app-authenticated-navbar *ngIf="isLoggedIn"></app-authenticated-navbar>
    
    <!-- Main content area -->
    <main>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    main {
      min-height: calc(100vh - 60px); /* Adjust based on your navbar height */
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  private authSubscription?: Subscription;
  
  constructor(private authService: AuthService) {}
  
  ngOnInit() {
    // Check initial login status
    this.isLoggedIn = this.authService.isLoggedIn();
    
    // Subscribe to auth changes
    this.authSubscription = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
    });
  }
  
  ngOnDestroy() {
    // Clean up subscription
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
}