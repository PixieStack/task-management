import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';

type AccessMode = 'login' | 'register';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './access.component.html',
  styleUrls: ['./access.component.scss'],
})
export class AccessComponent implements OnInit {
  mode: AccessMode = 'login';
  loginForm!: FormGroup;
  registerForm!: FormGroup;
  isLoading = false;
  resendBusy = false;
  showLoginPassword = false;
  showRegisterPassword = false;
  showConfirmPassword = false;
  errorMessage = '';
  statusMessage = '';
  returnUrl = '/dashboard';
  passwordStrength = { value: 0, class: '', label: '' };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    if (this.authService.isLoggedIn()) {
      void this.router.navigateByUrl(this.returnUrl);
      return;
    }

    const requestedMode = this.route.snapshot.queryParams['mode'];
    this.mode = requestedMode === 'register' || this.route.snapshot.routeConfig?.path === 'register'
      ? 'register'
      : 'login';
    const email = this.route.snapshot.queryParams['email'] || '';
    this.loginForm = this.fb.group({
      email: [email, [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: [email, [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), this.strongPasswordValidator]],
      confirmPassword: ['', Validators.required],
      termsAccepted: [false, Validators.requiredTrue],
    }, { validators: this.passwordMatchValidator });
    this.registerForm.get('password')?.valueChanges.subscribe((value) => {
      this.passwordStrength = this.calculatePasswordStrength(value || '');
    });

    if (this.route.snapshot.queryParams['verified'] === '1') {
      this.statusMessage = 'Email verified. You can sign in now.';
    } else if (this.route.snapshot.queryParams['registered'] === '1') {
      this.statusMessage = 'Account created. Check your email for the verification link before signing in.';
    } else if (this.route.snapshot.queryParams['verification'] === 'invalid') {
      this.errorMessage = 'That verification link is invalid or expired. Request a new one below.';
    }
  }

  setMode(mode: AccessMode): void {
    this.mode = mode;
    this.errorMessage = '';
    this.statusMessage = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mode: mode === 'register' ? 'register' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  submitLogin(): void {
    if (this.loginForm.invalid || this.isLoading) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).subscribe({
      next: () => {
        this.isLoading = false;
        void this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Sign in failed. Please try again.';
      },
    });
  }

  submitRegistration(): void {
    if (this.registerForm.invalid || this.isLoading) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const { username, email, password } = this.registerForm.value;
    this.authService.register({ username, email, password }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.loginForm.patchValue({ email: response.email, password: '' });
        this.mode = 'login';
        this.statusMessage = 'Account created. Check your email for the verification link, then sign in here.';
        void this.router.navigate(['/access'], { queryParams: { email: response.email, registered: '1' }, replaceUrl: true });
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Registration failed. Please try again.';
      },
    });
  }

  resendVerification(): void {
    const email = this.loginForm.get('email');
    email?.markAsTouched();
    if (!email?.value || email.invalid || this.resendBusy) return;
    this.resendBusy = true;
    this.errorMessage = '';
    this.authService.resendVerification(email.value).subscribe({
      next: (response) => {
        this.resendBusy = false;
        this.statusMessage = response.message;
      },
      error: (error) => {
        this.resendBusy = false;
        this.errorMessage = error.message;
      },
    });
  }

  strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z\d]/.test(value)
      ? null
      : { weakPassword: true };
  }

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    return group.get('password')?.value === group.get('confirmPassword')?.value
      ? null
      : { passwordMismatch: true };
  }

  calculatePasswordStrength(password: string) {
    if (!password) return { value: 0, class: '', label: '' };
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 25;
    if (/\d/.test(password)) score += 25;
    if (/[^A-Za-z\d]/.test(password)) score += 25;
    if (score >= 100) return { value: score, class: 'strong', label: 'Strong' };
    if (score >= 50) return { value: score, class: 'medium', label: 'Medium' };
    return { value: score, class: 'weak', label: 'Weak' };
  }
}
