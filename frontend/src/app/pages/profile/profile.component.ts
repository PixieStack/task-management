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
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService, User } from '../../shared/services/auth.service';
import {
  ProfileService,
  UserProfile,
} from '../../shared/services/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  activeSection: 'personal' | 'security' = 'personal';

  profileForm: FormGroup;
  emailForm: FormGroup;
  passwordForm: FormGroup;
  deleteAccountForm: FormGroup;

  user: User | null = null;
  profilePicture: string | null = null;

  loading = {
    page: true,
    profile: false,
    email: false,
    password: false,
    delete: false,
    picture: false,
    reset: false,
  };

  successMessage = '';
  errorMessage = '';
  passwordVisibility = {
    email: false,
    current: false,
    new: false,
    confirm: false,
    delete: false,
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
  ) {
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      firstName: [''],
      lastName: [''],
      email: [{ value: '', disabled: true }],
      phone: ['', [Validators.pattern(/^\+?[0-9\s()\-]{7,20}$/)]],
      bio: ['', [Validators.maxLength(500)]],
    });

    this.emailForm = this.fb.group({
      currentEmail: [{ value: '', disabled: true }],
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/,
            ),
          ],
        ],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );

    this.deleteAccountForm = this.fb.group({
      password: ['', Validators.required],
      confirmPhrase: ['', [Validators.required, Validators.pattern(/^DELETE$/)]],
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  setActiveSection(section: 'personal' | 'security'): void {
    this.activeSection = section;
    this.clearMessages();
  }

  loadProfile(): void {
    this.loading.page = true;
    forkJoin({
      user: this.authService.getMe(),
      profile: this.profileService.getProfile(),
    }).subscribe({
      next: ({ user, profile }) => {
        this.user = user;
        this.profilePicture = profile.profile_picture || null;
        this.patchForms(user, profile);
        this.cacheProfilePicture(profile.profile_picture || null);
        this.loading.page = false;
      },
      error: (error) => {
        this.loading.page = false;
        this.showError(error.message);
      },
    });
  }

  saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.loading.profile) return;

    this.loading.profile = true;
    const value = this.profileForm.getRawValue();

    const userUpdate = {
      username: value.username.trim(),
      first_name: value.firstName?.trim() || undefined,
      last_name: value.lastName?.trim() || undefined,
    };

    const profileUpdate: Partial<UserProfile> = {
      phone: value.phone?.trim() || undefined,
      bio: value.bio?.trim() || undefined,
    };

    forkJoin({
      user: this.authService.updateUser(userUpdate),
      profile: this.profileService.updateProfile(profileUpdate),
    }).subscribe({
      next: ({ user }) => {
        this.user = user;
        this.loading.profile = false;
        this.showSuccess('Profile updated.');
      },
      error: (error) => {
        this.loading.profile = false;
        this.showError(error.message);
      },
    });
  }

  resetForm(): void {
    this.loadProfile();
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.loading.picture = true;
    this.profileService.prepareProfilePicture(file).then((base64) => {
      this.profileService.uploadProfilePicture(base64).subscribe({
        next: (profile) => {
          this.profilePicture = profile.profile_picture || null;
          this.cacheProfilePicture(this.profilePicture);
          window.dispatchEvent(new CustomEvent('profile-picture-updated', { detail: this.profilePicture }));
          this.loading.picture = false;
          input.value = '';
          this.showSuccess('Profile picture updated.');
        },
        error: (error) => {
          this.loading.picture = false;
          input.value = '';
          this.showError(error.message);
        },
      });
    }).catch((error: Error) => {
      this.loading.picture = false;
      input.value = '';
      this.showError(error.message);
    });
  }

  sendPasswordReset(): void {
    if (!this.user?.email || this.loading.reset) return;
    this.loading.reset = true;
    this.authService.forgotPassword(this.user.email).subscribe({
      next: (response) => {
        this.loading.reset = false;
        this.showSuccess(response.message);
      },
      error: (error) => {
        this.loading.reset = false;
        this.showError(error.message);
      },
    });
  }

  changeEmail(): void {
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid || this.loading.email) return;

    this.loading.email = true;
    const { newEmail, password } = this.emailForm.getRawValue();

    this.authService.changeEmail(newEmail, password).subscribe({
      next: (response) => {
        this.user = response.user;
        this.profileForm.get('email')?.setValue(response.user.email);
        this.emailForm.reset({
          currentEmail: response.user.email,
          newEmail: '',
          password: '',
        });
        this.loading.email = false;
        this.showSuccess('Email updated. Confirmation messages were sent through Brevo.');
      },
      error: (error) => {
        this.loading.email = false;
        this.showError(error.message);
      },
    });
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.loading.password) return;

    this.loading.password = true;
    const { currentPassword, newPassword } = this.passwordForm.value;

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.loading.password = false;
        this.showSuccess('Password updated.');
      },
      error: (error) => {
        this.loading.password = false;
        this.showError(error.message);
      },
    });
  }

  deleteAccount(): void {
    this.deleteAccountForm.markAllAsTouched();
    if (this.deleteAccountForm.invalid || this.loading.delete) return;
    if (!window.confirm('Permanently delete your Task Manager account and data?')) {
      return;
    }

    this.loading.delete = true;
    const { password, confirmPhrase } = this.deleteAccountForm.value;

    this.authService.deleteAccount(password, confirmPhrase).subscribe({
      next: () => {
        this.loading.delete = false;
        this.router.navigate(['/access']);
      },
      error: (error) => {
        this.loading.delete = false;
        this.showError(error.message);
      },
    });
  }

  hasError(form: FormGroup, field: string, error: string): boolean {
    const control = form.get(field);
    return !!(control && control.touched && control.hasError(error));
  }

  passwordMismatch(): boolean {
    return !!(
      this.passwordForm.touched &&
      this.passwordForm.hasError('passwordMismatch')
    );
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm
      ? { passwordMismatch: true }
      : null;
  }

  private patchForms(user: User, profile: UserProfile): void {
    this.profileForm.patchValue({
      username: user.username,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email,
      phone: profile.phone || '',
      bio: profile.bio || '',
    });

    this.emailForm.patchValue({
      currentEmail: user.email,
      newEmail: '',
      password: '',
    });
  }

  private cacheProfilePicture(value: string | null): void {
    const userId = this.authService.getUserId();
    if (!userId) return;
    const key = `profilePicture_${userId}`;
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  }

  private showSuccess(message: string): void {
    this.errorMessage = '';
    this.successMessage = message;
    window.setTimeout(() => (this.successMessage = ''), 3500);
  }

  private showError(message: string): void {
    this.successMessage = '';
    this.errorMessage = message || 'Something went wrong.';
    window.setTimeout(() => (this.errorMessage = ''), 5000);
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
