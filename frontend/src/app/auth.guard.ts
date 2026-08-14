import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthService } from './shared/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | Observable<boolean> {
    if (!this.auth.isLoggedIn()) {
      void this.router.navigate(['/access'], { replaceUrl: true });
      return false;
    }
    return this.auth.getMe().pipe(
      map(() => true),
      catchError(() => {
        this.auth.invalidateSession();
        void this.router.navigate(['/access'], { replaceUrl: true });
        return of(false);
      }),
    );
  }
}
