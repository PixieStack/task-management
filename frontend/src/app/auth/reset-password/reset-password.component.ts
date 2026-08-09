import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="reset-page">
      <section class="reset-card" aria-labelledby="reset-password-title">
        <a routerLink="/login" class="back-link">← Back to sign in</a>
        <div class="brand-icon" aria-hidden="true"><i class="fas fa-lock"></i></div>
        <h1 id="reset-password-title">Choose a new password</h1>
        <p class="intro">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p>

        <div *ngIf="message" class="alert success" role="status">{{ message }}</div>
        <div *ngIf="error" class="alert error" role="alert">{{ error }}</div>

        <div *ngIf="!token" class="alert error" role="alert">
          This reset link is missing its token. Request a new password reset email.
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
          />
          <small *ngIf="form.controls.newPassword.touched && form.controls.newPassword.invalid">
            Password must be at least 8 characters.
          </small>

          <label for="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
          />
          <small *ngIf="form.controls.confirmPassword.touched && form.controls.confirmPassword.invalid">
            Confirm your new password.
          </small>

          <button type="submit" [disabled]="isLoading || form.invalid || !token || !!message">
            {{ isLoading ? 'Updating…' : 'Reset password' }}
          </button>
        </form>

        <p class="help-link"><a routerLink="/forgot-password">Need a new reset link?</a></p>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100%; }
    .reset-page { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: linear-gradient(135deg, #f7f9ff, #eef3ff); box-sizing: border-box; }
    .reset-card { width: min(100%, 480px); box-sizing: border-box; background: #fff; border: 1px solid #e4e8f0; border-radius: 20px; padding: clamp(22px, 5vw, 38px); box-shadow: 0 18px 45px rgba(36, 52, 86, .12); }
    .back-link { display: inline-block; margin-bottom: 24px; text-decoration: none; color: #425d9b; font-weight: 700; }
    .brand-icon { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: #edf2ff; color: #3b5ccc; font-size: 22px; margin-bottom: 18px; }
    h1 { margin: 0 0 10px; font-size: clamp(1.7rem, 7vw, 2.2rem); color: #1b2438; line-height: 1.12; }
    .intro { color: #5f6c82; line-height: 1.6; }
    form { display: grid; gap: 10px; margin-top: 26px; }
    label { margin-top: 4px; font-weight: 700; color: #26334d; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #cdd5e4; border-radius: 12px; padding: 13px 14px; font: inherit; outline: none; }
    input:focus { border-color: #4c6edb; box-shadow: 0 0 0 3px rgba(76, 110, 219, .12); }
    small { color: #b42318; }
    button { margin-top: 10px; border: 0; border-radius: 12px; padding: 13px 16px; background: #3f61cf; color: #fff; font-weight: 800; font-size: 1rem; cursor: pointer; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .alert { margin-top: 18px; border-radius: 12px; padding: 12px 14px; line-height: 1.45; }
    .success { background: #ecfdf3; color: #166534; }
    .error { background: #fff1f2; color: #b42318; }
    .help-link { margin: 20px 0 0; text-align: center; }
    .help-link a { color: #425d9b; font-weight: 700; }
  `],
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
  readonly form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  isLoading = false;
  message = '';
  error = '';

  submit(): void {
    if (this.form.invalid || this.isLoading || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    const { newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword !== confirmPassword) {
      this.error = 'The passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.error = '';
    this.auth.resetPassword(this.token, newPassword)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.message = response.message;
          this.form.reset();
          window.setTimeout(() => this.router.navigate(['/login']), 1400);
        },
        error: (err: Error) => {
          this.error = err.message || 'Unable to reset your password. Request a new link and try again.';
        },
      });
  }
}
