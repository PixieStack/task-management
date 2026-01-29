import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserProfile {
  id?: number;
  user_id?: number;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  gender?: string;
  date_of_birth?: string;
  occupation?: string;
  company?: string;
  bio?: string;
  profile_picture?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private apiUrl = '/auth';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`, { headers: this.getHeaders() });
  }

  updateProfile(profile: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.apiUrl}/profile`, profile, { headers: this.getHeaders() });
  }

  updateUser(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/update-user`, data, { headers: this.getHeaders() });
  }

  uploadProfilePicture(imageBase64: string): Observable<UserProfile> {
    return this.updateProfile({ profile_picture: imageBase64 });
  }
}
