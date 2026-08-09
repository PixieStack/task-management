import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { WorkspaceSidebarComponent } from './shared/components/workspace-sidebar/workspace-sidebar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './shared/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, WorkspaceSidebarComponent, FooterComponent],
  template: `
    <div class="app-wrapper">
      <app-navbar *ngIf="!isLoggedIn"></app-navbar>
      <app-workspace-sidebar *ngIf="isLoggedIn"></app-workspace-sidebar>
      <main [class.workspace-main]="isLoggedIn">
        <router-outlet></router-outlet>
      </main>
      <app-footer *ngIf="!isLoggedIn"></app-footer>
    </div>
  `,
  styles: [`
    .app-wrapper { display:flex; flex-direction:column; min-height:100vh; }
    main { flex:1; min-width:0; min-height:calc(100vh - 260px); }
    .workspace-main { margin-left:248px; min-height:100vh; background:var(--bg-0,#070b14); }
    @media (max-width:900px) { .workspace-main { margin-left:0; } }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  private authSubscription?: Subscription;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.authSubscription = this.authService.user$.subscribe((user) => {
      this.isLoggedIn = !!user;
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }
}
