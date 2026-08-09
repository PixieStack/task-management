import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OAuthProviderService {
  private scripts = new Map<string, Promise<void>>();

  async renderGoogleButton(
    element: HTMLElement,
    clientId: string,
    onCredential: (credential: string) => void,
  ): Promise<void> {
    await this.loadScript('google-identity-services', 'https://accounts.google.com/gsi/client');
    const google = (window as any).google;
    if (!google?.accounts?.id) throw new Error('Google Identity Services did not load.');

    google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      callback: (response: { credential?: string }) => {
        if (response?.credential) onCredential(response.credential);
      },
    });
    element.replaceChildren();
    google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: Math.min(360, Math.max(220, element.clientWidth || 320)),
    });
  }

  async signInWithApple(clientId: string): Promise<string> {
    await this.loadScript(
      'apple-signin-js',
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    );
    const AppleID = (window as any).AppleID;
    if (!AppleID?.auth) throw new Error('Sign in with Apple did not load.');

    AppleID.auth.init({
      clientId,
      scope: 'name email',
      redirectURI: `${window.location.origin}/login`,
      usePopup: true,
    });
    const response = await AppleID.auth.signIn();
    const credential = response?.authorization?.id_token;
    if (!credential) throw new Error('Apple did not return an identity token.');
    return credential;
  }

  private loadScript(id: string, src: string): Promise<void> {
    const existingPromise = this.scripts.get(id);
    if (existingPromise) return existingPromise;

    const promise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      if (existing) {
        if (existing.dataset['loaded'] === 'true') resolve();
        else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => { script.dataset['loaded'] = 'true'; resolve(); };
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
    this.scripts.set(id, promise);
    return promise;
  }
}
