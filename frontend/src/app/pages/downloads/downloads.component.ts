import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import * as QRCode from 'qrcode';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface DownloadTargetConfig {
  available: boolean;
  url: string;
}

interface DownloadManifest {
  web: DownloadTargetConfig;
  macos: DownloadTargetConfig;
  windowsX64: DownloadTargetConfig;
  windowsArm64: DownloadTargetConfig;
  android: DownloadTargetConfig;
  ios: DownloadTargetConfig;
}

interface DownloadCard {
  id: keyof DownloadManifest;
  title: string;
  subtitle: string;
  icon: string;
  packageLabel: string;
  notes: string[];
}

const EMPTY_TARGET: DownloadTargetConfig = { available: false, url: '' };

@Component({
  selector: 'app-downloads',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './downloads.component.html',
  styleUrls: ['./downloads.component.scss'],
})
export class DownloadsComponent implements OnInit, OnDestroy {
  readonly cards: DownloadCard[] = [
    {
      id: 'web',
      title: 'Web / PWA',
      subtitle: 'Install from a supported browser after the Render site is live.',
      icon: 'fas fa-globe',
      packageLabel: 'Install web app',
      notes: [
        'Keeps the normal website available in every modern browser.',
        'On iPhone/iPad, Safari can add the web app to the Home Screen.',
        'On supported desktop/Android browsers, use the browser install prompt.',
      ],
    },
    {
      id: 'macos',
      title: 'macOS',
      subtitle: 'One Universal build for Intel and Apple Silicon Macs.',
      icon: 'fab fa-apple',
      packageLabel: 'Download macOS app',
      notes: [
        'Includes x86_64 for Intel Macs such as the 2019 MacBook Pro.',
        'Includes arm64 for Apple Silicon M-series Macs.',
        'Public distribution should be Apple-signed and notarized before release.',
      ],
    },
    {
      id: 'windowsX64',
      title: 'Windows x64',
      subtitle: 'Installer for standard 64-bit Intel/AMD Windows PCs.',
      icon: 'fab fa-windows',
      packageLabel: 'Download Windows x64',
      notes: [
        'Targets current 64-bit Intel and AMD Windows computers.',
        'NSIS EXE/MSI packaging is supported by the native build pipeline.',
      ],
    },
    {
      id: 'windowsArm64',
      title: 'Windows ARM64',
      subtitle: 'Installer target for newer ARM-based Windows PCs.',
      icon: 'fab fa-windows',
      packageLabel: 'Download Windows ARM64',
      notes: [
        'Separate ARM64 package avoids relying on x64 emulation where possible.',
        'Release availability depends on the ARM64 packaging job passing.',
      ],
    },
    {
      id: 'android',
      title: 'Android',
      subtitle: 'APK for direct testing and AAB for future Play distribution.',
      icon: 'fab fa-android',
      packageLabel: 'Download Android',
      notes: [
        'The test pipeline can generate an installable APK.',
        'A production release needs a persistent Android signing key.',
      ],
    },
    {
      id: 'ios',
      title: 'iPhone / iPad',
      subtitle: 'Native iOS build plus PWA Home Screen installation.',
      icon: 'fas fa-mobile-screen-button',
      packageLabel: 'Get iPhone / iPad app',
      notes: [
        'The iOS simulator build can be automated in CI.',
        'Installing the native app on a real iPhone/iPad requires Apple signing/provisioning.',
        'Until native signing is configured, the hosted PWA can still be installed from Safari.',
      ],
    },
  ];

  manifest: DownloadManifest = {
    web: { ...EMPTY_TARGET },
    macos: { ...EMPTY_TARGET },
    windowsX64: { ...EMPTY_TARGET },
    windowsArm64: { ...EMPTY_TARGET },
    android: { ...EMPTY_TARGET },
    ios: { ...EMPTY_TARGET },
  };

  qrCodes: Partial<Record<keyof DownloadManifest, string>> = {};
  qrErrors: Partial<Record<keyof DownloadManifest, boolean>> = {};
  isBrowser = false;
  isIos = false;
  isStandalone = false;
  canPromptInstall = false;
  installStatus = '';

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly beforeInstallHandler = (event: Event): void => {
    event.preventDefault();
    this.deferredPrompt = event as BeforeInstallPromptEvent;
    this.canPromptInstall = true;
  };

  constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (!this.isBrowser) return;

    this.isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);

    this.http.get<Partial<DownloadManifest>>('/downloads.json').subscribe({
      next: (config) => {
        this.manifest = this.mergeManifest(config);
        this.configureWebTarget();
        void this.generateQrCodes();
      },
      error: () => {
        this.configureWebTarget();
        void this.generateQrCodes();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
    }
  }

  target(card: DownloadCard): DownloadTargetConfig {
    return this.manifest[card.id];
  }

  async installWebApp(): Promise<void> {
    if (this.isStandalone) {
      this.installStatus = 'This web app is already installed.';
      return;
    }

    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.installStatus =
        choice.outcome === 'accepted'
          ? 'Install accepted. Follow your browser to finish.'
          : 'Install cancelled. You can install it later from this page.';
      this.deferredPrompt = null;
      this.canPromptInstall = false;
      return;
    }

    this.installStatus = this.isIos
      ? 'On iPhone/iPad: open this site in Safari, tap Share, then choose Add to Home Screen.'
      : 'Use your browser menu and choose Install app / Add to Home screen when available.';
  }

  private mergeManifest(config: Partial<DownloadManifest>): DownloadManifest {
    return {
      web: { ...EMPTY_TARGET, ...config.web },
      macos: { ...EMPTY_TARGET, ...config.macos },
      windowsX64: { ...EMPTY_TARGET, ...config.windowsX64 },
      windowsArm64: { ...EMPTY_TARGET, ...config.windowsArm64 },
      android: { ...EMPTY_TARGET, ...config.android },
      ios: { ...EMPTY_TARGET, ...config.ios },
    };
  }

  private configureWebTarget(): void {
    if (!this.isBrowser) return;

    const isWebOrigin = window.location.protocol === 'https:' || window.location.protocol === 'http:';
    if (!this.manifest.web.url && isWebOrigin) {
      this.manifest.web = {
        available: true,
        url: `${window.location.origin}/downloads`,
      };
    }
  }

  private async generateQrCodes(): Promise<void> {
    if (!this.isBrowser) return;

    for (const card of this.cards) {
      const target = this.manifest[card.id];
      if (!target.available || !target.url) continue;

      try {
        this.qrCodes[card.id] = await QRCode.toDataURL(target.url, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        this.qrErrors[card.id] = false;
      } catch (error) {
        this.qrErrors[card.id] = true;
        console.error(`Unable to generate QR code for ${card.id}`, error);
      }
    }
  }
}
