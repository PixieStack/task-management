import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { AdminService } from '../../shared/services/admin.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss'],
})
export class AdminLoginComponent {
  email = '';
  password = '';
  loading = false;
  errorMessage = '';

  constructor(
    private auth: AuthService,
    private admin: AdminService,
    private router: Router,
  ) {}

  signIn(): void {
    if (!this.email.trim() || !this.password) return;
    this.loading = true;
    this.errorMessage = '';

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.admin.session().subscribe({
          next: () => {
            this.loading = false;
            this.router.navigate(['/admin']);
          },
          error: () => {
            this.loading = false;
            this.errorMessage = 'This account does not have administrator access.';
          },
        });
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.message || 'Unable to sign in.';
      },
    });
  }
}
