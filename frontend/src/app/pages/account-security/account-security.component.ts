import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-security.component.html',
  styleUrls: ['./account-security.component.scss']
})
export class AccountSecurityComponent implements OnInit {
  emailForm!: FormGroup;
  passwordForm!: FormGroup;
  deleteAccountForm!: FormGroup;
  
  emailSubmitted = false;
  passwordSubmitted = false;
  deleteSubmitted = false;
  
  showEmailSuccess = false;
  showPasswordSuccess = false;
  
  loading = {
    email: false,
    password: false,
    delete: false
  };
  
  showDeleteConfirmation = false;
  username: string | null = null;
  profilePicture: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get user info
    this.username = this.authService.getUsername();
    this.profilePicture = localStorage.getItem('profilePicture');
    
    // Initialize forms
    this.initEmailForm();
    this.initPasswordForm();
    this.initDeleteAccountForm();
  }

  // Match validator for password confirmation
  passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      const password = control.get('newPassword');
      const confirmPassword = control.get('confirmPassword');
      
      return password && confirmPassword && password.value !== confirmPassword.value 
        ? { 'passwordMismatch': true } 
        : null;
    };
  }
  
  initEmailForm(): void {
    const currentEmail = localStorage.getItem('userEmail') || '';
    
    this.emailForm = this.fb.group({
      currentEmail: [{ value: currentEmail, disabled: true }],
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }
  
  initPasswordForm(): void {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required, 
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator() });
  }
  
  initDeleteAccountForm(): void {
    this.deleteAccountForm = this.fb.group({
      password: ['', [Validators.required]],
      confirmPhrase: ['', [Validators.required, Validators.pattern(/^DELETE$/)]]
    });
  }
  
  // Error checking helper
  hasError(form: FormGroup, field: string, errorType: string): boolean {
    const control = form.get(field);
    return (control?.hasError(errorType) && (control?.touched || 
            (field === 'newEmail' ? this.emailSubmitted : 
             field === 'newPassword' || field === 'confirmPassword' ? this.passwordSubmitted : 
             this.deleteSubmitted))) || false;
  }
  
  // Check for password mismatch
  hasPasswordMismatch(): boolean {
    return this.passwordForm.hasError('passwordMismatch') && 
           this.passwordForm.get('confirmPassword')?.touched || false;
  }
  
  // Email update submission
  onEmailSubmit(): void {
    this.emailSubmitted = true;
    
    if (this.emailForm.invalid) {
      return;
    }
    
    this.loading.email = true;
    
    // Simulate API call
    setTimeout(() => {
      const newEmail = this.emailForm.get('newEmail')?.value;
      localStorage.setItem('userEmail', newEmail);
      
      this.loading.email = false;
      this.showEmailSuccess = true;
      
      setTimeout(() => {
        this.showEmailSuccess = false;
        this.emailSubmitted = false;
        this.emailForm.reset();
        this.initEmailForm();
      }, 3000);
    }, 1000);
  }
  
  // Password update submission
  onPasswordSubmit(): void {
    this.passwordSubmitted = true;
    
    if (this.passwordForm.invalid) {
      return;
    }
    
    this.loading.password = true;
    
    // Simulate API call
    setTimeout(() => {
      this.loading.password = false;
      this.showPasswordSuccess = true;
      
      setTimeout(() => {
        this.showPasswordSuccess = false;
        this.passwordSubmitted = false;
        this.passwordForm.reset();
      }, 3000);
    }, 1000);
  }
  
  // Delete account confirmation
  toggleDeleteConfirmation(): void {
    this.showDeleteConfirmation = !this.showDeleteConfirmation;
    if (!this.showDeleteConfirmation) {
      this.deleteAccountForm.reset();
      this.deleteSubmitted = false;
    }
  }
  
  // Delete account submission
  onDeleteSubmit(): void {
    this.deleteSubmitted = true;
    
    if (this.deleteAccountForm.invalid) {
      return;
    }
    
    this.loading.delete = true;
    
    // Simulate API call
    setTimeout(() => {
      localStorage.clear();
      this.loading.delete = false;
      
      this.router.navigate(['/login']);
    }, 1500);
  }
  
  // Navigation
  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }
}