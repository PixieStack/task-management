import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  resendBusy = false;
  showPassword = false;
  loginError = '';
  statusMessage = '';
  returnUrl = '/dashboard';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    this.loginForm = this.fb.group({
      email: [this.route.snapshot.queryParams['email'] || this.authService.getRememberedEmail(), [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [this.authService.shouldRemember()],
    });

    if (this.route.snapshot.queryParams['verified'] === '1') {
      this.statusMessage = 'Email verified. You can sign in now.';
    } else if (this.route.snapshot.queryParams['registered'] === '1') {
      this.statusMessage = 'Account created. Check your email for the Brevo verification link before signing in.';
    } else if (this.route.snapshot.queryParams['verification'] === 'invalid') {
      this.loginError = 'That verification link is invalid or expired. Request a new one below.';
    }
  }

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }
    this.isLoading = true;
    this.loginError = '';
    const { email, password, rememberMe } = this.loginForm.value;
    this.authService.login(email, password, Boolean(rememberMe)).subscribe({
      next: () => { this.isLoading = false; this.router.navigateByUrl(this.returnUrl); },
      error: (err) => { this.isLoading = false; this.loginError = err.message || 'Login failed. Please try again.'; },
    });
  }

  resendVerification(): void {
    const emailControl = this.loginForm.get('email');
    emailControl?.markAsTouched();
    if (!emailControl?.value || emailControl.invalid || this.resendBusy) return;
    this.resendBusy = true;
    this.loginError = '';
    this.statusMessage = '';
    this.authService.resendVerification(emailControl.value).subscribe({
      next: (response) => { this.resendBusy = false; this.statusMessage = response.message; },
      error: (err) => { this.resendBusy = false; this.loginError = err.message; },
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if ((control as any).controls) this.markFormGroupTouched(control as FormGroup);
    });
  }
}
