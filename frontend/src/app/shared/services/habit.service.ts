import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Habit { id?: number; user_id?: number; name: string; description?: string; category?: string; frequency: 'daily' | 'weekly'; target_count: number; duration_days: number; last_check_in_at?: string; completed: boolean; completed_at?: string; archived_at?: string; check_in_count: number; remaining_check_ins: number; progress: number; next_check_in_at?: string; can_check_in: boolean; completion_review_required: boolean; icon?: string; color?: string; created_at?: string; }
export interface HabitEntry { id?: number; habit_id: number; user_id?: number; date: string; completed: boolean; count: number; mood?: number; energy?: number; notes?: string; created_at?: string; }
export interface HabitCheckInResult { habit: Habit; entry: HabitEntry; review_required: boolean; completion_email_queued: boolean; }
export interface HabitCompletionReviewResult { habit: Habit; completed_now: boolean; completion_email_queued: boolean; }
@Injectable({ providedIn: 'root' })
export class HabitService {
  private apiUrl = '/api/habits'; constructor(private http: HttpClient) {}
  getHabits(): Observable<Habit[]> { return this.http.get<Habit[]>(this.apiUrl, { headers: this.headers() }); }
  createHabit(habit: Partial<Habit>): Observable<Habit> { return this.http.post<Habit>(this.apiUrl, habit, { headers: this.headers() }); }
  updateHabit(id: number, habit: Partial<Habit>): Observable<Habit> { return this.http.put<Habit>(`${this.apiUrl}/${id}`, habit, { headers: this.headers() }); }
  deleteHabit(id: number): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.headers() }); }
  checkIn(id: number): Observable<HabitCheckInResult> { return this.http.post<HabitCheckInResult>(`${this.apiUrl}/${id}/check-in`, {}, { headers: this.headers() }); }
  reviewCompletion(id: number, established: boolean, additionalDays?: number): Observable<HabitCompletionReviewResult> { return this.http.post<HabitCompletionReviewResult>(`${this.apiUrl}/${id}/completion-review`, { established, additional_days: additionalDays }, { headers: this.headers() }); }
  createHabitEntry(entry: Partial<HabitEntry>): Observable<HabitEntry> { return this.http.post<HabitEntry>(`${this.apiUrl}/entries`, entry, { headers: this.headers() }); }
  getHabitEntries(habitId?: number, days = 30): Observable<HabitEntry[]> { let url = `${this.apiUrl}/entries?days=${days}`; if (habitId) url += `&habit_id=${habitId}`; return this.http.get<HabitEntry[]>(url, { headers: this.headers() }); }
  private headers(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') ?? ''}`, 'Content-Type': 'application/json' }); }
}
