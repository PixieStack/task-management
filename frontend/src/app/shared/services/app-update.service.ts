import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';

export type DownloadTargetId = 'macos' | 'windowsX64' | 'windowsArm64' | 'android' | 'ios';

export interface DownloadTargetConfig {
  available: boolean;
  url: string;
  version: string;
  releaseDate: string;
}

export type DownloadManifest = Record<DownloadTargetId, DownloadTargetConfig>;

export interface AppUpdateState {
  installed: boolean;
  native: boolean;
  standalone: boolean;
  target: DownloadTargetId | null;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  updateUrl: string;
  updateAvailable: boolean;
  checking: boolean;
  message: string;
}

export const APP_VERSION = '2.0.0';
const LIVE_MANIFEST_URL = 'https://pixiestack-task-management-app-20260814.onrender.com/downloads.json';

const INITIAL_STATE: AppUpdateState = {
  installed: false,
  native: false,
  standalone: false,
  target: null,
  currentVersion: APP_VERSION,
  latestVersion: APP_VERSION,
  releaseDate: '',
  updateUrl: '',
  updateAvailable: false,
  checking: false,
  message: '',
};

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly stateSubject = new BehaviorSubject<AppUpdateState>(INITIAL_STATE);
  readonly state$ = this.stateSubject.asObservable();
  private monitoringStarted = false;

  constructor(
    private readonly http: HttpClient,
    private readonly swUpdate: SwUpdate,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        const state = this.stateSubject.value;
        if (!state.standalone) return;
        this.stateSubject.next({
          ...state,
          updateAvailable: true,
          message: 'A new app update is ready to install.',
        });
      });
  }

  get snapshot(): AppUpdateState {
    return this.stateSubject.value;
  }

  async initialize(target: DownloadTargetId | null = this.detectCurrentTarget()): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const native = isTauri();
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const installed = native || standalone;
    let currentVersion = APP_VERSION;

    if (native) {
      try {
        currentVersion = await getVersion();
      } catch {
        currentVersion = APP_VERSION;
      }
    }

    this.stateSubject.next({
      ...INITIAL_STATE,
      installed,
      native,
      standalone,
      target,
      currentVersion,
    });
    if (installed && target) {
      this.startMonitoring();
      await this.checkForUpdates();
    }
  }

  detectCurrentTarget(): DownloadTargetId | null {
    if (!isPlatformBrowser(this.platformId)) return null;
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

  async checkForUpdates(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.installed || !state.target) return;
    this.stateSubject.next({ ...state, checking: true, message: 'Checking for updates…' });

    try {
      if (state.standalone && this.swUpdate.isEnabled) await this.swUpdate.checkForUpdate();
      const manifest = await firstValueFrom(
        this.http.get<Partial<DownloadManifest>>(`/downloads.json?check=${Date.now()}`),
      );
      const latest = manifest[state.target];
      const updateAvailable = Boolean(
        latest?.available && latest.version && this.compareVersions(latest.version, state.currentVersion) > 0,
      );
      const serviceWorkerReady = this.stateSubject.value.updateAvailable && state.standalone;

      this.stateSubject.next({
        ...this.stateSubject.value,
        latestVersion: latest?.version || state.currentVersion,
        releaseDate: latest?.releaseDate || '',
        updateUrl: latest?.url || '',
        updateAvailable: updateAvailable || serviceWorkerReady,
        checking: false,
        message: updateAvailable || serviceWorkerReady
          ? 'A new app update is available.'
          : 'You have the latest version.',
      });
    } catch {
      this.stateSubject.next({
        ...this.stateSubject.value,
        checking: false,
        message: 'Unable to check for updates right now. Please try again.',
      });
    }
  }

  async installUpdate(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state.updateAvailable) return;
    if (state.standalone && this.swUpdate.isEnabled) {
      await this.swUpdate.activateUpdate();
      window.location.reload();
      return;
    }
    if (state.updateUrl) window.location.assign(state.updateUrl);
  }

  private startMonitoring(): void {
    if (this.monitoringStarted) return;
    this.monitoringStarted = true;
    window.addEventListener('focus', () => void this.checkForUpdates());
    window.setInterval(() => void this.checkForUpdates(), 60 * 60 * 1000);
  }

  private compareVersions(left: string, right: string): number {
    const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (a[index] || 0) - (b[index] || 0);
      if (difference !== 0) return difference;
    }
    return 0;
  }
}
