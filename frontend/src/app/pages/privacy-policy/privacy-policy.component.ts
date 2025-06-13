import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
  lastUpdated = 'April 20, 2025';
  
  sections = [
    {
      title: 'Information We Collect',
      id: 'information-collected'
    },
    {
      title: 'How We Use Your Information',
      id: 'how-we-use'
    },
    {
      title: 'Data Security',
      id: 'data-security'
    },
    {
      title: 'Third-Party Services',
      id: 'third-party'
    },
    {
      title: 'Your Rights',
      id: 'your-rights'
    },
    {
      title: 'Contact Us',
      id: 'contact'
    }
  ];

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}