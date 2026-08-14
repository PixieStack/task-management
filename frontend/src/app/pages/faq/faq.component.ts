import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
  imports: [CommonModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
})
export class FaqComponent {
  searchTerm = '';
  selectedCategory = 'all';

  readonly categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'features', label: 'Features' },
    { value: 'account', label: 'Account & Security' },
    { value: 'technical', label: 'Apps & Technical' },
  ];

  readonly faqs: FAQItem[] = [
    {
      question: 'What is M.O.B TaskManager?',
      answer:
        'M.O.B TaskManager is a personal productivity workspace for tasks, Daily Todos, habits, reading challenges, projects, Pomodoro focus, persistent time tracking and AI-assisted actions.',
      category: 'general',
      isOpen: false,
    },
    {
      question: 'What can the AI assistant actually do?',
      answer:
        'The assistant can answer questions about your productivity and can perform approved actions such as creating or updating tasks and Daily Todos, working with habits and reading challenges, and starting or stopping task and todo timers. The app checks that each requested change is allowed and belongs to your account.',
      category: 'general',
      isOpen: false,
    },
    {
      question: 'Is this a team project-management app?',
      answer:
        'No. The current product is intentionally focused on personal productivity. Shared boards, team assignments and real-time team collaboration are not part of the current feature set.',
      category: 'general',
      isOpen: false,
    },
    {
      question: 'Where is my app data stored?',
      answer:
        'Your account and productivity information is stored securely in the app database. The website and AI assistant do not receive unrestricted direct access to that database.',
      category: 'general',
      isOpen: false,
    },
    {
      question: 'How are registration and password-reset emails sent?',
      answer:
        'Registration verification and password-reset emails are sent through the app’s email service. The database provider is not used to send your account emails.',
      category: 'general',
      isOpen: false,
    },

    {
      question: 'What are Daily Todos?',
      answer:
        'Daily Todos are a lightweight list for what you want to complete on a particular day. Each todo can have priority and notes, can be completed or reopened, and can track its own accumulated focus time.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'How does task and todo time tracking work?',
      answer:
        'When you start a timer, the app saves the running session so it can survive a page refresh. When you stop it, the elapsed time is added to that task or Daily Todo. One item timer can run at a time for each account.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'What does the Pomodoro feature include?',
      answer:
        'The standalone Focus Timer includes a 25-minute focus mode, 5-minute short break, 15-minute long break and custom durations. It creates no task, Todo or backend time record. Persisted Todo timing remains beside the Todo list.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'Which challenges are supported?',
      answer:
        'The app supports focused Reading challenges plus flexible Projects with reusable personal categories and clear workflow statuses.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'Can the AI change my password, email address or delete my account?',
      answer:
        'No. Sensitive account-security operations remain manual. The AI is limited to approved productivity features and cannot directly take over account-security settings.',
      category: 'features',
      isOpen: false,
    },

    {
      question: 'How do I reset my password?',
      answer:
        'Choose “Forgot password” on the login page and enter your account email. The app sends a single-use reset link to your email address. The configured reset-link lifetime is currently 30 minutes.',
      category: 'account',
      isOpen: false,
    },
    {
      question: 'What happens to existing sessions after I reset or change my password?',
      answer:
        'After a password reset or password change, older signed-in sessions become invalid and you sign in again using the new password.',
      category: 'account',
      isOpen: false,
    },
    {
      question: 'Can I delete my account?',
      answer:
        'Yes. Account deletion is available from account settings and requires your password plus an explicit DELETE confirmation. Associated app data is removed as part of the account-deletion flow.',
      category: 'account',
      isOpen: false,
    },
    {
      question: 'Does the AI have direct access to my database?',
      answer:
        'No. The AI only receives the information needed to answer your request or suggest an approved action. The app itself validates and saves changes, so the AI cannot run arbitrary database commands.',
      category: 'account',
      isOpen: false,
    },

    {
      question: 'What browsers are supported?',
      answer:
        'Use a current version of Chrome, Edge, Firefox or Safari for the web application. The interface is also tested across viewport widths from small phones through ultrawide desktop displays.',
      category: 'technical',
      isOpen: false,
    },
    {
      question: 'Can I install the app instead of only using the website?',
      answer:
        'Yes. The project supports an installable web app plus native packaging targets for macOS, Windows, Android and iPhone/iPad. Native public download buttons and QR codes remain disabled until a real package URL has been published for that platform.',
      category: 'technical',
      isOpen: false,
    },
    {
      question: 'Will the Mac app work on Intel and Apple Silicon?',
      answer:
        'The macOS packaging target is Universal, combining support for Intel and Apple Silicon Macs. Automated native checks verify both architectures in the generated macOS app bundle.',
      category: 'technical',
      isOpen: false,
    },
    {
      question: 'Can I install the native iPhone app immediately?',
      answer:
        'The iOS project and simulator build are supported, but installation on a physical iPhone requires Apple signing and provisioning. Public App Store or signed-device distribution also requires the appropriate Apple developer credentials.',
      category: 'technical',
      isOpen: false,
    },
    {
      question: 'Does the app work fully offline?',
      answer:
        'No full offline-data mode is promised. The application needs its online services for signed-in data, AI actions and persistent timers. Do not rely on task changes syncing while the service or network is unavailable.',
      category: 'technical',
      isOpen: false,
    },
  ];

  constructor(private sanitizer: DomSanitizer) {}

  get filteredFAQs(): FAQItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.faqs.filter((faq) => {
      const matchesCategory =
        this.selectedCategory === 'all' || faq.category === this.selectedCategory;
      const matchesSearch =
        !term ||
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }

  highlightText(text: string): SafeHtml {
    const term = this.searchTerm.trim();
    if (!term) return text;

    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    const highlightedText = text.replace(regex, '<mark class="highlight">$1</mark>');
    return this.sanitizer.sanitize(1, highlightedText) || text;
  }

  toggleFAQ(faq: FAQItem): void {
    this.faqs.forEach((item) => {
      if (item !== faq) item.isOpen = false;
    });
    faq.isOpen = !faq.isOpen;
  }

  onSearch(value: string): void {
    this.searchTerm = value;
  }

  onCategoryChange(value: string): void {
    this.selectedCategory = value;
  }
}
