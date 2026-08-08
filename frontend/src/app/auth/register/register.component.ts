import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({ selector: 'app-register', standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterModule], templateUrl: './register.component.html', styleUrls: ['./register.component.scss'] })
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup; showPassword = false; showConfirmPassword = false; isLoading = false; registrationError: string | null = null;
  passwordStrength = { value: 0, class: '', label: '' };
  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {}
  ngOnInit(): void {
    this.registerForm = this.fb.group({ username: ['', [Validators.required, Validators.minLength(3)]], email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(8), this.strongPasswordValidator]], confirmPassword: ['', Validators.required], termsAccepted: [false, Validators.requiredTrue] }, { validators: this.passwordMatchValidator });
    this.registerForm.get('password')?.valueChanges.subscribe((value) => this.passwordStrength = this.calculatePasswordStrength(value || ''));
  }
  strongPasswordValidator(control: AbstractControl): ValidationErrors | null { const v = control.value; if (!v) return null; return /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z\d]/.test(v) ? null : { weakPassword: true }; }
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null { return group.get('password')?.value === group.get('confirmPassword')?.value ? null : { passwordMismatch: true }; }
  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }
  toggleConfirmPasswordVisibility(): void { this.showConfirmPassword = !this.showConfirmPassword; }
  calculatePasswordStrength(password: string) { let score = 0; if (!password) return { value: 0, class: '', label: '' }; if (password.length >= 8) score += 25; if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 25; if (/\d/.test(password)) score += 25; if (/[^A-Za-z\d]/.test(password)) score += 25; if (score >= 100) return { value: score, class: 'strong', label: 'Strong' }; if (score >= 50) return { value: score, class: 'medium', label: 'Medium' }; return { value: score, class: 'weak', label: 'Weak' }; }
  onSubmit(): void { if (this.registerForm.invalid || this.isLoading) { this.registerForm.markAllAsTouched(); return; } this.isLoading = true; this.registrationError = null; const { username, email, password } = this.registerForm.value; this.authService.register({ username, email, password }).subscribe({ next: () => { this.isLoading = false; this.router.navigate(['/login'], { queryParams: { registered: '1' } }); }, error: (error) => { this.isLoading = false; this.registrationError = error.message || 'Registration failed. Please try again.'; } }); }
}
