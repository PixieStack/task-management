import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './shared/services/auth.service';

describe('AppComponent', () => {
  function createComponent(loggedIn = false): AppComponent {
    const authService = {
      isLoggedIn: () => loggedIn,
      user$: of(loggedIn ? { id: 1, username: 'tester', email: 'tester@example.com' } : null),
    } as unknown as AuthService;

    return new AppComponent(authService);
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
});
