import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthenticatedNavbarComponent } from './pages/authenticated-navbar/authenticated-navbar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './shared/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    NavbarComponent, 
    AuthenticatedNavbarComponent,
    FooterComponent
  ],
  template: `
    <div class="app-wrapper">
      <!-- Regular navbar shown only when user is not logged in -->
      <app-navbar *ngIf="!isLoggedIn"></app-navbar>
      
      <!-- Authenticated navbar shown only when user is logged in -->
      <app-authenticated-navbar *ngIf="isLoggedIn"></app-authenticated-navbar>
      
      <!-- Main content area -->
      <main>
        <router-outlet></router-outlet>
      </main>
      
      <!-- Footer -->
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .app-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    main {
      flex: 1;
      min-height: calc(100vh - 60px - 200px); /* Adjust based on navbar and footer height */
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  private authSubscription?: Subscription;
  
  constructor(private authService: AuthService) {}
  
  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    
    this.authSubscription = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
    });
  }
  
  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
}