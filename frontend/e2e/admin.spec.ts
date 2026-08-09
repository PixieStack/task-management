import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function authenticate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'admin-e2e-token');
    localStorage.setItem('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString());
    localStorage.setItem('userId', '1');
    localStorage.setItem('username', 'Admin Tester');
    localStorage.setItem('userEmail', 'admin@example.com');
  });
}

function overview() {
  return {
    accounts: { total: 4, active: 3, inactive: 1, verified: 3, unverified: 1, deleted: 2, google: 1, apple: 1 },
    productivity: { tasks: 14, todos: 8, habits: 3, challenges: 2, active_timers: 1, ai_requests_today: 5 },
  };
}

function health() {
  return {
    backend: { status: 'operational', version: '2.2.0' },
    database: { status: 'operational', latency_ms: 18.4, error: null },
    ai: { status: 'configured' },
    email: { status: 'configured' },
    google_sign_in: { status: 'configured' },
    apple_sign_in: { status: 'configured' },
    uptime_seconds: 3700,
  };
}

test.describe('private admin portal', () => {
  test('public website exposes no admin navigation link', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /admin/i })).toHaveCount(0);
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  });

  test('admin login is a separate shell without public navbar/footer', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Admin Control Center' })).toBeVisible();
    await expect(page.locator('app-navbar')).toHaveCount(0);
    await expect(page.locator('app-footer')).toHaveCount(0);
  });

  test('normal authenticated users are rejected by the admin guard', async ({ page }) => {
    await authenticate(page);
    await page.route('**/api/admin/session', async (route) => json(route, { detail: 'Administrator access required' }, 403));
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('administrator can load private operations dashboard', async ({ page }) => {
    await authenticate(page);
    await page.route('**/api/admin/session', async (route) => json(route, { is_admin: true, user: { id: 1, username: 'Admin Tester', email: 'admin@example.com' } }));
    await page.route('**/api/admin/overview', async (route) => json(route, overview()));
    await page.route('**/api/admin/health', async (route) => json(route, health()));
    await page.route('**/api/admin/accounts**', async (route) => json(route, []));
    await page.route('**/api/admin/deleted-accounts**', async (route) => json(route, []));
    await page.route('**/api/admin/api-metrics**', async (route) => json(route, []));
    await page.route('**/api/admin/ai-activity**', async (route) => json(route, []));
    await page.route('**/api/admin/audit-logs**', async (route) => json(route, []));

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'System Health' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'API Monitor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI Activity' })).toBeVisible();
    await expect(page.getByText('Admin only')).toBeVisible();
    await expect(page.locator('app-navbar')).toHaveCount(0);
    await expect(page.locator('app-authenticated-navbar')).toHaveCount(0);
    await expect(page.locator('app-footer')).toHaveCount(0);
  });
});
