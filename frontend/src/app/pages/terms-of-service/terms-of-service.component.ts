import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.scss']
})
export class TermsOfServiceComponent {
  lastUpdated: string; 
  
  constructor() {
    const currentDate = new Date();
    this.lastUpdated = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
 
  sections = [
    {
      title: 'Introduction',
      id: 'introduction'
    },
    {
      title: 'Acceptance of Terms',
      id: 'acceptance'
    },
    {
      title: 'User Accounts',
      id: 'user-accounts'
    },
    {
      title: 'Acceptable Use',
      id: 'acceptable-use'
    },
    {
      title: 'Intellectual Property',
      id: 'intellectual-property'
    },
    {
      title: 'Privacy and Data Protection',
      id: 'privacy-data'
    },
    {
      title: 'Limitation of Liability',
      id: 'limitation'
    },
    {
      title: 'Indemnification',
      id: 'indemnification'
    },
    {
      title: 'Termination',
      id: 'termination'
    },
    {
      title: 'Modifications to Terms',
      id: 'modifications'
    },
    {
      title: 'General Provisions',
      id: 'general'
    },
    {
      title: 'Source Code and Portfolio Usage',
      id: 'source-code'
    }
  ];

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; 
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }
}