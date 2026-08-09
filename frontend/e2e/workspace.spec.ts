import { expect, test, type Page, type Route } from '@playwright/test';

async function authenticate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'workspace-e2e-token');
    localStorage.setItem('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString());
    localStorage.setItem('userId', '1');
    localStorage.setItem('username', 'Workspace Tester');
    localStorage.setItem('userEmail', 'workspace@example.com');
  });
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubCommonApi(page: Page): Promise<void> {
  await page.route('**/auth/me', async (route) => json(route, {
    id: 1,
    username: 'Workspace Tester',
    email: 'workspace@example.com',
  }));
  await page.route('**/auth/profile', async (route) => json(route, {
    first_name: 'Workspace',
    last_name: 'Tester',
    bio: '',
  }));
  await page.route('**/api/tasks**', async (route) => json(route, []));
  await page.route('**/api/habits**', async (route) => json(route, []));
  await page.route('**/api/challenges**', async (route) => json(route, []));
  await page.route('**/api/ai/conversations**', async (route) => json(route, []));
  await page.route('**/api/productivity/timer/active', async (route) => json(route, null));
  await page.route('**/api/productivity/timer/sessions**', async (route) => json(route, []));
}

test.describe('authenticated productivity workspace', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await stubCommonApi(page);
  });

  test('restored sidebar exposes Todo, Focus and AI destinations', async ({ page }) => {
    await page.route('**/api/productivity/todos**', async (route) => json(route, []));
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Todo', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Focus & Timers', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'AI Assistant', exact: true })).toBeVisible();

    await sidebar.getByRole('link', { name: 'AI Assistant', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard#ai$/);
    await expect(page.getByRole('heading', { name: 'Plan from your actual app data' })).toBeVisible({ timeout: 15_000 });

    await sidebar.getByRole('link', { name: 'Todo', exact: true }).click();
    await expect(page).toHaveURL(/\/focus#todos$/);
    await expect(page.getByRole('heading', { name: 'What must happen today?' })).toBeVisible({ timeout: 15_000 });
  });

  test('daily Todo creates a persisted item and displays its timer total', async ({ page }) => {
    const todos: any[] = [];

    await page.route('**/api/productivity/todos**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        const todo = {
          id: 12,
          user_id: 1,
          title: payload.title,
          notes: payload.notes,
          todo_date: payload.todo_date,
          completed: false,
          priority: payload.priority,
          time_spent_seconds: 83,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        todos.unshift(todo);
        await json(route, todo, 201);
        return;
      }
      await json(route, todos);
    });

    await page.goto('/focus#todos', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'What must happen today?' })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Todo title').fill('Review chapter 4');
    await page.getByLabel('Todo priority').selectOption('High');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByText('Review chapter 4', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Time spent: 1m 23s/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start timer', exact: true })).toBeVisible();
  });

  test('Focus still renders Pomodoro when one backend feed fails', async ({ page }) => {
    await page.route('**/api/productivity/todos**', async (route) => {
      await json(route, { detail: 'Temporary todo feed failure' }, 503);
    });

    await page.goto('/focus#pomodoro', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Pomodoro' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('25:00', { exact: true })).toBeVisible();
    await expect(page.getByText(/Focus opened, but todos could not be loaded/)).toBeVisible({ timeout: 15_000 });
  });

  test('AI conversation surfaces executed workspace actions', async ({ page }) => {
    await page.route('**/api/productivity/todos**', async (route) => json(route, []));
    await page.route('**/api/ai/ask', async (route) => {
      const payload = route.request().postDataJSON();
      await json(route, {
        id: 55,
        question: payload.question,
        answer: 'I created the task and today\'s todo. Done: create task, create todo.',
        context: {
          executed_actions: [
            { type: 'create_task', id: 21, title: 'Study networking' },
            { type: 'create_todo', id: 22, title: 'Read notes' },
          ],
        },
        created_at: new Date().toISOString(),
      });
    });

    await page.goto('/dashboard#ai', { waitUntil: 'domcontentloaded' });
    const input = page.getByLabel('What do you need help with?');
    await input.fill('Create a Study networking task and add Read notes to today.');

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/ai/ask') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await expect(page.getByText(/I created the task and today's todo/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('AI updated your workspace.')).toBeVisible({ timeout: 15_000 });
  });
});
