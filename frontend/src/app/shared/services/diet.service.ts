import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DietPreference {
  preference_type?: string;
  allergies?: string[];
  dislikes?: string[];
  health_goals?: string;
  daily_calorie_target?: number;
  water_target_ml?: number;
}

export interface MealEntry {
  id?: number;
  meal_type: string;
  description: string;
  calories?: number;
  date?: string;
  meal_time?: string;
}

export interface WaterEntry {
  id?: number;
  amount_ml: number;
  date?: string;
  time?: string;
}

export interface DailyMealPlan {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snacks: string[];
  tips: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DietService {
  private apiUrl = '/api/diet';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  setPreferences(preferences: DietPreference): Observable<any> {
    return this.http.post(`${this.apiUrl}/preferences`, preferences, { headers: this.getHeaders() });
  }

  getPreferences(): Observable<DietPreference> {
    return this.http.get<DietPreference>(`${this.apiUrl}/preferences`, { headers: this.getHeaders() });
  }

  getMealPlan(): Observable<DailyMealPlan> {
    return this.http.get<DailyMealPlan>(`${this.apiUrl}/meal-plan`, { headers: this.getHeaders() });
  }

  logMeal(meal: MealEntry): Observable<MealEntry> {
    return this.http.post<MealEntry>(`${this.apiUrl}/meals`, meal, { headers: this.getHeaders() });
  }

  getMeals(days: number = 7): Observable<MealEntry[]> {
    return this.http.get<MealEntry[]>(`${this.apiUrl}/meals?days=${days}`, { headers: this.getHeaders() });
  }

  logWater(amount_ml: number): Observable<WaterEntry> {
    return this.http.post<WaterEntry>(`${this.apiUrl}/water`, { amount_ml }, { headers: this.getHeaders() });
  }

  getWaterEntries(days: number = 7): Observable<WaterEntry[]> {
    return this.http.get<WaterEntry[]>(`${this.apiUrl}/water?days=${days}`, { headers: this.getHeaders() });
  }

  getAnalytics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/analytics`, { headers: this.getHeaders() });
  }
}
