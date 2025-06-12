import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  footerLinks = {
    product: [
      { label: 'Features', route: '/key-features' },
      { label: 'Dashboard', route: '/dashboard', protected: true },
      { label: 'About', route: '/about' },
    ],
    support: [
      { label: 'Contact', route: '/contact' },
      { label: 'FAQ', route: '/faq' },
    ],
    legal: [
      { label: 'Privacy Policy', route: '/privacy' },
      { label: 'Terms of Service', route: '/terms' },
      { label: 'Cookie Policy', route: '/cookies' },
    ],
  };

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  navigateToRoute(link: any): void {
    if (link.protected && !this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate([link.route]);
    }
  }
}
