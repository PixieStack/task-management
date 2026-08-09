import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="reset-page">
      <section class="reset-card" aria-labelledby="forgot-password-title">
        <a routerLink="/login" class="back-link"><i class="fas fa-arrow-left"></i> Back to sign in</a>
        <div class="brand-icon" aria-hidden="true"><i class="fas fa-key"></i></div>
        <span class="kicker">Account recovery</span>
        <h1 id="forgot-password-title">Reset your password.</h1>
        <p class="intro">Enter the email address on your M.O.B TaskManager account. We’ll send a secure, single-use reset link through the app’s email service.</p>

        <div *ngIf="message" class="alert success" role="status">{{ message }}</div>
        <div *ngIf="error" class="alert error" role="alert">{{ error }}</div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="reset-email">Email address</label>
          <input id="reset-email" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
          <small *ngIf="form.controls.email.touched && form.controls.email.invalid">Enter a valid email address.</small>

          <button type="submit" [disabled]="isLoading || form.invalid">
            {{ isLoading ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>

        <p class="privacy-note"><i class="fas fa-shield-halved"></i> For privacy, the confirmation is the same whether or not an account exists for that email.</p>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; background:var(--bg-0); }
    .reset-page { min-height:calc(100vh - 72px); display:grid; place-items:center; padding:clamp(1rem,4vw,3rem); color:#eef2ff; background:radial-gradient(circle at 16% 8%,rgba(139,92,246,.19),transparent 26rem),radial-gradient(circle at 86% 24%,rgba(34,211,238,.09),transparent 23rem),linear-gradient(180deg,#070b14,#0c1220); box-sizing:border-box; }
    .reset-card { width:min(100%,500px); box-sizing:border-box; padding:clamp(1.35rem,5vw,2.5rem); border:1px solid rgba(148,163,184,.16); border-radius:28px; background:linear-gradient(145deg,rgba(17,26,43,.94),rgba(10,16,28,.88)); box-shadow:0 32px 90px rgba(0,0,0,.42),0 0 70px rgba(139,92,246,.08); backdrop-filter:blur(20px); }
    .back-link { display:inline-flex; align-items:center; gap:.45rem; margin-bottom:1.8rem; color:#9aa8bd; text-decoration:none; font-size:.78rem; font-weight:800; }
    .back-link:hover { color:#a5f3fc; }
    .brand-icon { width:48px; height:48px; display:grid; place-items:center; margin-bottom:1rem; border:1px solid rgba(139,92,246,.2); border-radius:14px; color:#ddd6fe; background:rgba(139,92,246,.12); box-shadow:0 0 26px rgba(139,92,246,.12); }
    .kicker { color:#9aa7bc; font-size:.68rem; font-weight:900; letter-spacing:.15em; text-transform:uppercase; }
    h1 { margin:.55rem 0 .65rem; color:#f8fafc; font-size:clamp(2rem,7vw,2.8rem); line-height:1.02; letter-spacing:-.05em; }
    .intro,.privacy-note { color:#8e9cb1; line-height:1.65; }
    form { display:grid; gap:.6rem; margin-top:1.6rem; }
    label { color:#b6c1d3; font-size:.8rem; font-weight:800; }
    input { width:100%; min-height:50px; box-sizing:border-box; padding:.75rem .85rem; border:1px solid rgba(148,163,184,.18); border-radius:13px; color:#eef2ff; background:rgba(4,8,15,.48); font:inherit; outline:none; }
    input:focus { border-color:rgba(34,211,238,.5); box-shadow:0 0 0 3px rgba(34,211,238,.08); }
    input::placeholder { color:#5d6a80; }
    small { color:#fda4af; font-size:.73rem; }
    button { min-height:50px; margin-top:.45rem; border:0; border-radius:13px; color:#fff; background:linear-gradient(135deg,var(--primary),#5b8cff); box-shadow:0 12px 28px rgba(109,66,223,.28); font-weight:900; font-size:.9rem; cursor:pointer; }
    button:disabled { opacity:.48; cursor:not-allowed; }
    .alert { margin-top:1rem; border-radius:12px; padding:.8rem .9rem; line-height:1.45; font-size:.82rem; font-weight:700; }
    .success { border:1px solid rgba(52,211,153,.22); background:rgba(52,211,153,.09); color:#bbf7d0; }
    .error { border:1px solid rgba(251,113,133,.24); background:rgba(251,113,133,.09); color:#fecdd3; }
    .privacy-note { display:flex; gap:.55rem; align-items:flex-start; margin:1.25rem 0 0; padding-top:1rem; border-top:1px solid rgba(148,163,184,.1); font-size:.76rem; }
    .privacy-note i { margin-top:.2rem; color:#a5f3fc; }
    @media (max-width:520px) { .reset-page { align-items:start; padding:.8rem; } .reset-card { border-radius:22px; padding:1.25rem; } }
  `],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isLoading = false;
  message = '';
  error = '';

  submit(): void {
    if (this.form.invalid || this.isLoading) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.error = '';
    this.auth.forgotPassword(this.form.controls.email.value.trim())
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.message = response.message;
          this.form.reset();
        },
        error: (err: Error) => {
          this.error = err.message || 'Unable to send a reset link. Please try again.';
        },
      });
  }
}
