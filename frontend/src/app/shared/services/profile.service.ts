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
    const token = sessionStorage.getItem('token');
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

  prepareProfilePicture(file: File): Promise<string> {
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!supportedTypes.includes(file.type.toLowerCase())) {
      return Promise.reject(new Error('Choose a PNG, JPG, or WebP image.'));
    }
    if (file.size > 8 * 1024 * 1024) {
      return Promise.reject(new Error('Profile picture must be smaller than 8 MB.'));
    }

    return this.readFile(file).then((source) => new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error('The selected image could not be opened.'));
      image.onload = () => {
        try {
          const maxDimension = 512;
          const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Image processing is unavailable in this browser.');
          context.fillStyle = '#111827';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch (error) {
          if (file.size <= 2 * 1024 * 1024) resolve(source);
          else reject(error instanceof Error ? error : new Error('The image could not be prepared.'));
        }
      };
      image.src = source;
    }));
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The selected image could not be read.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }
}
