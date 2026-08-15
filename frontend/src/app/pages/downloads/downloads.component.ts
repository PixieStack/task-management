import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import {
  APP_VERSION,
  AppUpdateService,
  AppUpdateState,
  DownloadManifest,
  DownloadTargetConfig,
  DownloadTargetId,
} from '../../shared/services/app-update.service';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface DownloadCard {
  id: DownloadTargetId;
  title: string;
  subtitle: string;
  icon: string;
  packageLabel: string;
  notes: string[];
}

const EMPTY_TARGET: DownloadTargetConfig = {
  available: false,
  url: '',
  version: APP_VERSION,
  releaseDate: '',
};

@Component({
  selector: 'app-downloads',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './downloads.component.html',
  styleUrls: ['./downloads.component.scss'],
})
export class DownloadsComponent implements OnInit, OnDestroy {
  readonly cards: DownloadCard[] = [
    {
      id: 'macos',
      title: 'macOS',
      subtitle: 'Universal app for Intel and Apple Silicon Macs.',
      icon: 'fab fa-apple',
      packageLabel: 'Download macOS app',
      notes: ['One package supports Intel x86_64 and Apple Silicon arm64 Macs.'],
    },
    {
      id: 'windowsX64',
      title: 'Windows x64',
      subtitle: 'Installer for standard 64-bit Intel/AMD Windows PCs.',
      icon: 'fab fa-windows',
      packageLabel: 'Download Windows app',
      notes: ['Recommended for most Windows computers.'],
    },
    {
      id: 'windowsArm64',
      title: 'Windows ARM64',
      subtitle: 'Installer for newer ARM-based Windows PCs.',
      icon: 'fab fa-windows',
      packageLabel: 'Download Windows ARM64 app',
      notes: ['Built specifically for ARM64 Windows devices.'],
    },
    {
      id: 'android',
      title: 'Android',
      subtitle: 'Installable APK for Android phones and tablets.',
      icon: 'fab fa-android',
      packageLabel: 'Download Android app',
      notes: ['Android may ask you to allow installation from your browser.'],
    },
    {
      id: 'ios',
      title: 'iPhone / iPad',
      subtitle: 'Install the web app from Safari on iPhone or iPad.',
      icon: 'fas fa-mobile-screen-button',
      packageLabel: 'Install on iPhone / iPad',
      notes: ['In Safari, tap Share and then Add to Home Screen.'],
    },
  ];

  manifest: DownloadManifest = {
    macos: { ...EMPTY_TARGET },
    windowsX64: { ...EMPTY_TARGET },
    windowsArm64: { ...EMPTY_TARGET },
    android: { ...EMPTY_TARGET },
    ios: { ...EMPTY_TARGET },
  };

  isBrowser = false;
  isLoggedIn = false;
  isIos = false;
  isStandalone = false;
  installStatus = '';
  detectedTarget: DownloadTargetId | null = null;
  updateState: AppUpdateState;

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private updateSubscription?: Subscription;
  private readonly beforeInstallHandler = (event: Event): void => {
    event.preventDefault();
    this.deferredPrompt = event as BeforeInstallPromptEvent;
  };

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    readonly appUpdate: AppUpdateService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.updateState = this.appUpdate.snapshot;
  }

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.isLoggedIn = this.authService.isLoggedIn();
    if (!this.isBrowser) return;

    this.isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    this.detectedTarget = this.detectDeviceTarget();
    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);

    this.updateSubscription = this.appUpdate.state$.subscribe((state) => {
      this.updateState = state;
      this.changeDetectorRef.markForCheck();
    });
    void this.appUpdate.initialize(this.detectedTarget);
    this.loadManifest();
  }

  ngOnDestroy(): void {
    if (this.isBrowser) window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
    this.updateSubscription?.unsubscribe();
  }

  get displayedCards(): DownloadCard[] {
    if (!this.isLoggedIn) return this.cards;
    const detectedCard = this.cards.find((card) => card.id === this.detectedTarget);
    return detectedCard ? [detectedCard] : [];
  }

  target(card: DownloadCard): DownloadTargetConfig {
    return this.manifest[card.id];
  }

  releaseDate(card: DownloadCard): string {
    const value = this.target(card).releaseDate;
    if (!value) return 'To be announced';
    return new Intl.DateTimeFormat('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
  }

  startDownload(card: DownloadCard): void {
    if (!this.isLoggedIn) return;
    if (card.id === 'ios') {
      void this.installWebApp();
      return;
    }
    const target = this.target(card);
    if (target.available && target.url) window.location.assign(target.url);
  }

  async installWebApp(): Promise<void> {
    if (this.isStandalone) {
      this.installStatus = 'The iPhone/iPad web app is already installed.';
      return;
    }
    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.installStatus = choice.outcome === 'accepted'
        ? 'Install accepted. Follow your browser to finish.'
        : 'Install cancelled. You can install it later from this page.';
      this.deferredPrompt = null;
      return;
    }
    this.installStatus = this.isIos
      ? 'In Safari, tap Share, then choose Add to Home Screen.'
      : 'Open your browser menu and choose Install app or Add to Home Screen.';
  }

  checkForUpdates(): void {
    void this.appUpdate.checkForUpdates();
  }

  installUpdate(): void {
    void this.appUpdate.installUpdate();
  }

  private loadManifest(): void {
    this.http.get<Partial<DownloadManifest>>('/downloads.json').subscribe({
      next: (config) => {
        this.manifest = this.mergeManifest(config);
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  private detectDeviceTarget(): DownloadTargetId | null {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    const isTouchMac = platform.includes('mac') && navigator.maxTouchPoints > 1;
    if (userAgent.includes('android')) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent) || isTouchMac) return 'ios';
    if (platform.includes('mac') || userAgent.includes('macintosh')) return 'macos';
    if (platform.includes('win') || userAgent.includes('windows')) {
      return /arm64|aarch64/.test(userAgent) ? 'windowsArm64' : 'windowsX64';
    }
    return null;
  }

  private mergeManifest(config: Partial<DownloadManifest>): DownloadManifest {
    return {
      macos: { ...EMPTY_TARGET, ...config.macos },
      windowsX64: { ...EMPTY_TARGET, ...config.windowsX64 },
      windowsArm64: { ...EMPTY_TARGET, ...config.windowsArm64 },
      android: { ...EMPTY_TARGET, ...config.android },
      ios: { ...EMPTY_TARGET, ...config.ios },
    };
  }
}
