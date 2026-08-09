import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { ProfileService } from '../../shared/services/profile.service';

@Component({ selector: 'app-authenticated-navbar', standalone: true, imports: [CommonModule, RouterModule], templateUrl: './authenticated-navbar.component.html', styleUrls: ['./authenticated-navbar.component.scss'] })
export class AuthenticatedNavbarComponent implements OnInit {
  username: string | null = null; email: string | null = null; profilePicture: string | null = null; greeting = 'Welcome back'; greetingEmoji = '👋'; isProfileDropdownOpen = false;
  constructor(private authService: AuthService, private profileService: ProfileService) {}
  ngOnInit(): void { this.setGreetingByTimeOfDay(); this.authService.user$.subscribe((user) => { this.username = user?.username || 'User'; this.email = user?.email || null; if (user) this.loadProfilePicture(); else this.profilePicture = null; }); const current = this.authService.getCurrentUser(); this.username = current?.username || this.authService.getUsername() || 'User'; this.email = current?.email || this.authService.getUserEmail(); if (this.authService.isLoggedIn()) this.loadProfilePicture(); }
  @HostListener('document:click', ['$event']) clickOutside(event: Event): void { const target = event.target as Node | null; const el = document.querySelector('.profile-dropdown-container'); if (el && target && !el.contains(target)) this.isProfileDropdownOpen = false; }
  @HostListener('window:profile-picture-updated', ['$event']) profilePictureUpdated(event: Event): void { this.profilePicture = (event as CustomEvent<string | null>).detail || null; }
  toggleProfileDropdown(event: Event): void { event.stopPropagation(); this.isProfileDropdownOpen = !this.isProfileDropdownOpen; }
  closeProfileDropdown(): void { this.isProfileDropdownOpen = false; }
  addProfilePicture(event: Event): void { event.stopPropagation(); const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.onchange = () => { const file = input.files?.[0]; if (!file) return; this.profileService.prepareProfilePicture(file).then((image) => { this.profileService.uploadProfilePicture(image).subscribe({ next: (profile) => { this.profilePicture = profile.profile_picture || null; const id = this.authService.getUserId(); if (id && this.profilePicture) localStorage.setItem(`profilePicture_${id}`, this.profilePicture); } }); }).catch(() => undefined); }; input.click(); }
  setGreetingByTimeOfDay(): void { const hour = new Date().getHours(); if (hour >= 5 && hour < 12) { this.greeting = 'Good morning'; this.greetingEmoji = '☀️'; } else if (hour < 18) { this.greeting = 'Good afternoon'; this.greetingEmoji = '🌤️'; } else if (hour < 22) { this.greeting = 'Good evening'; this.greetingEmoji = '🌙'; } else { this.greeting = 'Good night'; this.greetingEmoji = '✨'; } }
  logout(): void { this.closeProfileDropdown(); this.authService.logout(); }
  private loadProfilePicture(): void { const id = this.authService.getUserId(); if (id) this.profilePicture = localStorage.getItem(`profilePicture_${id}`) || null; this.profileService.getProfile().subscribe({ next: (profile) => { this.profilePicture = profile.profile_picture || null; if (id && this.profilePicture) localStorage.setItem(`profilePicture_${id}`, this.profilePicture); }, error: () => undefined }); }
}
