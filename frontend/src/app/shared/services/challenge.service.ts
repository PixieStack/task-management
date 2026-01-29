import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Challenge {
  id: number;
  user_id: number;
  title: string;
  description: string;
  duration: number;
  challenge_type: string;
  start_date: string;
  current_streak: number;
  best_streak: number;
  last_check_in?: string;
  completed: boolean;
  xp_reward: number;
  icon: string;
  progress: number;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private apiUrl = '/api/challenges';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getChallenges(): Observable<Challenge[]> {
    return this.http.get<Challenge[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getChallenge(id: number): Observable<Challenge> {
    return this.http.get<Challenge>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  createChallenge(challenge: Partial<Challenge>): Observable<Challenge> {
    return this.http.post<Challenge>(this.apiUrl, challenge, { headers: this.getHeaders() });
  }

  updateChallenge(id: number, challenge: Partial<Challenge>): Observable<Challenge> {
    return this.http.put<Challenge>(`${this.apiUrl}/${id}`, challenge, { headers: this.getHeaders() });
  }

  checkIn(id: number): Observable<Challenge> {
    return this.http.post<Challenge>(`${this.apiUrl}/check-in/${id}`, {}, { headers: this.getHeaders() });
  }

  deleteChallenge(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }
}
