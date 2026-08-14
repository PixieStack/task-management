import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ProjectStatus = 'in_progress' | 'under_review' | 'complete';

export interface Project {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  category: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  archived_at?: string;
}

export interface ProjectCreate {
  title: string;
  description: string;
  category: string;
}

export interface ProjectCategory {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly apiUrl = '/api/projects';

  constructor(private http: HttpClient) {}

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl, { headers: this.headers() });
  }

  createProject(project: ProjectCreate): Observable<Project> {
    return this.http.post<Project>(this.apiUrl, project, { headers: this.headers() });
  }

  updateProject(id: number, project: Partial<Project>): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/${id}`, project, { headers: this.headers() });
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.headers() });
  }

  getCategories(): Observable<ProjectCategory[]> {
    return this.http.get<ProjectCategory[]>(`${this.apiUrl}/categories`, { headers: this.headers() });
  }

  createCategory(name: string): Observable<ProjectCategory> {
    return this.http.post<ProjectCategory>(`${this.apiUrl}/categories`, { name }, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${sessionStorage.getItem('token') ?? ''}`,
      'Content-Type': 'application/json',
    });
  }
}
