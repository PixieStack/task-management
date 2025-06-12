import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cookie-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cookie-policy.component.html',
  styleUrls: ['./cookie-policy.component.scss']
})
export class CookiePolicyComponent {
  lastUpdated = 'January 15, 2025';
  
  sections = [
    {
      title: 'What Are Cookies',
      id: 'what-are-cookies'
    },
    {
      title: 'How We Use Cookies',
      id: 'how-we-use'
    },
    {
      title: 'Types of Cookies',
      id: 'types-of-cookies'
    },
    {
      title: 'Managing Cookies',
      id: 'managing-cookies'
    },
    {
      title: 'Third-Party Cookies',
      id: 'third-party'
    },
    {
      title: 'Contact Us',
      id: 'contact'
    }
  ];

  cookieTypes = [
    {
      name: 'Essential Cookies',
      description: 'Required for basic site functionality',
      examples: ['Session management', 'Authentication', 'Security'],
      canDisable: false
    },
    {
      name: 'Performance Cookies',
      description: 'Help us understand how visitors use our site',
      examples: ['Page load times', 'Error rates', 'Usage patterns'],
      canDisable: true
    },
    {
      name: 'Functionality Cookies',
      description: 'Remember your preferences and settings',
      examples: ['Language preferences', 'Theme settings', 'Layout choices'],
      canDisable: true
    },
    {
      name: 'Analytics Cookies',
      description: 'Provide insights about site usage',
      examples: ['Google Analytics', 'User behavior tracking', 'Conversion tracking'],
      canDisable: true
    }
  ];

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}