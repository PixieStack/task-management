import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface AIConversation {
  id: number;
  question: string;
  answer: string;
  context?: any;
  feedback?: number;
  chat_id: string;
  created_at: string;
}

export interface AIFormOption { label: string; value: string; when?: string; }
export interface AIFormField {
  key: string;
  label: string;
  required: boolean;
  input_type: 'text' | 'textarea' | 'select' | 'date' | 'time' | 'number';
  placeholder?: string;
  options?: AIFormOption[];
  allow_custom?: boolean;
  depends_on?: string;
  show_when?: string;
  min?: number;
  max?: number;
}
export interface AIFormPrompt {
  workflow_type: string;
  title: string;
  description: string;
  fields: AIFormField[];
  values?: Record<string, string | number | null>;
  errors?: Record<string, string>;
}

export interface AIChat {
  chat_id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

export interface AIStatus {
  ready: boolean;
  model?: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private apiUrl = '/api/ai';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  askQuestion(question: string, chatId: string, context?: any): Observable<AIConversation> {
    return this.http.post<AIConversation>(`${this.apiUrl}/ask`,
      { question, chat_id: chatId, context },
      { headers: this.getHeaders() }
    ).pipe(catchError((error) => this.handleError(error)));
  }

  getConversations(chatId?: string, limit: number = 50): Observable<AIConversation[]> {
    const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}&limit=${limit}` : `?limit=${limit}`;
    return this.http.get<AIConversation[]>(`${this.apiUrl}/conversations${query}`,
      { headers: this.getHeaders() }
    ).pipe(catchError((error) => this.handleError(error)));
  }

  provideFeedback(conversationId: number, feedback: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/feedback`, 
      { conversation_id: conversationId, feedback }, 
      { headers: this.getHeaders() }
    ).pipe(catchError((error) => this.handleError(error)));
  }

  getChats(): Observable<AIChat[]> {
    return this.http.get<AIChat[]>(`${this.apiUrl}/chats`, { headers: this.getHeaders() })
      .pipe(catchError((error) => this.handleError(error)));
  }

  getStatus(): Observable<AIStatus> {
    return this.http.get<AIStatus>(`${this.apiUrl}/status`, { headers: this.getHeaders() })
      .pipe(catchError((error) => this.handleError(error)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const detail = error.error?.detail;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message || error.error?.message || 'The AI assistant could not respond. Please try again.';
    return throwError(() => new Error(message));
  }
}
