import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface AdminSession {
  is_admin: boolean;
  user: { id: number; username: string; email: string };
}

export interface AdminOverview {
  accounts: {
    total: number;
    active: number;
    inactive: number;
    verified: number;
    unverified: number;
    deleted: number;
    google: number;
    apple: number;
  };
  productivity: {
    tasks: number;
    todos: number;
    habits: number;
    challenges: number;
    active_timers: number;
    ai_requests_today: number;
  };
}

export interface AdminAccount {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  email_verified: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at?: string | null;
  last_active_at?: string | null;
  tasks_count: number;
  todos_count: number;
  habits_count: number;
  challenges_count: number;
  google_linked: number;
  apple_linked: number;
}

export interface DeletedAccount {
  id: number;
  original_user_id?: number | null;
  username: string;
  email: string;
  account_created_at?: string | null;
  deleted_at: string;
  deletion_reason: string;
}

export interface AdminHealth {
  backend: { status: string; version: string };
  database: { status: string; latency_ms: number; error?: string | null };
  ai: { status: string };
  email: { status: string };
  google_sign_in: { status: string };
  apple_sign_in: { status: string };
  uptime_seconds: number;
}

export interface ApiMetric {
  endpoint: string;
  requests: number;
  errors: number;
  average_ms: number;
  last_status?: number | null;
  last_seen?: string | null;
}

export interface AdminAiActivity {
  id: number;
  user_id: number;
  username: string;
  email: string;
  question: string;
  answer: string;
  executed_actions: Array<Record<string, unknown>>;
  created_at: string;
}

export interface AdminAuditLog {
  id: number;
  admin_user_id?: number | null;
  admin_username?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details: Record<string, unknown> | string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl = '/api/admin';

  constructor(private http: HttpClient, private auth: AuthService) {}

  session(): Observable<AdminSession> {
    return this.http.get<AdminSession>(`${this.apiUrl}/session`, { headers: this.headers() });
  }

  overview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${this.apiUrl}/overview`, { headers: this.headers() });
  }

  accounts(status = 'all'): Observable<AdminAccount[]> {
    return this.http.get<AdminAccount[]>(`${this.apiUrl}/accounts?status=${encodeURIComponent(status)}`, { headers: this.headers() });
  }

  deletedAccounts(): Observable<DeletedAccount[]> {
    return this.http.get<DeletedAccount[]>(`${this.apiUrl}/deleted-accounts`, { headers: this.headers() });
  }

  health(): Observable<AdminHealth> {
    return this.http.get<AdminHealth>(`${this.apiUrl}/health`, { headers: this.headers() });
  }

  apiMetrics(): Observable<ApiMetric[]> {
    return this.http.get<ApiMetric[]>(`${this.apiUrl}/api-metrics`, { headers: this.headers() });
  }

  aiActivity(): Observable<AdminAiActivity[]> {
    return this.http.get<AdminAiActivity[]>(`${this.apiUrl}/ai-activity`, { headers: this.headers() });
  }

  auditLogs(): Observable<AdminAuditLog[]> {
    return this.http.get<AdminAuditLog[]>(`${this.apiUrl}/audit-logs`, { headers: this.headers() });
  }

  suspendAccount(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/accounts/${userId}/suspend`, {}, { headers: this.headers() });
  }

  reactivateAccount(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/accounts/${userId}/reactivate`, {}, { headers: this.headers() });
  }

  forceLogout(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/accounts/${userId}/force-logout`, {}, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken() ?? ''}`,
      'Content-Type': 'application/json',
    });
  }
}
