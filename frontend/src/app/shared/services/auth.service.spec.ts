import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthResponse, AuthService } from './auth.service';

describe('AuthService', () => {
  const response: AuthResponse = {
    access_token: 'remembered-token',
    token_type: 'bearer',
    expires_in: 30 * 24 * 60 * 60,
    user: { id: 7, username: 'Remembered User', email: 'remembered@example.com' },
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists and restores an authenticated session when Remember me is selected', () => {
    const http = {
      post: vi.fn().mockReturnValue(of(response)),
    } as unknown as HttpClient;
    const router = { navigateByUrl: vi.fn() } as unknown as Router;
    const service = new AuthService(http, router);

    service.login('remembered@example.com', 'StrongPassword1!', true).subscribe();

    expect(http.post).toHaveBeenCalledWith('/auth/login', {
      email: 'remembered@example.com',
      password: 'StrongPassword1!',
      remember_me: true,
    });
    expect(localStorage.getItem('remember_session')).toBe('true');
    expect(localStorage.getItem('remembered_email')).toBe('remembered@example.com');
    expect(localStorage.getItem('token')).toBe('remembered-token');

    sessionStorage.clear();
    const restored = new AuthService(http, router);

    expect(restored.isLoggedIn()).toBe(true);
    expect(restored.getToken()).toBe('remembered-token');
    expect(restored.getCurrentUser()?.email).toBe('remembered@example.com');
  });

  it('keeps a normal login limited to the current browser session', () => {
    const http = {
      post: vi.fn().mockReturnValue(of(response)),
    } as unknown as HttpClient;
    const router = { navigateByUrl: vi.fn() } as unknown as Router;
    const service = new AuthService(http, router);

    service.login('session@example.com', 'StrongPassword1!', false).subscribe();

    expect(sessionStorage.getItem('token')).toBe('remembered-token');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('remember_session')).toBeNull();
  });
});
