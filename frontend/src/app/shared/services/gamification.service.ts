import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserStatistics {
  id: number;
  user_id: number;
  level: number;
  total_xp: number;
  xp_to_next_level: number;
  challenges_completed: number;
  projects_completed: number;
  current_streak: number;
  best_streak: number;
  badges: any[];
  rank: string;
}

@Injectable({
  providedIn: 'root'
})
export class GamificationService {
  private apiUrl = '/api/gamification';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getStats(): Observable<UserStatistics> {
    return this.http.get<UserStatistics>(`${this.apiUrl}/stats`, { headers: this.getHeaders() });
  }

  addXP(amount: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/xp`, 
      { amount, reason }, 
      { headers: this.getHeaders() }
    );
  }

  getBadges(): Observable<any> {
    return this.http.get(`${this.apiUrl}/badges`, { headers: this.getHeaders() });
  }
}
