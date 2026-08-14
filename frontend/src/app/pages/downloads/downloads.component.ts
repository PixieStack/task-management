import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as QRCodeNamespace from 'qrcode';

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

interface QRCodeBrowserApi {
  toDataURL(
    text: string,
    options?: {
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      margin?: number;
      width?: number;
    },
  ): Promise<string>;
}

const EMPTY_TARGET: DownloadTargetConfig = { available: false, url: '' };

function hasToDataUrl(value: unknown): value is QRCodeBrowserApi {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return false;
  }

  return typeof (value as { toDataURL?: unknown }).toDataURL === 'function';
}

function resolveQRCodeApi(): QRCodeBrowserApi {
  const namespace = QRCodeNamespace as unknown as { default?: unknown };
  const defaultExport = namespace.default;
  const nestedDefault =
    defaultExport && (typeof defaultExport === 'object' || typeof defaultExport === 'function')
      ? (defaultExport as { default?: unknown }).default
      : undefined;

  for (const candidate of [QRCodeNamespace, defaultExport, nestedDefault]) {
    if (hasToDataUrl(candidate)) {
      return candidate;
    }
  }

  throw new Error('QR code browser renderer is unavailable');
}

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
      id: 'macos',
      title: 'macOS',
      subtitle: 'One Universal build for Intel and Apple Silicon Macs.',
      icon: 'fab fa-apple',
      packageLabel: 'Download macOS app',
      notes: [
        'Includes x86_64 for Intel Macs such as the 2019 MacBook Pro.',
        'Includes arm64 for Apple Silicon M-series Macs.',
        'The CI release verifies that the app contains both Intel and Apple Silicon binaries.',
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
        'The downloadable NSIS installer is produced by the verified native build pipeline.',
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
        'The package contains an ARM64 executable verified by the release pipeline.',
      ],
    },
    {
      id: 'android',
      title: 'Android',
      subtitle: 'Installable APK for current 64-bit Android phones and tablets.',
      icon: 'fab fa-android',
      packageLabel: 'Download Android',
      notes: [
        'The APK is built and verified by the Android native pipeline.',
        'Android may ask you to allow installation from this browser before opening it.',
      ],
    },
    {
      id: 'ios',
      title: 'iPhone / iPad',
      subtitle: 'Install from a supported browser after the Render site is live.',
      icon: 'fas fa-mobile-screen-button',
      packageLabel: 'Install on iPhone / iPad',
      notes: [
        'Keeps the normal website available in every modern browser.',
        'On iPhone/iPad, Safari can add the web app to the Home Screen.',
        'On supported desktop/Android browsers, use the browser install prompt.',
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
  detectedTarget: keyof DownloadManifest | null = null;
  showDeviceChooser = false;

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly beforeInstallHandler = (event: Event): void => {
    event.preventDefault();
    this.deferredPrompt = event as BeforeInstallPromptEvent;
    this.canPromptInstall = true;
    this.changeDetectorRef.markForCheck();
  };

  constructor(
    private readonly http: HttpClient,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (!this.isBrowser) return;

    this.isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    this.detectedTarget = this.detectDeviceTarget();

    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);

    this.http.get<Partial<DownloadManifest>>('/downloads.json').subscribe({
      next: (config) => {
        this.manifest = this.mergeManifest(config);
        void this.generateQrCodes();
        if (this.route.snapshot.queryParamMap.get('auto') === '1') this.downloadForThisDevice();
      },
      error: () => {
        void this.generateQrCodes();
        if (this.route.snapshot.queryParamMap.get('auto') === '1') this.downloadForThisDevice();
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

  async installWebApp(forceIosInstructions = false): Promise<void> {
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
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.installStatus = this.isIos || forceIosInstructions
      ? 'On iPhone/iPad: open this site in Safari, tap Share, then choose Add to Home Screen.'
      : 'Open your browser menu, then choose Install M.O.B TaskManager or Add to Home screen.';
  }

  downloadForThisDevice(): void {
    const targetId = this.detectedTarget;
    if (targetId === 'web' || targetId === 'ios') {
      void this.installWebApp(targetId === 'ios');
      return;
    }

    if (targetId) {
      const target = this.manifest[targetId];
      if (target.available && target.url) {
        window.location.assign(target.url);
        return;
      }
    }

    this.showDeviceChooser = true;
    this.installStatus = targetId
      ? `${this.cardTitle(targetId)} was detected, but its native package is not published yet. Choose another option.`
      : 'We could not identify your device confidently. Choose the platform you want.';
  }

  chooseDownload(card: DownloadCard): void {
    if (card.id === 'web' || card.id === 'ios') {
      this.showDeviceChooser = false;
      void this.installWebApp(card.id === 'ios');
      return;
    }
    const target = this.target(card);
    if (!target.available || !target.url) return;
    this.showDeviceChooser = false;
    window.location.assign(target.url);
  }

  closeDeviceChooser(): void {
    this.showDeviceChooser = false;
  }

  @HostListener('document:keydown.escape')
  closeDeviceChooserOnEscape(): void {
    this.closeDeviceChooser();
  }

  isDetected(card: DownloadCard): boolean {
    return card.id === this.detectedTarget;
  }

  private detectDeviceTarget(): keyof DownloadManifest | null {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    const isTouchMac = platform.includes('mac') && navigator.maxTouchPoints > 1;

    if (userAgent.includes('android')) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent) || isTouchMac) return 'ios';
    if (platform.includes('mac') || userAgent.includes('macintosh')) return 'macos';
    if (platform.includes('win') || userAgent.includes('windows')) {
      return /arm64|aarch64/.test(userAgent) ? 'windowsArm64' : 'windowsX64';
    }
    if (/linux|cros/.test(userAgent)) return null;
    return null;
  }

  private cardTitle(id: keyof DownloadManifest): string {
    return this.cards.find((card) => card.id === id)?.title || 'Your device';
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

  private async generateQrCodes(): Promise<void> {
    if (!this.isBrowser) return;

    this.qrCodes = {};
    this.qrErrors = {};

    let qrCodeApi: QRCodeBrowserApi;
    try {
      qrCodeApi = resolveQRCodeApi();
    } catch (error) {
      for (const card of this.cards) {
        const target = this.manifest[card.id];
        if (target.available && target.url) {
          this.qrErrors[card.id] = true;
        }
      }
      this.changeDetectorRef.markForCheck();
      console.error('Unable to initialize QR code renderer', error);
      return;
    }

    await Promise.all(
      this.cards.map(async (card) => {
        const target = this.manifest[card.id];
        if (!target.available || !target.url) return;

        try {
          const downloadUrl = new URL(target.url, window.location.origin).href;
          this.qrCodes[card.id] = await qrCodeApi.toDataURL(downloadUrl, {
            errorCorrectionLevel: 'M',
            margin: 4,
            width: 256,
          });
          this.qrErrors[card.id] = false;
        } catch (error) {
          this.qrErrors[card.id] = true;
          console.error(`Unable to generate QR code for ${card.id}`, error);
        }
      }),
    );

    this.changeDetectorRef.markForCheck();
  }
}
