import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';

export interface User { id: number; username: string; email: string; first_name?: string; last_name?: string; created_at?: string; }
export interface AuthResponse { access_token: string; token_type: string; expires_in: number; user: User; }
export interface MessageResponse { message: string; }
export interface RegistrationResponse extends MessageResponse { email: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/auth';
  private userSubject = new BehaviorSubject<User | null>(null);
  private readonly sessionKeys = ['token', 'username', 'userEmail', 'expires_at', 'userId'];
  private readonly rememberFlag = 'remember_session';
  private readonly rememberedEmailKey = 'remembered_email';
  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.restoreRememberedSession();
    this.checkAuthStatus();
  }

  register(data: { username: string; email: string; password: string }): Observable<RegistrationResponse> {
    return this.http.post<RegistrationResponse>(`${this.apiUrl}/register`, data).pipe(catchError((e) => this.handleError(e)));
  }
  login(email: string, password: string, rememberMe = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl + '/login', {
      email,
      password,
      remember_me: rememberMe,
    }).pipe(
      tap((result) => this.setSession(result, rememberMe)),
      catchError((error) => this.handleError(error)),
    );
  }
  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/resend-verification`, { email }).pipe(catchError((e) => this.handleError(e)));
  }
  forgotPassword(email: string): Observable<MessageResponse> { return this.http.post<MessageResponse>(`${this.apiUrl}/forgot-password`, { email }).pipe(catchError((e) => this.handleError(e))); }
  resetPassword(token: string, newPassword: string): Observable<MessageResponse> { return this.http.post<MessageResponse>(`${this.apiUrl}/reset-password`, { token, new_password: newPassword }).pipe(catchError((e) => this.handleError(e))); }
  refresh(): Observable<AuthResponse> { return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {}, { headers: this.headers() }).pipe(tap((r) => this.setSession(r, this.shouldRemember())), catchError((e) => this.handleError(e))); }
  getMe(): Observable<User> { return this.http.get<User>(`${this.apiUrl}/me`, { headers: this.headers() }).pipe(tap((u) => this.updateSessionUser(u)), catchError((e) => this.handleError(e))); }
  updateUser(data: { username?: string; first_name?: string; last_name?: string }): Observable<User> { return this.http.put<User>(`${this.apiUrl}/me`, data, { headers: this.headers() }).pipe(tap((u) => this.updateSessionUser(u)), catchError((e) => this.handleError(e))); }
  changePassword(currentPassword: string, newPassword: string): Observable<any> { return this.http.post(`${this.apiUrl}/change-password`, { current_password: currentPassword, new_password: newPassword }, { headers: this.headers() }).pipe(catchError((e) => this.handleError(e))); }
  changeEmail(newEmail: string, password: string): Observable<AuthResponse> { return this.http.post<AuthResponse>(`${this.apiUrl}/change-email`, { new_email: newEmail, password }, { headers: this.headers() }).pipe(tap((r) => this.setSession(r, this.shouldRemember())), catchError((e) => this.handleError(e))); }
  deleteAccount(password: string, confirmPhrase: string): Observable<any> { return this.http.post(`${this.apiUrl}/delete-account`, { password, confirm_phrase: confirmPhrase }, { headers: this.headers() }).pipe(tap(() => this.clearSession()), catchError((e) => this.handleError(e))); }
  logout(): void {
    const token = this.getToken();
    const headers = this.headers();
    if (token) this.http.post(`${this.apiUrl}/logout`, {}, { headers }).subscribe({ error: () => undefined });
    this.clearSession();
    void this.router.navigateByUrl('/access', { replaceUrl: true });
  }
  isLoggedIn(): boolean {
    const token = this.getToken();
    const expiresAt = sessionStorage.getItem('expires_at');
    if (!token || !expiresAt) return false;
    const valid = Date.now() < new Date(expiresAt).getTime();
    if (!valid) this.clearSession();
    return valid;
  }

  getToken(): string | null { return sessionStorage.getItem('token'); }
  getUsername(): string | null { return sessionStorage.getItem('username'); }
  getUserEmail(): string | null { return sessionStorage.getItem('userEmail'); }
  getUserId(): string | null { return sessionStorage.getItem('userId'); }
  getCurrentUser(): User | null { return this.userSubject.value; }
  getRememberedEmail(): string { return localStorage.getItem(this.rememberedEmailKey) || ''; }
  shouldRemember(): boolean { return localStorage.getItem(this.rememberFlag) === 'true'; }

  updateSessionUser(user: User): void {
    const values: Record<string, string> = {
      username: user.username,
      userEmail: user.email,
      userId: String(user.id),
    };
    Object.entries(values).forEach(([key, value]) => sessionStorage.setItem(key, value));
    if (this.shouldRemember()) {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      localStorage.setItem(this.rememberedEmailKey, user.email);
    }
    this.userSubject.next(user);
  }

  invalidateSession(): void { this.clearSession(); }

  private setSession(result: AuthResponse, rememberMe = this.shouldRemember()): void {
    const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();
    sessionStorage.setItem('token', result.access_token);
    sessionStorage.setItem('expires_at', expiresAt);

    if (rememberMe) {
      localStorage.setItem(this.rememberFlag, 'true');
      localStorage.setItem(this.rememberedEmailKey, result.user.email);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('expires_at', expiresAt);
    } else {
      this.clearPersistentSession();
    }
    this.updateSessionUser(result.user);
  }

  private restoreRememberedSession(): void {
    if (!this.shouldRemember()) return;
    this.sessionKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) sessionStorage.setItem(key, value);
    });
  }

  private checkAuthStatus(): void {
    if (!this.isLoggedIn()) {
      this.clearSession();
      return;
    }
    const id = Number(sessionStorage.getItem('userId'));
    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('userEmail');
    if (id && username && email) this.userSubject.next({ id, username, email });
  }

  private clearPersistentSession(): void {
    this.sessionKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(this.rememberFlag);
    localStorage.removeItem(this.rememberedEmailKey);
  }

  private clearSession(): void {
    this.sessionKeys.forEach((key) => sessionStorage.removeItem(key));
    this.clearPersistentSession();
    this.userSubject.next(null);
  }

  private headers(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${this.getToken() ?? ''}`, 'Content-Type': 'application/json' }); }
  private handleError(error: HttpErrorResponse) { return throwError(() => new Error(error.error?.detail || error.error?.message || error.message || 'Request failed. Please try again.')); }
}
