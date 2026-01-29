import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Habit {
  id?: number;
  user_id?: number;
  name: string;
  description?: string;
  category?: string;
  frequency?: string;
  target_count?: number;
  icon?: string;
  color?: string;
  created_at?: string;
}

export interface HabitEntry {
  id?: number;
  habit_id: number;
  user_id?: number;
  date: string;
  completed?: boolean;
  count?: number;
  mood?: number;
  energy?: number;
  notes?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  private apiUrl = '/api/habits';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getHabits(): Observable<Habit[]> {
    return this.http.get<Habit[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  createHabit(habit: Partial<Habit>): Observable<Habit> {
    return this.http.post<Habit>(this.apiUrl, habit, { headers: this.getHeaders() });
  }

  deleteHabit(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  createHabitEntry(entry: Partial<HabitEntry>): Observable<HabitEntry> {
    return this.http.post<HabitEntry>(`${this.apiUrl}/entries`, entry, { headers: this.getHeaders() });
  }

  getHabitEntries(habitId?: number, days: number = 30): Observable<HabitEntry[]> {
    let url = `${this.apiUrl}/entries?days=${days}`;
    if (habitId) {
      url += `&habit_id=${habitId}`;
    }
    return this.http.get<HabitEntry[]>(url, { headers: this.getHeaders() });
  }
}
