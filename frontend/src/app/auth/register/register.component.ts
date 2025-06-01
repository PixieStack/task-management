import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http'; 
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  registrationError: string | null = null;

  passwordStrength = {
    value: 0,
    class: '',
    label: ''
  };

  private apiUrl = 'http://127.0.0.1:8000/auth/register';

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), this.strongPasswordValidator]],
      confirmPassword: ['', Validators.required],
      termsAccepted: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });

    this.registerForm.get('password')?.valueChanges.subscribe(value => {
      this.passwordStrength = this.calculatePasswordStrength(value);
    });
  }

  strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[\W_]/.test(value);

    const valid = hasUpper && hasLower && hasNumber && hasSpecial;
    return valid ? null : { weakPassword: true };
  }

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  calculatePasswordStrength(password: string) {
    let score = 0;
    if (!password) return { value: 0, class: '', label: '' };

    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[\W_]/.test(password)) score += 25;

    let label = 'Weak';
    let cls = 'weak';

    if (score >= 75) {
      label = 'Strong';
      cls = 'strong';
    } else if (score >= 50) {
      label = 'Medium';
      cls = 'medium';
    }

    return { value: score, class: cls, label };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.registrationError = null;

    const registrationData = {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    console.log('Sending registration data:', registrationData);

    this.http.post(this.apiUrl, registrationData)
      .pipe(
        catchError(err => {
          this.isLoading = false;
          console.error('Registration error:', err);
          this.registrationError = err.error?.detail || 'Registration failed. Please try again.';
          return throwError(() => err);
        })
      )
      .subscribe((response: any) => {
        this.isLoading = false;
        console.log('Registration success:', response);
        this.router.navigate(['/login']);
      });
  }
}
