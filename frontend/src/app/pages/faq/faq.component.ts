import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface FAQItem {
  question: string;
  answer: string;
  isOpen?: boolean;
  category: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss']
})
export class FaqComponent {
  searchTerm: string = '';
  selectedCategory: string = 'all';

  categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'features', label: 'Features' },
    { value: 'account', label: 'Account & Security' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'technical', label: 'Technical' }
  ];

  faqs: FAQItem[] = [
    // General
    {
      question: 'What is Task Manager?',
      answer: 'Task Manager is an AI-powered productivity application that helps you organize, prioritize, and manage your tasks efficiently. It combines smart automation with intuitive design to boost your productivity.',
      category: 'general',
      isOpen: false
    },
    {
      question: 'How does the AI assistant work?',
      answer: 'Our AI assistant analyzes your task patterns, deadlines, and priorities to provide personalized suggestions. It can automatically categorize tasks, suggest optimal scheduling, and send smart reminders based on your work habits.',
      category: 'general',
      isOpen: false
    },
    {
      question: 'Is Task Manager suitable for teams?',
      answer: 'Yes! Task Manager supports team collaboration with shared boards, task assignments, and progress tracking. Team members can collaborate in real-time while maintaining individual productivity.',
      category: 'general',
      isOpen: false
    },
    // Features
    {
      question: 'What is the Smart Inbox?',
      answer: 'Smart Inbox is an AI-powered feature that automatically captures and organizes your tasks from various sources. It prioritizes tasks based on urgency, importance, and your personal patterns.',
      category: 'features',
      isOpen: false
    },
    {
      question: 'How do Task Boards work?',
      answer: 'Task Boards provide a visual way to manage your workflow using drag-and-drop functionality. You can create custom columns, move tasks between stages, and track progress at a glance.',
      category: 'features',
      isOpen: false
    },
    {
      question: 'Can I integrate with other tools?',
      answer: 'Currently, Task Manager supports integration with popular calendar applications. We are working on adding more integrations including email clients, project management tools, and communication platforms.',
      category: 'features',
      isOpen: false
    },
    // Account & Security
    {
      question: 'How do I reset my password?',
      answer: 'Click on "Forgot Password" on the login page. Enter your email address, and we will send you a secure link to reset your password. The link expires after 24 hours for security reasons.',
      category: 'account',
      isOpen: false
    },
    {
      question: 'Is my data secure?',
      answer: 'Absolutely. We use industry-standard encryption for data in transit and at rest. Your data is stored on secure servers, and we never share your personal information with third parties.',
      category: 'account',
      isOpen: false
    },
    {
      question: 'Can I export my data?',
      answer: 'Yes, you can export all your tasks, projects, and settings at any time from your account settings. We support multiple formats including CSV, JSON, and PDF.',
      category: 'account',
      isOpen: false
    },
    // Pricing
    {
      question: 'Is there a free version?',
      answer: 'Yes! Our free tier includes core features like Smart Inbox, basic task boards, and calendar view for individual users. Perfect for personal productivity.',
      category: 'pricing',
      isOpen: false
    },
    {
      question: 'What are the paid plans?',
      answer: 'We offer Pro ($9.99/month) with advanced AI features and unlimited boards, and Team ($19.99/user/month) with collaboration tools and admin controls.',
      category: 'pricing',
      isOpen: false
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes, you can cancel your subscription at any time. You will continue to have access until the end of your billing period, and you can always downgrade to our free plan.',
      category: 'pricing',
      isOpen: false
    },
    // Technical
    {
      question: 'What browsers are supported?',
      answer: 'Task Manager works best on the latest versions of Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated for the best experience.',
      category: 'technical',
      isOpen: false
    },
    {
      question: 'Is there a mobile app?',
      answer: 'Mobile apps for iOS and Android are currently in development. In the meantime, our web app is fully responsive and works great on mobile browsers.',
      category: 'technical',
      isOpen: false
    },
    {
      question: 'What about offline access?',
      answer: 'Task Manager includes limited offline functionality. Your tasks are cached locally, and changes sync automatically when you reconnect to the internet.',
      category: 'technical',
      isOpen: false
    }
  ];

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  get filteredFAQs(): FAQItem[] {
    return this.faqs.filter(faq => {
      const matchesCategory = this.selectedCategory === 'all' || faq.category === this.selectedCategory;
      const matchesSearch = this.searchTerm === '' || 
                          faq.question.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          faq.answer.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }

  highlightText(text: string): SafeHtml {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      return text;
    }

    const regex = new RegExp(`(${this.searchTerm})`, 'gi');
    const highlightedText = text.replace(regex, '<mark class="highlight">$1</mark>');
    return this.sanitizer.sanitize(1, highlightedText) || text;
  }

  toggleFAQ(faq: FAQItem): void {
    // Close all other FAQs
    this.faqs.forEach(f => {
      if (f !== faq) {
        f.isOpen = false;
      }
    });
    faq.isOpen = !faq.isOpen;
  }

  onSearch(value: string): void {
    this.searchTerm = value;
  }

  onCategoryChange(value: string): void {
    this.selectedCategory = value;
  }

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }
}