import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  trigger,
  transition,
  style,
  animate,
  state,
} from '@angular/animations';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-us.component.html',
  styleUrls: ['./about-us.component.scss'],
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
    trigger('slideAnimation', [
      state('active', style({ opacity: 1 })),
      state('inactive', style({ opacity: 0 })),
      transition('inactive => active', animate('500ms ease-in')),
      transition('active => inactive', animate('500ms ease-out')),
    ]),
  ],
})
export class AboutUsComponent implements OnInit, OnDestroy {
  slideImages = [
    { url: 'assets/slide/slide1.png', alt: 'Slide 1' },
    { url: 'assets/slide/slide2.png', alt: 'Slide 2' },
    { url: 'assets/slide/slide3.png', alt: 'Slide 3' },
    { url: 'assets/slide/slide4.png', alt: 'Slide 4' },
    { url: 'assets/slide/slide5.png', alt: 'Slide 5' },
    { url: 'assets/slide/slide6.png', alt: 'Slide 6' },
    { url: 'assets/slide/slide7.avif', alt: 'Slide 7' },
    { url: 'assets/slide/slide8.png', alt: 'Slide 8' },
    { url: 'assets/slide/slide9.png', alt: 'Slide 9' },
    { url: 'assets/slide/slide10.png', alt: 'Slide 10' },
  ];
  currentSlide = 0;
  private slideInterval: any;

  // Feature cards
  featureCards = [
    {
      icon: 'fa-inbox',
      title: 'Smart Inbox',
      description:
        'AI organizes your to-dos automatically, prioritizing what matters most.',
    },
    {
      icon: 'fa-tasks',
      title: 'Task Boards',
      description:
        'Intuitive drag-and-drop workflow management with custom categories.',
    },
    {
      icon: 'fa-calendar',
      title: 'Calendar View',
      description:
        'Visualize your schedule with ease and manage your time effectively.',
    },
    {
      icon: 'fa-robot',
      title: 'AI Assistant',
      description:
        'Personalized reminders and productivity suggestions based on your habits.',
    },
  ];

  // Developer skills with animated property
  developerSkills = [
    {
      name: 'Frontend',
      level: 80,
      animatedLevel: 0,
      technologies: ['Angular', 'React', 'TypeScript', 'HTML/CSS'],
    },
    {
      name: 'Backend',
      level: 90,
      animatedLevel: 0,
      technologies: ['Node.js', 'Express', 'Java Spring Boot'],
    },
    {
      name: 'Database',
      level: 85,
      animatedLevel: 0,
      technologies: ['MongoDB', 'MySQL', 'PostgreSQL'],
    },
    {
      name: 'DevOps',
      level: 80,
      animatedLevel: 0,
      technologies: ['Docker', 'AWS', 'CI/CD'],
    },
  ];

  // Social media links
  socialLinks = [
    {
      icon: 'fa-github',
      url: 'https://github.com/yourusername',
      name: 'GitHub',
    },
    {
      icon: 'fa-linkedin',
      url: 'https://linkedin.com/in/yourusername',
      name: 'LinkedIn',
    },
    {
      icon: 'fa-twitter',
      url: 'https://twitter.com/yourusername',
      name: 'Twitter',
    },
  ];

  // Project statistics
  projectStats = [
    { value: '15+', label: 'Projects Completed' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Support Available' },
    { value: '4.9/5', label: 'Customer Rating' },
  ];

  constructor() {}

  ngOnInit(): void {
    this.startSlideshow();

    setTimeout(() => {
      this.animateSkillBars();
    }, 1500);
  }

  ngOnDestroy(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  startSlideshow(): void {
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  pauseSlideshow(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  resumeSlideshow(): void {
    this.startSlideshow();
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slideImages.length;
  }

  prevSlide(): void {
    this.currentSlide =
      (this.currentSlide - 1 + this.slideImages.length) %
      this.slideImages.length;
  }

  setCurrentSlide(index: number): void {
    this.currentSlide = index;
  }

  getSlideState(index: number): string {
    return index === this.currentSlide ? 'active' : 'inactive';
  }

  animateSkillBars(): void {
    this.developerSkills.forEach((skill, index) => {
      setTimeout(() => {
        this.animateSkillBar(skill);
      }, index * 300);
    });
  }

  private animateSkillBar(skill: any): void {
    const duration = 1500;
    const steps = 60;
    const increment = skill.level / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      skill.animatedLevel = Math.min(currentStep * increment, skill.level);

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
