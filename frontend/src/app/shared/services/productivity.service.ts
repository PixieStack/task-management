import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export type ProductivityPriority = 'Low' | 'Medium' | 'High';
export type TimedItemType = 'task' | 'todo';

export interface DailyTodo {
  id: number;
  user_id: number;
  title: string;
  notes?: string;
  todo_date: string;
  completed: boolean;
  priority: ProductivityPriority;
  time_spent_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface DailyTodoCreate {
  title: string;
  notes?: string;
  todo_date: string;
  completed?: boolean;
  priority?: ProductivityPriority;
}

export interface TimeSession {
  id: number;
  user_id: number;
  item_type: TimedItemType;
  task_id?: number;
  todo_id?: number;
  started_at: string;
  ended_at?: string;
  elapsed_seconds: number;
  live_elapsed_seconds: number;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ProductivityService {
  private apiUrl = '/api/productivity';

  constructor(private http: HttpClient, private authService: AuthService) {}

  getTodos(todoDate?: string, includeCompleted = true): Observable<DailyTodo[]> {
    const params = new URLSearchParams();
    if (todoDate) params.set('todo_date', todoDate);
    params.set('include_completed', String(includeCompleted));
    return this.http.get<DailyTodo[]>(`${this.apiUrl}/todos?${params.toString()}`, {
      headers: this.headers(),
    });
  }

  createTodo(todo: DailyTodoCreate): Observable<DailyTodo> {
    return this.http.post<DailyTodo>(`${this.apiUrl}/todos`, todo, {
      headers: this.headers(),
    });
  }

  updateTodo(id: number, update: Partial<DailyTodoCreate>): Observable<DailyTodo> {
    return this.http.put<DailyTodo>(`${this.apiUrl}/todos/${id}`, update, {
      headers: this.headers(),
    });
  }

  deleteTodo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/todos/${id}`, {
      headers: this.headers(),
    });
  }

  startTimer(itemType: TimedItemType, itemId: number): Observable<TimeSession> {
    return this.http.post<TimeSession>(
      `${this.apiUrl}/timer/start`,
      { item_type: itemType, item_id: itemId },
      { headers: this.headers() },
    );
  }

  stopTimer(): Observable<TimeSession> {
    return this.http.post<TimeSession>(`${this.apiUrl}/timer/stop`, {}, {
      headers: this.headers(),
    });
  }

  getActiveTimer(): Observable<TimeSession | null> {
    return this.http.get<TimeSession | null>(`${this.apiUrl}/timer/active`, {
      headers: this.headers(),
    });
  }

  getSessions(limit = 50): Observable<TimeSession[]> {
    return this.http.get<TimeSession[]>(`${this.apiUrl}/timer/sessions?limit=${limit}`, {
      headers: this.headers(),
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken() ?? ''}`,
      'Content-Type': 'application/json',
    });
  }
}
