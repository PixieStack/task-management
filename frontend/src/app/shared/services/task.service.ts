import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Task { id?: number; title: string; description?: string; completed: boolean; status: 'Not Started' | 'In Progress' | 'Pending' | 'Completed'; priority: 'Low' | 'Medium' | 'High'; due_date?: string; tags: string[]; time_estimate: number; time_spent: number; created_at?: string; updated_at?: string; owner_id?: number; }
export type TaskCreate = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'owner_id'>;
export type TaskUpdate = Partial<TaskCreate>;
@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = '/api/tasks';
  constructor(private http: HttpClient, private authService: AuthService) {}
  getTasks(): Observable<Task[]> { return this.http.get<Task[]>(this.apiUrl, { headers: this.headers() }); }
  createTask(task: TaskCreate): Observable<Task> { return this.http.post<Task>(this.apiUrl, task, { headers: this.headers() }); }
  updateTask(id: number, task: TaskUpdate): Observable<Task> { return this.http.put<Task>(`${this.apiUrl}/${id}`, task, { headers: this.headers() }); }
  deleteTask(id: number): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.headers() }); }
  private headers(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${this.authService.getToken() ?? ''}`, 'Content-Type': 'application/json' }); }
}
