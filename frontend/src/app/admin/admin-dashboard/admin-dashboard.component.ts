import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  AdminAccount,
  AdminAiActivity,
  AdminAuditLog,
  AdminHealth,
  AdminOverview,
  AdminService,
  ApiMetric,
  DeletedAccount,
} from '../../shared/services/admin.service';
import { AuthService } from '../../shared/services/auth.service';

type AdminSection = 'overview' | 'accounts' | 'health' | 'api' | 'ai' | 'audit';
type AccountView = 'live' | 'deleted';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  section: AdminSection = 'overview';
  accountView: AccountView = 'live';
  accountFilter = 'all';
  overview?: AdminOverview;
  health?: AdminHealth;
  accounts: AdminAccount[] = [];
  deletedAccounts: DeletedAccount[] = [];
  metrics: ApiMetric[] = [];
  aiActivity: AdminAiActivity[] = [];
  auditLogs: AdminAuditLog[] = [];
  adminName = 'Administrator';
  adminEmail = '';
  loading = true;
  errorMessage = '';
  successMessage = '';

  constructor(
    private admin: AdminService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.admin.session().subscribe({
      next: (session) => {
        this.adminName = session.user.username;
        this.adminEmail = session.user.email;
      },
      error: () => this.router.navigate(['/admin/login']),
    });
    this.refreshAll();
  }

  setSection(section: AdminSection): void {
    this.section = section;
    this.loadSection(section);
  }

  refreshAll(): void {
    this.loading = true;
    this.errorMessage = '';
    let remaining = 6;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) this.loading = false;
    };
    this.admin.overview().subscribe({ next: (value) => { this.overview = value; done(); }, error: (e) => { this.fail(e); done(); } });
    this.admin.health().subscribe({ next: (value) => { this.health = value; done(); }, error: (e) => { this.fail(e); done(); } });
    this.admin.accounts(this.accountFilter).subscribe({ next: (value) => { this.accounts = value; done(); }, error: (e) => { this.fail(e); done(); } });
    this.admin.deletedAccounts().subscribe({ next: (value) => { this.deletedAccounts = value; done(); }, error: (e) => { this.fail(e); done(); } });
    this.admin.apiMetrics().subscribe({ next: (value) => { this.metrics = value; done(); }, error: (e) => { this.fail(e); done(); } });
    this.admin.aiActivity().subscribe({ next: (value) => { this.aiActivity = value; done(); }, error: (e) => { this.fail(e); done(); } });
    this.admin.auditLogs().subscribe({ next: (value) => { this.auditLogs = value; }, error: (e) => this.fail(e) });
  }

  loadSection(section: AdminSection): void {
    this.errorMessage = '';
    if (section === 'overview') this.admin.overview().subscribe({ next: (v) => this.overview = v, error: (e) => this.fail(e) });
    if (section === 'accounts') this.reloadAccounts();
    if (section === 'health') this.admin.health().subscribe({ next: (v) => this.health = v, error: (e) => this.fail(e) });
    if (section === 'api') this.admin.apiMetrics().subscribe({ next: (v) => this.metrics = v, error: (e) => this.fail(e) });
    if (section === 'ai') this.admin.aiActivity().subscribe({ next: (v) => this.aiActivity = v, error: (e) => this.fail(e) });
    if (section === 'audit') this.admin.auditLogs().subscribe({ next: (v) => this.auditLogs = v, error: (e) => this.fail(e) });
  }

  reloadAccounts(): void {
    this.admin.accounts(this.accountFilter).subscribe({ next: (v) => this.accounts = v, error: (e) => this.fail(e) });
    this.admin.deletedAccounts().subscribe({ next: (v) => this.deletedAccounts = v, error: (e) => this.fail(e) });
  }

  suspend(account: AdminAccount): void {
    if (!confirm(`Suspend ${account.email}? Existing sessions will stop working.`)) return;
    this.admin.suspendAccount(account.id).subscribe({
      next: (result) => { this.success(result.message); this.reloadAccounts(); this.loadSection('overview'); },
      error: (e) => this.fail(e),
    });
  }

  reactivate(account: AdminAccount): void {
    this.admin.reactivateAccount(account.id).subscribe({
      next: (result) => { this.success(result.message); this.reloadAccounts(); this.loadSection('overview'); },
      error: (e) => this.fail(e),
    });
  }

  forceLogout(account: AdminAccount): void {
    if (!confirm(`Force all existing sessions for ${account.email} to sign in again?`)) return;
    this.admin.forceLogout(account.id).subscribe({
      next: (result) => this.success(result.message),
      error: (e) => this.fail(e),
    });
  }

  logout(): void {
    this.auth.logout();
  }

  formatUptime(seconds = 0): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}d ${hours}h ${minutes}m`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  statusLabel(status?: string): string {
    if (!status) return 'Unknown';
    return status.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  auditDetails(log: AdminAuditLog): string {
    if (!log.details) return '';
    if (typeof log.details === 'string') return log.details;
    return Object.entries(log.details).map(([key, value]) => `${key}: ${value}`).join(' · ');
  }

  private fail(error: any): void {
    this.errorMessage = error?.error?.detail || error?.message || 'Admin data could not be loaded.';
  }

  private success(message: string): void {
    this.successMessage = message;
    window.setTimeout(() => this.successMessage = '', 3500);
  }
}
