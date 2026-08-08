import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ChallengeType = 'meditation' | 'reading';
export interface Challenge { id: number; user_id: number; title: string; description?: string; duration: number; challenge_type: ChallengeType; start_date: string; current_streak: number; best_streak: number; last_check_in?: string; completed: boolean; icon: string; progress: number; is_active: boolean; created_at?: string; updated_at?: string; }
export interface ChallengeCreate { title: string; description?: string; duration: number; challenge_type: ChallengeType; icon?: string; }
@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private apiUrl = '/api/challenges'; constructor(private http: HttpClient) {}
  getChallenges(): Observable<Challenge[]> { return this.http.get<Challenge[]>(this.apiUrl, { headers: this.headers() }); }
  createChallenge(challenge: ChallengeCreate): Observable<Challenge> { return this.http.post<Challenge>(this.apiUrl, challenge, { headers: this.headers() }); }
  updateChallenge(id: number, challenge: Partial<Challenge>): Observable<Challenge> { return this.http.put<Challenge>(`${this.apiUrl}/${id}`, challenge, { headers: this.headers() }); }
  checkIn(id: number): Observable<Challenge> { return this.http.post<Challenge>(`${this.apiUrl}/check-in/${id}`, {}, { headers: this.headers() }); }
  deleteChallenge(id: number): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.headers() }); }
  private headers(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`, 'Content-Type': 'application/json' }); }
}
