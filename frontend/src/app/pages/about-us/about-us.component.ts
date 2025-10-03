import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  trigger,
  transition,
  style,
  animate,
} from '@angular/animations';

// Define the structure for a question/suggestion
interface Suggestion {
  title: string;
  questions: { q: string, a: string }[];
  isVisible?: boolean;
}

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DecimalPipe],
  templateUrl: './about-us.component.html',
  styleUrls: ['./about-us.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('fadeHide', [
      transition(':leave', [
        style({ opacity: 1, height: '*', margin: '*' }),
        animate('0.3s ease-out', style({ opacity: 0, height: '0', margin: '0' })),
      ]),
      transition(':enter', [
        style({ opacity: 0, height: '0', margin: '0' }),
        animate('0.3s ease-out', style({ opacity: 1, height: '*', margin: '*' })),
      ]),
    ]),
  ],
})
export class AboutUsComponent implements OnInit, OnDestroy {
  @ViewChildren('skillBar') skillBars!: QueryList<ElementRef>;
  private skillsAnimated = false;

  // Track which category is expanded
  activeCategory: number | null = null;
  showCategories: boolean = true;

  // --- FEATURE CARDS (Original, with new futuristic icons) ---
  featureCards = [
    {
      icon: 'fa-cogs',
      title: 'AI Smart Core',
      description:
        'Our core AI engine processes and prioritizes your tasks instantly, adapting to your workflow.',
    },
    {
      icon: 'fa-columns',
      title: 'Visual Workflow',
      description:
        'Intuitive drag-and-drop task boards for Kanban, Scrum, or any custom project management style.',
    },
    {
      icon: 'fa-clock',
      title: 'Time Synchronization',
      description:
        'Integrated calendar and time-blocking tools ensure you meet deadlines and optimize your schedule.',
    },
    {
      icon: 'fa-robot',
      title: 'Hyper-Focus Assist',
      description:
        'Receive personalized, non-intrusive reminders and productivity suggestions to maintain deep focus.',
    },
  ];

  // --- DEVELOPER SKILLS (Your Original Stack, with `animatedLevel` property) ---
  developerSkills = [
    {
      name: 'Frontend',
      level: 90,
      animatedLevel: 0,
      technologies: ['Angular', 'React', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Bootstrap', 'Tailwind CSS'],
    },
    {
      name: 'Backend',
      level: 90,
      animatedLevel: 0,
      technologies: ['C#', 'Java', 'Ruby', 'Node.js', 'Express', 'Java Spring Boot', 'Python', 'Bash', 'PowerShell', 'RSpec'],
    },
    {
      name: 'Database',
      level: 80,
      animatedLevel: 0,
      technologies: ['MongoDB', 'MySQL', 'PostgreSQL', 'MSSQL', 'Supabase'],
    },
    {
      name: 'DevOps',
      level: 70,
      animatedLevel: 0,
      technologies: ['Docker', 'AWS (EC2, S3, RDS, SES)', 'Azure (Fundamentals)', 'Kubernetes', 'Git/GitHub', 'CI/CD Pipelines'],
    },
    {
      name: 'ETL & Data Pipelines',
      level: 70,
      animatedLevel: 0,
      technologies: ['ETL Process Design', 'Data Transformation', 'Data Integration', 'Batch & Stream Processing'],
    },
  ];

  // Social media links
  socialLinks = [
    {
      icon: 'fa-github',
      url: 'https://github.com/PixieStack',
      name: 'GitHub',
    },
    {
      icon: 'fa-linkedin',
      url: 'https://www.linkedin.com/in/thembinkosi-eden-thwala-69083a1a4',
      name: 'LinkedIn',
    }
  ];

  // --- MINI CHATBOT DATA (populated from repository README / project info) ---
  miniKnowledge: Suggestion[] = [
    {
      title: 'Authentication & Users',
      questions: [
        {
          q: 'How does authentication work?',
          a:
            'TaskManager uses secure JWT-based authentication (frontend + backend) to protect API access and manage user sessions. Users register and log in with standard credentials and receive JWT tokens for API calls.',
        },
        {
          q: 'Can users change passwords and manage accounts?',
          a:
            'Yes — the app supports password changes and full account management. Profile customization (including profile images) is supported for a personalized experience.',
        },
        {
          q: 'Are profile pictures supported?',
          a:
          'Yes — user-specific profile pictures are supported so users can personalize their profiles.',
        },
      ],
    },
    {
      title: 'Task Management',
      questions: [
        {
          q: 'How do I create or edit tasks?',
          a:
            'The app provides full CRUD for tasks. You can create tasks with title, description, due date, priority and update them as needed using the UI or API.',
        },
        {
          q: 'What statuses and priorities exist?',
          a:
            'Tasks support statuses like "Not Started", "In Progress" and "Completed", plus priority levels (High, Medium, Low) for triage and sorting.',
        },
        {
          q: 'Does it support drag-and-drop and bulk operations?',
          a:
            'Yes — the UI includes drag-and-drop reordering and bulk operations to speed up task management for teams and power users.',
        },
      ],
    },
    {
      title: 'Analytics & Insights',
      questions: [
        {
          q: 'What analytics are available?',
          a:
            'A personal productivity dashboard provides completion stats, time-efficiency metrics, overdue task monitoring and trend analysis to help you understand work patterns.',
        },
        {
          q: 'How does time tracking & estimates work?',
          a:
            'Time spent can be logged on tasks and estimations stored, enabling comparison between expected vs actual effort in the analytics.',
        },
        {
          q: 'Can I see long-term productivity trends?',
          a:
            'Yes — the analytics include trend visualizations to identify peak performance periods and long-term patterns.',
        },
      ],
    },
    {
      title: 'User Experience',
      questions: [
        {
          q: 'Is the app responsive and mobile-ready?',
          a:
            'Yes — TaskManager uses a responsive Angular frontend designed to adapt across desktops, tablets and mobile devices.',
        },
        {
          q: 'Does the app support Dark/Light mode?',
          a:
            'Yes — the UI supports theme preferences including dark and light modes to reduce eye strain and match user preference.',
        },
        {
          q: 'Are there smooth animations and transitions?',
          a:
          'Yes — Angular Animations are used to provide fluid UI transitions across the app for a polished experience.',
        },
      ],
    },
    {
      title: 'Communication & Notifications',
      questions: [
        {
          q: 'How do contact forms and admin messages work?',
          a:
            'There is a contact form that integrates with SMTP on the backend; admin message management tools allow administrators to manage inbound messages.',
        },
        {
          q: 'Are email notifications supported?',
          a:
            'Yes — SMTP integration is available for sending notifications like overdue alerts and contact form emails.',
        },
        {
          q: 'Is there an admin notification center?',
          a:
            'The backend provides admin-focused message management for timely responses and tracking user communications.',
        },
      ],
    },
    {
      title: 'Tech Stack & Setup',
      questions: [
        {
          q: 'What does the frontend use?',
          a:
            'Frontend: Angular (recent version), TypeScript, SCSS, Angular Animations and Reactive Forms.',
        },
                {
          q: 'What does the backend use?',
          a:
            'Backend: FastAPI + SQLAlchemy, SQLite for development, Pydantic for validation and JWT for auth.',
        },
        {
          q: 'How can I run the project locally?',
          a:
            'The repo includes setup scripts and a docker-compose (see repository root). You can run frontend and backend locally via the provided setup steps or Docker compose for a full stack environment.',
        },
      ],
    },
  ];

  // Chat UI state
  chatMessages: { sender: 'user' | 'bot'; text: string }[] = [
    { sender: 'bot', text: `Hi — I'm Mini, the M.O.B TaskManager assistant. Type <strong>hello</strong> to see guided questions.` }
  ];
  userInput = '';
  showSuggestions = false;
  // State for the interactive flow (cascading behavior)
  awaitingFollowUp = false;

  constructor(private elementRef: ElementRef) { }

  ngOnInit(): void {
    // Start skill bar animations after a short delay (preserve original behavior)
    setTimeout(() => {
      this.animateSkillBars();
    }, 1500);
  }

  ngOnDestroy(): void {
    // nothing slideshow-related to clear anymore (slides were removed)
  }

  // Toggle category expansion
  toggleCategory(index: number): void {
    if (this.activeCategory === index) {
      // If clicking the same category, go back to showing all categories
      this.activeCategory = null;
      this.showCategories = true;
    } else {
      // Show only the selected category and its questions
      this.activeCategory = index;
      this.showCategories = false;
    }
  }

  // Go back to categories view
  backToCategories(): void {
    this.activeCategory = null;
    this.showCategories = true;
  }

  // Refresh/Reset the chatbot
  refreshChat(): void {
    // Reset all chat states
    this.chatMessages = [
      { sender: 'bot', text: `Hi — I'm Mini, the M.O.B TaskManager assistant. Type <strong>hello</strong> to see guided questions.` }
    ];
    this.userInput = '';
    this.showSuggestions = false;
    this.awaitingFollowUp = false;
    this.activeCategory = null;
    this.showCategories = true;
    
    // Scroll to top of chat
    setTimeout(() => {
      const chatWindow = this.elementRef.nativeElement.querySelector('.chat-window');
      if (chatWindow) {
        chatWindow.scrollTop = 0;
      }
    }, 0);
  }

  // --- Chatbot handlers ---
  handleUserInput(): void {
    const raw = (this.userInput || '').trim();
    if (!raw) return;

    // Add user msg
    this.chatMessages.push({ sender: 'user', text: raw });

    const low = raw.toLowerCase();

    // 1. Handle Awaiting Follow-Up (Y/N)
    if (this.awaitingFollowUp) {
      if (low === 'yes' || low === 'y') {
        this.awaitingFollowUp = false;
        this.showSuggestions = true;
        this.activeCategory = null; // Reset category selection
        this.showCategories = true; // Show all categories again
        this.chatMessages.push({
          sender: 'bot',
          text: `Great! Here are the topics again. Pick a new question.`,
        });
      } else if (low === 'no' || low === 'n') {
        this.awaitingFollowUp = false;
        this.showSuggestions = false;
        // Quote message + Bye message
        this.chatMessages.push({
          sender: 'bot',
          text: `&quot;The secret of getting ahead is getting started.&quot; - Mark Twain`,
        });
        this.chatMessages.push({
          sender: 'bot',
          text: `Understood. Thanks for chatting! Goodbye.`,
        });
      } else {
        this.chatMessages.push({
          sender: 'bot',
          text: `Please answer with **Yes** or **No** (Y/N).`,
        });
      }

      this.userInput = '';
      this.scrollChatToBottom();
      return;
    }

    // 2. Handle Initial 'hello'
    if (low === 'hello') {
      this.showSuggestions = true;
      this.activeCategory = null; // Reset category selection
      this.showCategories = true; // Show all categories
      this.chatMessages.push({
        sender: 'bot',
        text: `Hello! I can answer common questions about M.O.B TaskManager. Pick a topic below or click a suggested question.`,
      });
      this.userInput = '';
      this.scrollChatToBottom();
      return;
    }

    // 3. Handle Question Match (only if suggestions are shown)
    if (this.showSuggestions) {
      const match = this.findQuestion(raw);
      if (match) {
        // Answer question
        this.chatMessages.push({ sender: 'bot', text: match.answer });
        this.askForFollowUp(); // Start the interactive flow
      } else {
        this.chatMessages.push({
          sender: 'bot',
          text: `Sorry — I don't have a direct answer for that phrasing. Try one of the suggested questions.`,
        });
      }
    } else {
      // 4. Nudge user to start with 'hello' if no interaction yet
      this.chatMessages.push({
        sender: 'bot',
        text: `Please type <strong>hello</strong> first — I'll then show guided questions about the app.`,
      });
    }

    this.userInput = '';
    this.scrollChatToBottom();
  }

  selectQuestion(catIndex: number, qIndex: number): void {
    const qObj = this.miniKnowledge[catIndex].questions[qIndex];
    // simulate user clicking the suggestion (add user message)
    this.chatMessages.push({ sender: 'user', text: qObj.q });
    // add bot answer
    this.chatMessages.push({ sender: 'bot', text: qObj.a });
    this.askForFollowUp(); // Start the interactive flow
  }

  /**
   * Clears suggestions and prompts user for continuation, setting up the 'Y/N' flow.
   */
  private askForFollowUp(): void {
    this.showSuggestions = false; // Hide suggestions after selection
    this.awaitingFollowUp = true; // Engage Y/N mode
    this.chatMessages.push({
      sender: 'bot',
      text: `Question answered. Do you want to ask another question? **(Yes/No)**`,
    });
    this.scrollChatToBottom();
  }

  private findQuestion(text: string): { answer: string } | null {
    const low = text.toLowerCase();
    for (const cat of this.miniKnowledge) {
      for (const q of cat.questions) {
        if (q.q.toLowerCase() === low) {
          return { answer: q.a };
        }
      }
    }
    return null;
  }

  private scrollChatToBottom(): void {
    // Use setTimeout to wait for the DOM to update after message addition/removal
    setTimeout(() => {
      const chatWindow = this.elementRef.nativeElement.querySelector('.chat-window');
      if (chatWindow) {
        chatWindow.scrollTop = chatWindow.scrollHeight;
      }
    }, 0);
  }

  // --- Animation logic preserved for skill bars ---
  animateSkillBars(): void {
    if (this.skillsAnimated) return;
    this.skillsAnimated = true;

    this.developerSkills.forEach((skill, index) => {
      setTimeout(() => {
        this.animateSkillBar(skill);
      }, index * 300);
    });
  }

  private animateSkillBar(skill: any): void {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const easeLevel = skill.level * (1 - Math.cos((currentStep / steps) * (Math.PI / 2)));
      skill.animatedLevel = Math.min(easeLevel, skill.level);

      if (currentStep >= steps) {
        clearInterval(timer);
        skill.animatedLevel = skill.level;
      }
    }, stepDuration);
  }

  trackByFn(index: number): number {
    return index;
  }
}