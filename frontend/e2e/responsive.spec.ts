import { expect, test, type Page } from '@playwright/test';

const publicRoutes = [
  '/',
  '/key-features',
  '/about',
  '/contact',
  '/downloads',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password?token=responsive-reset-token',
  '/faq',
  '/privacy',
  '/terms',
  '/cookies',
];

const viewports = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 3440, height: 1440 },
];

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  await page.locator('app-root').waitFor({ state: 'visible' });
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );

    const isInsideIntentionalHorizontalScroller = (element: HTMLElement): boolean => {
      let current = element.parentElement;

      while (current && current !== document.body) {
        const style = getComputedStyle(current);
        const scrollable = style.overflowX === 'auto' || style.overflowX === 'scroll';
        if (scrollable && current.scrollWidth > current.clientWidth + 1) return true;
        current = current.parentElement;
      }

      return false;
    };

    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;

        if (element.classList.contains('bg-shape')) return false;
        if (isInsideIntentionalHorizontalScroller(element)) return false;

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.left < -2 || rect.right > viewportWidth + 2;
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        text: (element.textContent ?? '').trim().slice(0, 80),
        rect: element.getBoundingClientRect().toJSON(),
      }));

    return { viewportWidth, scrollWidth, offenders };
  });

  expect(
    result.scrollWidth,
    `${label} created page-level horizontal overflow: ${JSON.stringify(result)}`,
  ).toBeLessThanOrEqual(result.viewportWidth + 1);

  expect(
    result.offenders,
    `${label} has visible elements outside the viewport: ${JSON.stringify(result.offenders)}`,
  ).toEqual([]);
}

async function stubProtectedLayoutApi(page: Page): Promise<void> {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        username: 'Responsive Tester',
        email: 'responsive@example.com',
      }),
    });
  });

  await page.route('**/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        first_name: 'Responsive',
        last_name: 'Tester',
        bio: '',
      }),
    });
  });

  for (const pattern of [
    '**/api/tasks**',
    '**/api/habits**',
    '**/api/challenges**',
    '**/api/ai/conversations**',
    '**/api/productivity/todos**',
    '**/api/productivity/timer/sessions**',
  ]) {
    await page.route(pattern, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  await page.route('**/api/productivity/timer/active', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
}

test.describe('responsive layout smoke suite', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of viewports) {
    test(`${viewport.name} public routes fit ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of publicRoutes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expectNoHorizontalOverflow(page, `${viewport.name} ${route}`);
      }
    });
  }

  test('320px mobile navigation exposes Downloads and remains on-screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('#mobile-navigation')).toBeVisible();
    await expect(page.locator('#mobile-navigation').getByRole('link', { name: 'Key Features' })).toBeVisible();
    await expect(page.locator('#mobile-navigation').getByRole('link', { name: 'Downloads' })).toBeVisible();
    await expectNoHorizontalOverflow(page, '320px open mobile navigation');
  });

  test('forgot/reset password UI calls the application auth endpoints', async ({ page }) => {
    let forgotPayload: unknown;
    let resetPayload: unknown;

    await page.route('**/auth/forgot-password', async (route) => {
      forgotPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'If an account exists for that email, a password reset link has been sent.',
        }),
      });
    });

    await page.route('**/auth/reset-password', async (route) => {
      resetPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password reset successfully. You can now sign in with your new password.' }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email address', { exact: true }).fill('reset@example.com');
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('password reset link has been sent');
    expect(forgotPayload).toEqual({ email: 'reset@example.com' });

    const token = 'test-reset-token-abcdefghijklmnopqrstuvwxyz-1234567890';
    await page.goto(`/reset-password?token=${token}`, { waitUntil: 'domcontentloaded' });

    // These IDs are part of the reset form contract. Using them avoids Playwright's
    // partial accessible-name matching colliding with "Confirm new password" or
    // the surrounding "Choose a new password" region.
    await page.locator('#new-password').fill('StrongReset9!');
    await page.locator('#confirm-password').fill('StrongReset9!');
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Password reset successfully');
    expect(resetPayload).toEqual({ token, new_password: 'StrongReset9!' });
    await expectNoHorizontalOverflow(page, '390px password reset flow');
  });

  test('Downloads page keeps unpublished release links and QR codes disabled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/downloads', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.download-card')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Install web app' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Not published yet' })).toHaveCount(5);
    await expect(page.locator('.qr-panel img')).toHaveCount(0);
    await expect(page.locator('.download-card:not([data-platform="web"]) a.download-button')).toHaveCount(0);
    await expectNoHorizontalOverflow(page, '390px unpublished downloads page');
  });

  test('Downloads page generates a QR code when a real public release URL is configured', async ({ page }) => {
    await page.route('**/downloads.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          web: { available: true, url: 'https://downloads.example.test/mob-taskmanager' },
          macos: { available: false, url: '' },
          windowsX64: { available: false, url: '' },
          windowsArm64: { available: false, url: '' },
          android: { available: false, url: '' },
          ios: { available: false, url: '' },
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/downloads', { waitUntil: 'domcontentloaded' });

    const qrImage = page.getByRole('img', { name: 'QR code for Web / PWA' });
    await expect(qrImage).toBeVisible();
    await expect(qrImage).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect(page.getByRole('button', { name: 'Not published yet' })).toHaveCount(5);
    await expectNoHorizontalOverflow(page, '390px published web QR downloads page');
  });

  for (const viewport of [viewports[0], viewports[2], viewports[4], viewports[5]]) {
    test(`${viewport.name} protected layouts fit ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await stubProtectedLayoutApi(page);
      await page.addInitScript(() => {
        localStorage.setItem('token', 'responsive-layout-test-token');
        localStorage.setItem('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString());
        localStorage.setItem('userId', '1');
        localStorage.setItem('username', 'Responsive Tester');
        localStorage.setItem('userEmail', 'responsive@example.com');
      });

      for (const route of ['/dashboard', '/profile', '/focus']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`));
        await expectNoHorizontalOverflow(page, `${viewport.name} ${route}`);
      }
    });
  }
});
