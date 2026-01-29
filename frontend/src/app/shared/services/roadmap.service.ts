import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Roadmap {
  id?: number;
  user_id?: number;
  title: string;
  description?: string;
  year: number;
  start_date?: string;
  end_date?: string;
  q1_date?: string;
  q1_accomplishments?: string[];
  q1_conclusion?: string;
  q2_date?: string;
  q2_accomplishments?: string[];
  q2_conclusion?: string;
  q3_date?: string;
  q3_accomplishments?: string[];
  q3_conclusion?: string;
  q4_date?: string;
  q4_accomplishments?: string[];
  q4_conclusion?: string;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoadmapService {
  private apiUrl = '/api/roadmaps';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getRoadmaps(includeArchived: boolean = false): Observable<Roadmap[]> {
    return this.http.get<Roadmap[]>(`${this.apiUrl}?include_archived=${includeArchived}`, 
      { headers: this.getHeaders() });
  }

  getRoadmap(id: number): Observable<Roadmap> {
    return this.http.get<Roadmap>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  createRoadmap(roadmap: Partial<Roadmap>): Observable<Roadmap> {
    return this.http.post<Roadmap>(this.apiUrl, roadmap, { headers: this.getHeaders() });
  }

  updateQuarterlyCheckIn(id: number, data: Partial<Roadmap>): Observable<Roadmap> {
    return this.http.put<Roadmap>(`${this.apiUrl}/${id}/quarterly-checkin`, data, { headers: this.getHeaders() });
  }

  archiveRoadmap(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/archive`, {}, { headers: this.getHeaders() });
  }

  deleteRoadmap(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }
}
