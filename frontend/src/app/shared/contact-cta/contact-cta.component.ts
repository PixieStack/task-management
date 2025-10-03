import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
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
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate(
          '0.6s cubic-bezier(0.35, 0, 0.25, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('slideInLeft', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-50px)' }),
        animate(
          '0.8s cubic-bezier(0.35, 0, 0.25, 1)',
          style({ opacity: 1, transform: 'translateX(0)' }),
        ),
      ]),
    ]),
    trigger('pulse', [
      transition(':enter', [
        animate(
          '2s ease-in-out',
          keyframes([
            style({ transform: 'scale(1)', offset: 0 }),
            style({ transform: 'scale(1.05)', offset: 0.5 }),
            style({ transform: 'scale(1)', offset: 1 }),
          ])
        ),
      ]),
    ]),
  ],
})
export class ContactCtaComponent {
  @Input() title: string = 'Get In Touch';
  @Input() description: string =
    'Have a question about TaskManager? We\'re here to help you succeed!';
  @Input() buttonText: string = 'Send Message';

  contactForm: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = false;
  focusedField: string = '';
  mousePosition = { x: 0, y: 0 };

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
        [Validators.required, Validators.pattern(/^\+?[\d\s\-\(\)]+$/)],
      ],
      message: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  onMouseMove(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.mousePosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  setFocusedField(fieldName: string): void {
    this.focusedField = fieldName;
  }

  clearFocusedField(): void {
    this.focusedField = '';
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

        // Reset form after showing success message
        setTimeout(() => {
          this.contactForm.reset();
          this.submitSuccess = false;
        }, 4000);
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
      return `${this.getFieldLabel(controlName)} is required`;
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

  private getFieldLabel(controlName: string): string {
    const labels: { [key: string]: string } = {
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone',
      message: 'Message',
    };
    return labels[controlName] || controlName;
  }

  get formCompletion(): number {
    const fields = Object.keys(this.contactForm.controls);
    const validFields = fields.filter(key => this.contactForm.get(key)?.valid).length;
    return Math.round((validFields / fields.length) * 100);
  }
}