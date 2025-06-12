import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { KeyFeaturesComponent } from './pages/key-features/key-features.component';
import { AboutUsComponent } from './pages/about-us/about-us.component'; 
import { ContactCtaComponent } from './shared/contact-cta/contact-cta.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AuthGuard } from './auth.guard';
export const routes: Routes = [
  // Public routes
  { path: '', component: HomeComponent },
  { path: 'key-features', component: KeyFeaturesComponent },
  { path: 'about', component: AboutUsComponent },
  { path: 'contact', component: ContactCtaComponent },
  
  // Auth routes
  { 
    path: 'login', 
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  { 
    path: 'register', 
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
  },
  
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard]  
  },
  { 
    path: 'profile', 
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard] 
  },
  { 
    path: 'account-security', 
    loadComponent: () => import('./pages/account-security/account-security.component').then(m => m.AccountSecurityComponent),
    canActivate: [AuthGuard]  
  },

  { path: '**', redirectTo: '' },
];