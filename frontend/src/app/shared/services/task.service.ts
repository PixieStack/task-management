import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

export interface Task {
  id?: number;
  title: string;
  description?: string;
  completed: boolean;
  status?: string;
  priority?: string;
  due_date?: string;
  tags?: string | string[];
  time_estimate?: number;
  time_spent?: number;
  created_at?: string;
  updated_at?: string;
  owner_id?: number;
}

export interface TaskCreate {
  title: string;
  description?: string;
  completed?: boolean;
  status?: string;
  priority?: string;
  due_date?: string;
  tags?: string[];
  time_estimate?: number;
  time_spent?: number;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  completed?: boolean;
  status?: string;
  priority?: string;
  due_date?: string;
  tags?: string[];
  time_estimate?: number;
  time_spent?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = 'http://localhost:8000/tasks';
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  public tasks$ = this.tasksSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  createTask(task: TaskCreate): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task, { headers: this.getHeaders() });
  }

  getTask(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  updateTask(id: number, task: TaskUpdate): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}`, task, { headers: this.getHeaders() });
  }

  deleteTask(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  // Local state management
  updateTasksState(tasks: Task[]) {
    this.tasksSubject.next(tasks);
  }

  addTaskToState(task: Task) {
    const currentTasks = this.tasksSubject.value;
    this.tasksSubject.next([...currentTasks, task]);
  }

  removeTaskFromState(taskId: number) {
    const currentTasks = this.tasksSubject.value;
    this.tasksSubject.next(currentTasks.filter(task => task.id !== taskId));
  }
}