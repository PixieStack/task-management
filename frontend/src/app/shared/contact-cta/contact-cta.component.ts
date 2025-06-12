import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-contact-cta',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './contact-cta.component.html',
  styleUrls: ['./contact-cta.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate(
          '0.5s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
  ],
})
export class ContactCtaComponent {
  @Input() title: string = 'Get In Touch';
  @Input() description: string =
    'Interested in learning more about TaskManager or have questions? Feel free to reach out!';
  @Input() buttonText: string = 'Send Message';

  contactForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = false;

  // Direct API URL - change this to match your backend
  private apiUrl = 'http://localhost:8000';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
  ) {
    this.contactForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [Validators.required, Validators.pattern(/^\+?[0-9\s-()]{7,15}$/)],
      ],
      message: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      Object.keys(this.contactForm.controls).forEach((key) => {
        const control = this.contactForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = false;

    const contactData = this.contactForm.value;

    this.http.post(`${this.apiUrl}/contact/`, contactData).subscribe({
      next: (response: any) => {
        console.log('Contact message sent successfully:', response);
        this.isSubmitting = false;
        this.submitSuccess = true;

        // Reset form after showing success message for a moment
        setTimeout(() => {
          this.contactForm.reset();
          this.submitSuccess = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Error sending contact message:', error);
        this.isSubmitting = false;
        this.submitError = true;

        setTimeout(() => {
          this.submitError = false;
        }, 5000);
      },
    });
  }

  // Helper methods for form validation
  hasError(controlName: string, errorName: string): boolean {
    const control = this.contactForm.get(controlName);
    return !!(control && control.touched && control.hasError(errorName));
  }

  getErrorMessage(controlName: string): string {
    const control = this.contactForm.get(controlName);

    if (control?.hasError('required')) {
      return 'This field is required';
    }

    if (control?.hasError('email')) {
      return 'Please enter a valid email address';
    }

    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Must be at least ${minLength} characters`;
    }

    if (control?.hasError('pattern')) {
      if (controlName === 'phone') {
        return 'Please enter a valid phone number';
      }
    }

    return 'Invalid input';
  }
}
