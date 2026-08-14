import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { KeyFeaturesComponent } from './pages/key-features/key-features.component';
import { AboutUsComponent } from './pages/about-us/about-us.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'key-features', component: KeyFeaturesComponent },
  {
    path: 'downloads',
    loadComponent: () =>
      import('./pages/downloads/downloads.component').then((m) => m.DownloadsComponent),
  },
  { path: 'about', component: AboutUsComponent },
  { path: 'access', loadComponent: () => import('./auth/access/access.component').then((m) => m.AccessComponent) },
  { path: 'login', loadComponent: () => import('./auth/access/access.component').then((m) => m.AccessComponent) },
  { path: 'register', loadComponent: () => import('./auth/access/access.component').then((m) => m.AccessComponent) },
  { path: 'forgot-password', loadComponent: () => import('./auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent) },
  { path: 'reset-password', loadComponent: () => import('./auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent) },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  {
    path: 'todo',
    loadComponent: () => import('./pages/focus/focus.component').then((m) => m.FocusComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'focus-timer',
    loadComponent: () => import('./pages/focus-timer/focus-timer.component').then((m) => m.FocusTimerComponent),
    canActivate: [AuthGuard],
  },
  { path: 'focus', redirectTo: 'focus-timer', pathMatch: 'full' },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent), canActivate: [AuthGuard] },
  { path: 'account-security', redirectTo: 'profile', pathMatch: 'full' },

  // Private operations portal. Intentionally not linked from public or user navigation.
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/admin-login/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    canActivate: [AdminGuard],
  },

  { path: 'faq', loadComponent: () => import('./pages/faq/faq.component').then((m) => m.FaqComponent) },
  { path: 'privacy', loadComponent: () => import('./pages/privacy-policy/privacy-policy.component').then((m) => m.PrivacyPolicyComponent) },
  { path: 'terms', loadComponent: () => import('./pages/terms-of-service/terms-of-service.component').then((m) => m.TermsOfServiceComponent) },
  { path: 'cookies', loadComponent: () => import('./pages/cookie-policy/cookie-policy.component').then((m) => m.CookiePolicyComponent) },
  { path: '**', redirectTo: '' },
];
