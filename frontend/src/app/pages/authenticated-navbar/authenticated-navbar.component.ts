import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-authenticated-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './authenticated-navbar.component.html',
  styleUrls: ['./authenticated-navbar.component.scss']
})
export class AuthenticatedNavbarComponent implements OnInit {
  username: string | null = null;
  email: string | null = null;
  profilePicture: string | null = null;
  greeting: string = 'Welcome back';
  greetingEmoji: string = '👋';
  isDarkMode: boolean = false;
  isProfileDropdownOpen: boolean = false;
  currentUserId: string | null = null;

  constructor(private authService: AuthService) {}
  
  ngOnInit(): void {
    // Get current user ID
    this.currentUserId = this.authService.getUserId();
    
    // Subscribe to the user observable to update UI when auth state changes
    this.authService.user$.subscribe(user => {
      this.username = user?.username || 'User';
      this.email = user?.email || null;
      
      // Update user ID and profile picture when user changes
      this.currentUserId = this.authService.getUserId();
      this.loadUserProfilePicture();
    });
    
    this.username = this.authService.getUsername() || 'User';
    
    // Load user-specific profile picture
    this.loadUserProfilePicture();
    
    this.setGreetingByTimeOfDay();
    
    const darkModePreference = localStorage.getItem('darkMode');
    this.isDarkMode = darkModePreference === 'true';
  }

  // Load user-specific profile picture
  private loadUserProfilePicture(): void {
    if (this.currentUserId) {
      this.profilePicture = localStorage.getItem(`profilePicture_${this.currentUserId}`);
    } else {
      this.profilePicture = null;
    }
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  clickOutside(event: any): void {
    const profileElement = document.querySelector('.profile-dropdown-container');
    if (profileElement && !profileElement.contains(event.target)) {
      this.isProfileDropdownOpen = false;
    }
  }

  // Toggle profile dropdown
  toggleProfileDropdown(event: Event): void {
    event.stopPropagation(); 
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  // Close dropdown programmatically
  closeProfileDropdown(): void {
    this.isProfileDropdownOpen = false;
  }

  // Profile picture upload functionality
  addProfilePicture(event: Event): void {
    event.stopPropagation(); 
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length && this.currentUserId) {
        const file = target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
          this.profilePicture = event.target?.result as string;
          localStorage.setItem(`profilePicture_${this.currentUserId}`, this.profilePicture);
        };
        
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  }
  
  // Set greeting and emoji based on time of day
  setGreetingByTimeOfDay(): void {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      this.greeting = 'Good morning';
      this.greetingEmoji = '☀️';  
    } else if (hour >= 12 && hour < 18) {
      this.greeting = 'Good afternoon';
      this.greetingEmoji = '🌤️';  
    } else if (hour >= 18 && hour < 22) {
      this.greeting = 'Good evening';
      this.greetingEmoji = '🌙';  
    } else {
      this.greeting = 'Good night';
      this.greetingEmoji = '✨';  
    }
  }

  logout(): void {
    this.authService.logout();
    this.closeProfileDropdown(); 
  }
}