import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';

export interface User { id: number; username: string; email: string; first_name?: string; last_name?: string; created_at?: string; }
export interface AuthResponse { access_token: string; token_type: string; expires_in: number; user: User; }
export interface MessageResponse { message: string; }
export interface RegistrationResponse extends MessageResponse { email: string; }
export interface OAuthConfig { google_client_id?: string | null; apple_client_id?: string | null; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/auth';
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) { this.checkAuthStatus(); }

  register(data: { username: string; email: string; password: string }): Observable<RegistrationResponse> {
    return this.http.post<RegistrationResponse>(`${this.apiUrl}/register`, data).pipe(catchError((e) => this.handleError(e)));
  }
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(tap((r) => this.setSession(r)), catchError((e) => this.handleError(e)));
  }
  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/resend-verification`, { email }).pipe(catchError((e) => this.handleError(e)));
  }
  getOAuthConfig(): Observable<OAuthConfig> {
    return this.http.get<OAuthConfig>(`${this.apiUrl}/oauth/config`).pipe(catchError((e) => this.handleError(e)));
  }
  oauthLogin(provider: 'google' | 'apple', credential: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/oauth/login`, { provider, credential }).pipe(tap((r) => this.setSession(r)), catchError((e) => this.handleError(e)));
  }
  forgotPassword(email: string): Observable<MessageResponse> { return this.http.post<MessageResponse>(`${this.apiUrl}/forgot-password`, { email }).pipe(catchError((e) => this.handleError(e))); }
  resetPassword(token: string, newPassword: string): Observable<MessageResponse> { return this.http.post<MessageResponse>(`${this.apiUrl}/reset-password`, { token, new_password: newPassword }).pipe(catchError((e) => this.handleError(e))); }
  refresh(): Observable<AuthResponse> { return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {}, { headers: this.headers() }).pipe(tap((r) => this.setSession(r)), catchError((e) => this.handleError(e))); }
  getMe(): Observable<User> { return this.http.get<User>(`${this.apiUrl}/me`, { headers: this.headers() }).pipe(tap((u) => this.updateSessionUser(u)), catchError((e) => this.handleError(e))); }
  updateUser(data: { username?: string; first_name?: string; last_name?: string }): Observable<User> { return this.http.put<User>(`${this.apiUrl}/me`, data, { headers: this.headers() }).pipe(tap((u) => this.updateSessionUser(u)), catchError((e) => this.handleError(e))); }
  changePassword(currentPassword: string, newPassword: string): Observable<any> { return this.http.post(`${this.apiUrl}/change-password`, { current_password: currentPassword, new_password: newPassword }, { headers: this.headers() }).pipe(catchError((e) => this.handleError(e))); }
  changeEmail(newEmail: string, password: string): Observable<AuthResponse> { return this.http.post<AuthResponse>(`${this.apiUrl}/change-email`, { new_email: newEmail, password }, { headers: this.headers() }).pipe(tap((r) => this.setSession(r)), catchError((e) => this.handleError(e))); }
  deleteAccount(password: string, confirmPhrase: string): Observable<any> { return this.http.post(`${this.apiUrl}/delete-account`, { password, confirm_phrase: confirmPhrase }, { headers: this.headers() }).pipe(tap(() => this.clearSession()), catchError((e) => this.handleError(e))); }
  logout(): void { if (this.getToken()) this.http.post(`${this.apiUrl}/logout`, {}, { headers: this.headers() }).subscribe({ error: () => undefined }); this.clearSession(); this.router.navigate(['/login']); }
  isLoggedIn(): boolean { const token = this.getToken(); const expiresAt = localStorage.getItem('expires_at'); if (!token || !expiresAt) return false; const valid = Date.now() < new Date(expiresAt).getTime(); if (!valid) this.clearSession(); return valid; }
  getToken(): string | null { return localStorage.getItem('token'); }
  getUsername(): string | null { return localStorage.getItem('username'); }
  getUserEmail(): string | null { return localStorage.getItem('userEmail'); }
  getUserId(): string | null { return localStorage.getItem('userId'); }
  getCurrentUser(): User | null { return this.userSubject.value; }
  updateSessionUser(user: User): void { localStorage.setItem('username', user.username); localStorage.setItem('userEmail', user.email); localStorage.setItem('userId', String(user.id)); this.userSubject.next(user); }
  private setSession(result: AuthResponse): void { localStorage.setItem('token', result.access_token); localStorage.setItem('expires_at', new Date(Date.now() + result.expires_in * 1000).toISOString()); this.updateSessionUser(result.user); }
  private checkAuthStatus(): void { if (!this.isLoggedIn()) { this.clearSession(); return; } const id = Number(localStorage.getItem('userId')); const username = localStorage.getItem('username'); const email = localStorage.getItem('userEmail'); if (id && username && email) this.userSubject.next({ id, username, email }); }
  private clearSession(): void { ['token','username','userEmail','expires_at','userId'].forEach((k) => localStorage.removeItem(k)); this.userSubject.next(null); }
  private headers(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${this.getToken() ?? ''}`, 'Content-Type': 'application/json' }); }
  private handleError(error: HttpErrorResponse) { return throwError(() => new Error(error.error?.detail || error.error?.message || error.message || 'Request failed. Please try again.')); }
}
