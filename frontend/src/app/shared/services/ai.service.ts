import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AIConversation {
  id: number;
  question: string;
  answer: string;
  context?: any;
  feedback?: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private apiUrl = '/api/ai';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  askQuestion(question: string, context?: any): Observable<AIConversation> {
    return this.http.post<AIConversation>(`${this.apiUrl}/ask`, 
      { question, context }, 
      { headers: this.getHeaders() }
    );
  }

  getConversations(limit: number = 20): Observable<AIConversation[]> {
    return this.http.get<AIConversation[]>(`${this.apiUrl}/conversations?limit=${limit}`, 
      { headers: this.getHeaders() }
    );
  }

  provideFeedback(conversationId: number, feedback: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/feedback`, 
      { conversation_id: conversationId, feedback }, 
      { headers: this.getHeaders() }
    );
  }
}
