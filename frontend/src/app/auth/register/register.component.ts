import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, OAuthConfig } from '../../shared/services/auth.service';
import { OAuthProviderService } from '../../shared/services/oauth-provider.service';

@Component({ selector: 'app-register', standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterModule], templateUrl: './register.component.html', styleUrls: ['./register.component.scss'] })
export class RegisterComponent implements OnInit, AfterViewInit {
  registerForm!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  oauthBusy = false;
  registrationError: string | null = null;
  oauthConfig: OAuthConfig = {};
  passwordStrength = { value: 0, class: '', label: '' };
  private viewReady = false;
  private googleRendered = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private oauthProvider: OAuthProviderService,
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), this.strongPasswordValidator]],
      confirmPassword: ['', Validators.required],
      termsAccepted: [false, Validators.requiredTrue],
    }, { validators: this.passwordMatchValidator });
    this.registerForm.get('password')?.valueChanges.subscribe((value) => this.passwordStrength = this.calculatePasswordStrength(value || ''));
    this.authService.getOAuthConfig().subscribe({
      next: (config) => { this.oauthConfig = config; this.setupGoogle(); },
      error: () => { this.oauthConfig = {}; },
    });
  }

  ngAfterViewInit(): void { this.viewReady = true; this.setupGoogle(); }

  strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const v = control.value;
    if (!v) return null;
    return /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z\d]/.test(v) ? null : { weakPassword: true };
  }
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null { return group.get('password')?.value === group.get('confirmPassword')?.value ? null : { passwordMismatch: true }; }
  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }
  toggleConfirmPasswordVisibility(): void { this.showConfirmPassword = !this.showConfirmPassword; }
  calculatePasswordStrength(password: string) { let score = 0; if (!password) return { value: 0, class: '', label: '' }; if (password.length >= 8) score += 25; if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 25; if (/\d/.test(password)) score += 25; if (/[^A-Za-z\d]/.test(password)) score += 25; if (score >= 100) return { value: score, class: 'strong', label: 'Strong' }; if (score >= 50) return { value: score, class: 'medium', label: 'Medium' }; return { value: score, class: 'weak', label: 'Weak' }; }

  onSubmit(): void {
    if (this.registerForm.invalid || this.isLoading) { this.registerForm.markAllAsTouched(); return; }
    this.isLoading = true;
    this.registrationError = null;
    const { username, email, password } = this.registerForm.value;
    this.authService.register({ username, email, password }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/login'], { queryParams: { registered: '1', email: response.email } });
      },
      error: (error) => { this.isLoading = false; this.registrationError = error.message || 'Registration failed. Please try again.'; },
    });
  }

  async signUpWithApple(): Promise<void> {
    if (!this.oauthConfig.apple_client_id || this.oauthBusy) return;
    if (!this.registerForm.get('termsAccepted')?.value) {
      this.registerForm.get('termsAccepted')?.markAsTouched();
      this.registrationError = 'Accept the Terms of Service and Privacy Policy before continuing.';
      return;
    }
    this.oauthBusy = true;
    this.registrationError = null;
    try {
      const credential = await this.oauthProvider.signInWithApple(this.oauthConfig.apple_client_id);
      this.completeOAuth('apple', credential);
    } catch (error) {
      this.oauthBusy = false;
      this.registrationError = error instanceof Error ? error.message : 'Apple sign-up failed.';
    }
  }

  private setupGoogle(): void {
    if (!this.viewReady || this.googleRendered || !this.oauthConfig.google_client_id) return;
    const target = document.getElementById('google-register-button');
    if (!target) return;
    this.googleRendered = true;
    this.oauthProvider.renderGoogleButton(
      target,
      this.oauthConfig.google_client_id,
      (credential) => {
        if (!this.registerForm.get('termsAccepted')?.value) {
          this.registerForm.get('termsAccepted')?.markAsTouched();
          this.registrationError = 'Accept the Terms of Service and Privacy Policy before continuing.';
          return;
        }
        this.completeOAuth('google', credential);
      },
    ).catch((error) => {
      this.googleRendered = false;
      this.registrationError = error instanceof Error ? error.message : 'Google sign-up failed.';
    });
  }

  private completeOAuth(provider: 'google' | 'apple', credential: string): void {
    this.oauthBusy = true;
    this.registrationError = null;
    this.authService.oauthLogin(provider, credential).subscribe({
      next: () => { this.oauthBusy = false; this.router.navigate(['/dashboard']); },
      error: (error) => { this.oauthBusy = false; this.registrationError = error.message || `${provider} sign-up failed.`; },
    });
  }
}
