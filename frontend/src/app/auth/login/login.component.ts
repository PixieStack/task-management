import { AfterViewInit, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService, OAuthConfig } from '../../shared/services/auth.service';
import { OAuthProviderService } from '../../shared/services/oauth-provider.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, AfterViewInit {
  loginForm!: FormGroup;
  isLoading = false;
  oauthBusy = false;
  resendBusy = false;
  showPassword = false;
  loginError = '';
  statusMessage = '';
  returnUrl = '/dashboard';
  oauthConfig: OAuthConfig = {};
  private viewReady = false;
  private googleRendered = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private oauthProvider: OAuthProviderService,
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    this.loginForm = this.fb.group({
      email: [this.route.snapshot.queryParams['email'] || '', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });

    if (this.route.snapshot.queryParams['verified'] === '1') {
      this.statusMessage = 'Email verified. You can sign in now.';
    } else if (this.route.snapshot.queryParams['registered'] === '1') {
      this.statusMessage = 'Account created. Check your email for the Brevo verification link before signing in.';
    } else if (this.route.snapshot.queryParams['verification'] === 'invalid') {
      this.loginError = 'That verification link is invalid or expired. Request a new one below.';
    }

    this.authService.getOAuthConfig().subscribe({
      next: (config) => { this.oauthConfig = config; this.setupGoogle(); },
      error: () => { this.oauthConfig = {}; },
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.setupGoogle();
  }

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }
    this.isLoading = true;
    this.loginError = '';
    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).subscribe({
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

  async signInWithApple(): Promise<void> {
    if (!this.oauthConfig.apple_client_id || this.oauthBusy) return;
    this.oauthBusy = true;
    this.loginError = '';
    try {
      const credential = await this.oauthProvider.signInWithApple(this.oauthConfig.apple_client_id);
      this.completeOAuth('apple', credential);
    } catch (error) {
      this.oauthBusy = false;
      this.loginError = error instanceof Error ? error.message : 'Apple sign-in failed.';
    }
  }

  private setupGoogle(): void {
    if (!this.viewReady || this.googleRendered || !this.oauthConfig.google_client_id) return;
    const target = document.getElementById('google-login-button');
    if (!target) return;
    this.googleRendered = true;
    this.oauthProvider.renderGoogleButton(
      target,
      this.oauthConfig.google_client_id,
      (credential) => this.completeOAuth('google', credential),
    ).catch((error) => {
      this.googleRendered = false;
      this.loginError = error instanceof Error ? error.message : 'Google sign-in failed.';
    });
  }

  private completeOAuth(provider: 'google' | 'apple', credential: string): void {
    this.oauthBusy = true;
    this.loginError = '';
    this.authService.oauthLogin(provider, credential).subscribe({
      next: () => { this.oauthBusy = false; this.router.navigateByUrl(this.returnUrl); },
      error: (err) => { this.oauthBusy = false; this.loginError = err.message || `${provider} sign-in failed.`; },
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if ((control as any).controls) this.markFormGroupTouched(control as FormGroup);
    });
  }
}
