import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';

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
        'M.O.B TaskManager is a personal productivity workspace for tasks, Daily Todos, habits, reading and meditation challenges, Pomodoro focus, persistent time tracking and AI-assisted actions.',
      category: 'general',
      isOpen: false,
    },
    {
      question: 'What can the AI assistant actually do?',
      answer:
        'The assistant can answer questions using your current productivity context and can perform an approved set of actions such as creating or updating tasks and Daily Todos, working with habits and reading or meditation challenges, and starting or stopping task/todo timers. FastAPI validates the action and your ownership before data changes.',
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
        'Persistent account and productivity data is stored in the Task Manager PostgreSQL database hosted on Supabase. The application accesses that data through the FastAPI backend rather than giving the browser or AI model direct database access.',
      category: 'general',
      isOpen: false,
    },
    {
      question: 'How are registration and password-reset emails sent?',
      answer:
        'Account emails are sent by the FastAPI backend through Brevo SMTP. Supabase is used as the PostgreSQL data store and is not used as the application email provider.',
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
        'Starting a timer creates a persisted time session on the backend. A running session can survive a page refresh, and stopping it adds the elapsed time to that task or Daily Todo. The app allows one active item timer per account at a time.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'What does the Pomodoro feature include?',
      answer:
        'The Focus workspace includes a standard 25-minute focus mode, 5-minute short break, 15-minute long break and custom durations. Pomodoro is separate from an item timer, so you can use the study interval while also measuring time spent on a specific task or todo.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'Which challenges are supported?',
      answer:
        'The current app intentionally supports Reading and Meditation challenges. Older generic diet, fasting, coding, exercise and other challenge concepts were removed to keep the product focused.',
      category: 'features',
      isOpen: false,
    },
    {
      question: 'Can the AI change my password, email address or delete my account?',
      answer:
        'No. Sensitive account-security operations remain manual. The AI action layer is limited to approved productivity features and does not receive arbitrary SQL, backend-code or account-security access.',
      category: 'features',
      isOpen: false,
    },

    {
      question: 'How do I reset my password?',
      answer:
        'Choose “Forgot password” on the login page and enter your account email. The backend creates a single-use reset token and sends the reset link through Brevo SMTP. The configured reset-link lifetime is currently 30 minutes.',
      category: 'account',
      isOpen: false,
    },
    {
      question: 'What happens to existing sessions after I reset or change my password?',
      answer:
        'Password reset and password change increment the account authentication version. Existing JWT sessions tied to the older version become invalid and you sign in again using the new credentials.',
      category: 'account',
      isOpen: false,
    },
    {
      question: 'Can I delete my account?',
      answer:
        'Yes. Account deletion is available from account settings and requires your password plus the explicit DELETE confirmation phrase. Associated app data is removed as part of the account-deletion flow.',
      category: 'account',
      isOpen: false,
    },
    {
      question: 'Does the AI have direct access to my database?',
      answer:
        'No. Groq receives the context needed to answer or plan an approved action, while FastAPI owns validation and persistence. The AI model cannot issue arbitrary database queries.',
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
        'Yes. The project supports an installable PWA plus native packaging targets for macOS, Windows, Android and iPhone/iPad. Native public download buttons and QR codes remain disabled until a real package URL has been published for that platform.',
      category: 'technical',
      isOpen: false,
    },
    {
      question: 'Will the Mac app work on Intel and Apple Silicon?',
      answer:
        'The macOS packaging target is Universal, combining x86_64 for Intel Macs and arm64 for Apple Silicon Macs. The automated native smoke workflow verifies both architectures in the generated macOS app bundle.',
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
        'No full offline-data mode is promised. The application depends on the FastAPI backend for authenticated data, AI actions and persistent timers. Do not rely on task changes syncing while the backend or network is unavailable.',
      category: 'technical',
      isOpen: false,
    },
  ];

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
  ) {}

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

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }
}
