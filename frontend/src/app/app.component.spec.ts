import { of } from 'rxjs';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './shared/services/auth.service';

describe('AppComponent', () => {
  function createComponent(loggedIn = false, url = '/'): AppComponent {
    const authService = {
      isLoggedIn: () => loggedIn,
      user$: of(loggedIn ? { id: 1, username: 'tester', email: 'tester@example.com' } : null),
    } as unknown as AuthService;
    const router = {
      url,
      events: of(),
    } as unknown as Router;

    return new AppComponent(authService, router);
  }

  it('should create the app', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('should initialize as logged out when there is no user', () => {
    const app = createComponent(false);
    app.ngOnInit();
    expect(app.isLoggedIn).toBe(false);
    app.ngOnDestroy();
  });

  it('should initialize as logged in when a user exists', () => {
    const app = createComponent(true);
    app.ngOnInit();
    expect(app.isLoggedIn).toBe(true);
    app.ngOnDestroy();
  });

  it('should identify admin routes so the public shell can stay hidden', () => {
    const app = createComponent(false, '/admin/login');
    app.ngOnInit();
    expect(app.isAdminRoute).toBe(true);
    app.ngOnDestroy();
  });
});
