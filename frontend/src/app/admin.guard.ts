import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';

import { AuthService } from './shared/services/auth.service';
import { AdminService } from './shared/services/admin.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private admin: AdminService,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean | UrlTree> | boolean | UrlTree {
    if (!this.auth.isLoggedIn()) {
      return this.router.createUrlTree(['/admin/login']);
    }

    return this.admin.session().pipe(
      map((session) => session.is_admin ? true : this.router.createUrlTree(['/dashboard'])),
      catchError(() => of(this.router.createUrlTree(['/admin/login']))),
    );
  }
}
