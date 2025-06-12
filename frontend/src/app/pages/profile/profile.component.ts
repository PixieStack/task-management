import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

// Define profile interface
interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  gender: string;
  dateOfBirth: string;
  occupation: string;
  company: string;
  bio: string;
  profilePicture?: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  activeSection: 'personal' | 'security' | 'notifications' = 'personal';

  // Profile form
  profileForm!: FormGroup;
  submitted = false;
  success = false;
  loading = false;
  profilePicture: string | null = null;
  username: string | null = null;
  currentUserId: string | null = null;

  // Security forms
  emailForm!: FormGroup;
  passwordForm!: FormGroup;
  deleteAccountForm!: FormGroup;

  emailSubmitted = false;
  passwordSubmitted = false;
  deleteSubmitted = false;

  showEmailSuccess = false;
  showPasswordSuccess = false;

  securityLoading = {
    email: false,
    password: false,
    delete: false,
  };

  showDeleteConfirmation = false;

  // Country list for the dropdown
  countries = [
    'South Africa',
    'Canada',
    'United Kingdom',
    'Australia',
    'Germany',
    'France',
    'Japan',
    'China',
    'India',
    'Brazil',
    'United States',
    'Nigeria',
    'Kenya',
    'Egypt',
    'Morocco',
    'Mexico',
    'Spain',
    'Italy',
    'Russia',
    'South Korea',
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.username = this.authService.getUsername();
    this.currentUserId = this.authService.getUserId();

    // If no user is logged in, redirect to login
    if (!this.currentUserId) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserSpecificData();
    this.initForm();
    this.initSecurityForms();
    this.loadProfile();
  }

  // Load user-specific data using user ID
  private loadUserSpecificData(): void {
    if (this.currentUserId) {
      this.profilePicture = localStorage.getItem(
        `profilePicture_${this.currentUserId}`,
      );
    }
  }

  // Get user-specific localStorage key
  private getUserStorageKey(key: string): string {
    return `${key}_${this.currentUserId}`;
  }

  // Toggle active section
  setActiveSection(section: 'personal' | 'security'): void {
    this.activeSection = section;
  }

  // === PERSONAL INFORMATION SECTION ===

  initForm(): void {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\+?[0-9\s-()]{7,20}$/)]],
      address: [''],
      city: [''],
      state: [''],
      zipCode: [''],
      country: [''],
      gender: [''],
      dateOfBirth: [''],
      occupation: [''],
      company: [''],
      bio: ['', [Validators.maxLength(500)]],
    });
  }

  loadProfile(): void {
    if (!this.currentUserId) return;

    const savedProfile = localStorage.getItem(
      this.getUserStorageKey('userProfile'),
    );
    if (savedProfile) {
      const profile: UserProfile = JSON.parse(savedProfile);
      this.profileForm.patchValue(profile);
    }
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.profileForm.invalid) {
      return;
    }

    this.loading = true;

    setTimeout(() => {
      if (this.currentUserId) {
        localStorage.setItem(
          this.getUserStorageKey('userProfile'),
          JSON.stringify(this.profileForm.value),
        );
        localStorage.setItem(
          this.getUserStorageKey('userEmail'),
          this.profileForm.value.email,
        );
      }

      this.loading = false;
      this.success = true;

      setTimeout(() => {
        this.success = false;
      }, 3000);
    }, 800);
  }

  updateProfilePicture(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length && this.currentUserId) {
        const file = target.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
          this.profilePicture = event.target?.result as string;
          localStorage.setItem(
            this.getUserStorageKey('profilePicture'),
            this.profilePicture,
          );
        };

        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  }

  hasError(field: string, errorType: string): boolean {
    return (
      (this.profileForm.get(field)?.hasError(errorType) &&
        (this.profileForm.get(field)?.touched || this.submitted)) ||
      false
    );
  }

  resetForm(): void {
    this.submitted = false;
    this.profileForm.reset();
    this.loadProfile();
  }

  // === ACCOUNT SECURITY SECTION ===

  // Password match validator
  passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const password = control.get('newPassword');
      const confirmPassword = control.get('confirmPassword');

      return password &&
        confirmPassword &&
        password.value !== confirmPassword.value
        ? { passwordMismatch: true }
        : null;
    };
  }

  initSecurityForms(): void {
    // Email form
    let currentEmail = '';
    if (this.currentUserId) {
      currentEmail =
        localStorage.getItem(this.getUserStorageKey('userEmail')) || '';
    }

    this.emailForm = this.fb.group({
      currentEmail: [{ value: currentEmail, disabled: true }],
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });

    // Password form
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            ),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator() },
    );

    // Delete account form
    this.deleteAccountForm = this.fb.group({
      password: ['', [Validators.required]],
      confirmPhrase: [
        '',
        [Validators.required, Validators.pattern(/^DELETE$/)],
      ],
    });
  }

  // Security form error checker
  hasSecurityError(form: FormGroup, field: string, errorType: string): boolean {
    const control = form.get(field);
    const isSubmitted =
      field === 'newEmail'
        ? this.emailSubmitted
        : field === 'newPassword' || field === 'confirmPassword'
          ? this.passwordSubmitted
          : this.deleteSubmitted;

    return (
      (control?.hasError(errorType) && (control?.touched || isSubmitted)) ||
      false
    );
  }

  // Check for password mismatch
  hasPasswordMismatch(): boolean {
    return (
      (this.passwordForm.hasError('passwordMismatch') &&
        this.passwordForm.get('confirmPassword')?.touched) ||
      false
    );
  }

  // Email update submission
  onEmailSubmit(): void {
    this.emailSubmitted = true;

    if (this.emailForm.invalid) {
      return;
    }

    this.securityLoading.email = true;

    // Simulate API call
    setTimeout(() => {
      const newEmail = this.emailForm.get('newEmail')?.value;
      if (this.currentUserId) {
        localStorage.setItem(this.getUserStorageKey('userEmail'), newEmail);
      }

      this.securityLoading.email = false;
      this.showEmailSuccess = true;

      setTimeout(() => {
        this.showEmailSuccess = false;
        this.emailSubmitted = false;
        this.emailForm.reset();

        // Reinitialize with updated email
        let currentEmail = '';
        if (this.currentUserId) {
          currentEmail =
            localStorage.getItem(this.getUserStorageKey('userEmail')) || '';
        }
        this.emailForm.patchValue({
          currentEmail: currentEmail,
        });
      }, 3000);
    }, 1000);
  }

  // Password update submission
  onPasswordSubmit(): void {
    this.passwordSubmitted = true;

    if (this.passwordForm.invalid) {
      return;
    }

    this.securityLoading.password = true;

    // Simulate API call
    setTimeout(() => {
      this.securityLoading.password = false;
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

    this.securityLoading.delete = true;

    setTimeout(() => {
      if (this.currentUserId) {
        localStorage.removeItem(this.getUserStorageKey('userProfile'));
        localStorage.removeItem(this.getUserStorageKey('userEmail'));
        localStorage.removeItem(this.getUserStorageKey('profilePicture'));
      }
      this.authService.logout();
      this.securityLoading.delete = false;

      this.router.navigate(['/login']);
    }, 1500);
  }
}
