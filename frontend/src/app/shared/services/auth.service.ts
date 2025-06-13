import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

interface User {
  id?: number;
  username: string;
  email?: string;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/auth';
  private userSubject = new BehaviorSubject<User | null>(null);

  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.checkAuthStatus();
  }

  private checkAuthStatus(): void {
    const token = this.getToken();
    const username = localStorage.getItem('username');

    // Check if token exists and is still valid
    if (token && username && this.isLoggedIn()) {
      this.userSubject.next({ username });
    } else {
      // Token is expired or invalid, clear local storage and subject, but DO NOT redirect
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('expires_at');
      localStorage.removeItem('userId');
      this.userSubject.next(null);
      // Do not call this.logout() or this.router.navigate here!
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((response) => {
          // Save email for username extraction if needed
          localStorage.setItem('userEmail', email);
          this.setSession(response);
        }),
        catchError(this.handleError),
      );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('userId');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  private setSession(authResult: AuthResponse): void {
    // Store token
    localStorage.setItem('token', authResult.access_token);

    let username: string;

    // If the API returns a user object with a username, use that
    if (authResult.user && authResult.user.username) {
      username = authResult.user.username;

      // Store user ID if available
      if (authResult.user.id) {
        localStorage.setItem('userId', authResult.user.id.toString());
      }
    } else {
      // Otherwise, extract username from email
      const email = localStorage.getItem('userEmail') || '';
      if (email && email.includes('@')) {
        username = email.split('@')[0];
        // Capitalize first letter for nicer display
        username = username.charAt(0).toUpperCase() + username.slice(1);
      } else {
        username = 'User';
      }
    }

    // Store username and update subject
    localStorage.setItem('username', username);
    this.userSubject.next({
      id: authResult.user?.id,
      username,
      email: localStorage.getItem('userEmail') || undefined,
    });

    // Set token expiration (2 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);
    localStorage.setItem('expires_at', expiresAt.toISOString());
  }

  isLoggedIn(): boolean {
    const expiresAt = localStorage.getItem('expires_at');
    const token = localStorage.getItem('token');
    if (!expiresAt || !token) return false;

    return new Date() < new Date(expiresAt);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUsername(): string | null {
    return localStorage.getItem('username');
  }

  getUserEmail(): string | null {
    return localStorage.getItem('userEmail');
  }

  getCurrentUser(): User | null {
    const username = this.getUsername();
    const email = this.getUserEmail();
    const userId = localStorage.getItem('userId');

    if (username) {
      return {
        id: userId ? parseInt(userId) : undefined,
        username,
        email: email || undefined,
      };
    }

    return null;
  }

  getUserId(): string | null {
    const user = this.getCurrentUser();
    if (user && user.id) {
      return user.id.toString();
    }

    // Fallback: create a consistent ID from email if no user ID available
    const email = this.getUserEmail();
    if (email) {
      return btoa(email)
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 10);
    }

    return null;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage =
        error.error?.detail ||
        `Error Code: ${error.status}, Message: ${error.message}`;
    }

    return throwError(() => new Error(errorMessage));
  }
}