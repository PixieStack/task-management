import { expect, test, type Page, type Route } from '@playwright/test';

async function authenticate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'workspace-e2e-token');
    sessionStorage.setItem('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString());
    sessionStorage.setItem('userId', '1');
    sessionStorage.setItem('username', 'Workspace Tester');
    sessionStorage.setItem('userEmail', 'workspace@example.com');
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
  await page.route('**/api/ai/chats', async (route) => json(route, []));
  await page.route('**/api/ai/status', async (route) => json(route, {
    ready: true,
    model: 'llama-3.3-70b-versatile',
    message: 'AI is ready',
  }));
  await page.route('**/auth/logout', async (route) => json(route, { message: 'Logged out' }));
  await page.route('**/api/productivity/timer/active', async (route) => json(route, null));
  await page.route('**/api/productivity/timer/sessions**', async (route) => json(route, []));
}

test.describe('authenticated productivity workspace', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await stubCommonApi(page);
  });

  test('sidebar exposes Todo, standalone Timer, Tasks and AI', async ({ page }) => {
    await page.route('**/api/productivity/todos**', async (route) => json(route, []));
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Todo', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Timer', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'AI Assistant', exact: true })).toBeVisible();

    await sidebar.getByRole('link', { name: 'AI Assistant', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard#ai$/);
    await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible({ timeout: 15_000 });

    await sidebar.getByRole('link', { name: 'Todo', exact: true }).click();
    await expect(page).toHaveURL(/\/todo$/);
    await expect(page.getByRole('heading', { name: 'What must happen today?' })).toBeVisible({ timeout: 15_000 });
  });

  test('logout requires confirmation and protected history cannot reopen', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Log out of your account?' });
    await expect(confirmation).toBeVisible();

    await confirmation.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, log out' }).click();
    await expect(page).toHaveURL(/\/access$/);
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();

    await page.goBack();
    await expect(page).not.toHaveURL(/\/dashboard$/);
  });

  test('standalone Focus Timer runs without creating tracked records and survives refresh', async ({ page }) => {
    const productivityRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/productivity/')) productivityRequests.push(request.url());
    });

    await page.goto('/focus-timer', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Time anything. Keep nothing.' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Not tracked', { exact: true })).toBeVisible();
    await page.getByLabel('Custom minutes').fill('1');
    await page.getByRole('button', { name: 'Set timer' }).click();
    await expect(page.getByText('01:00', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect.poll(async () => page.locator('.timer-clock').textContent()).not.toBe('01:00');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.timer-clock')).not.toHaveText('01:00');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('01:00', { exact: true })).toBeVisible();
    expect(productivityRequests).toEqual([]);
  });

  test('task, habit and reading cards show when they were created', async ({ page }) => {
    const createdAt = '2026-08-07T12:00:00Z';
    await page.route('**/api/tasks**', async (route) => json(route, [{
      id: 11,
      owner_id: 1,
      title: 'Dated task',
      description: '',
      completed: false,
      status: 'Not Started',
      priority: 'Medium',
      due_date: null,
      tags: [],
      time_estimate: 30,
      time_spent: 0,
      time_spent_seconds: 0,
      created_at: createdAt,
      updated_at: createdAt,
    }]));
    await page.route('**/api/habits**', async (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/entries')) {
        await json(route, []);
        return;
      }
      await json(route, [{
        id: 12,
        user_id: 1,
        name: 'Dated habit',
        description: 'Practice every day',
        category: 'personal',
        frequency: 'daily',
        target_count: 1,
        duration_days: 21,
        last_check_in_at: null,
        completed: false,
        completed_at: null,
        check_in_count: 0,
        remaining_check_ins: 21,
        progress: 0,
        next_check_in_at: null,
        can_check_in: true,
        completion_review_required: false,
        created_at: createdAt,
      }]);
    });
    await page.route('**/api/challenges**', async (route) => json(route, [{
      id: 13,
      user_id: 1,
      title: 'Dated reading challenge',
      description: 'Read 20 pages',
      duration: 30,
      challenge_type: 'reading',
      start_date: '2026-08-07',
      current_streak: 0,
      best_streak: 0,
      last_check_in: null,
      completed: false,
      icon: 'fas fa-book-open',
      progress: 0,
      is_active: true,
      created_at: createdAt,
      updated_at: createdAt,
    }]));

    await page.goto('/dashboard#tasks', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Dated task', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Created Aug 7, 2026', { exact: true })).toBeVisible();

    await page.goto('/dashboard#habits', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Dated habit', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Created Aug 7, 2026', { exact: true })).toBeVisible();

    await page.goto('/dashboard#challenges', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Dated reading challenge', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Created Aug 7, 2026', { exact: true })).toBeVisible();
  });

  test('task due time asks before completion and remains active when declined', async ({ page }) => {
    let task: any = {
      id: 21,
      owner_id: 1,
      title: 'Submit the proposal',
      description: '',
      completed: false,
      status: 'Not Started',
      priority: 'High',
      due_date: '2026-08-07T14:30:00',
      tags: [],
      time_estimate: 0,
      time_spent: 0,
      time_spent_seconds: 0,
      created_at: '2026-08-07T09:00:00Z',
      updated_at: '2026-08-07T09:00:00Z',
    };
    let createdPayload: any = null;
    await page.route('**/api/tasks**', async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        task = { ...task, ...request.postDataJSON(), updated_at: new Date().toISOString() };
        await json(route, task);
        return;
      }
      if (request.method() === 'POST') {
        createdPayload = request.postDataJSON();
        await json(route, { ...task, ...createdPayload, id: 22 }, 201);
        return;
      }
      await json(route, [task]);
    });

    await page.goto('/dashboard#tasks', { waitUntil: 'domcontentloaded' });
    const dueDialog = page.getByRole('dialog', { name: 'Did you complete this task?' });
    await expect(dueDialog).toBeVisible({ timeout: 15_000 });
    await expect(dueDialog.getByText(/only be marked complete if you confirm/i)).toBeVisible();
    await dueDialog.getByRole('button', { name: 'No, keep active' }).click();
    await expect(dueDialog).toHaveCount(0);
    await expect(page.getByText('Submit the proposal', { exact: true })).toBeVisible();
    await expect(page.getByText('Due time reached', { exact: true })).toBeVisible();
    await expect(page.getByText(/Estimate/)).toHaveCount(0);
    await expect(page.getByLabel('Due time')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reopenedDialog = page.getByRole('dialog', { name: 'Did you complete this task?' });
    await expect(reopenedDialog).toBeVisible({ timeout: 15_000 });
    await reopenedDialog.getByRole('button', { name: 'Yes, complete task' }).click();
    await expect(page.getByText('Submit the proposal', { exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Completed/ }).click();
    const completedTask = page.locator('.task-item').filter({ hasText: 'Submit the proposal' });
    await expect(completedTask.getByText('Submit the proposal', { exact: true })).toBeVisible();
    await expect(completedTask.locator('select')).toHaveCount(0);
    await expect(completedTask.locator('.completed-status')).toHaveText('Completed');

    await page.getByLabel('Task title').fill('Future deadline');
    await page.locator('#task-due-date').fill('2026-08-10');
    await page.locator('#task-due-time').fill('14:30');
    await page.getByRole('button', { name: 'Add task' }).click();
    expect(createdPayload?.due_date).toBe('2026-08-10T14:30:00');
    expect(createdPayload?.time_estimate).toBe(0);
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
          time_spent_seconds: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        todos.unshift(todo);
        await json(route, todo, 201);
        return;
      }
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON();
        const todo = todos[0];
        Object.assign(todo, payload, { updated_at: new Date().toISOString() });
        await json(route, todo);
        return;
      }
      await json(route, todos);
    });
    let sessionId = 43;
    await page.route('**/api/productivity/timer/start', async (route) => {
      sessionId += 1;
      await json(route, {
        id: sessionId,
        user_id: 1,
        item_type: 'todo',
        todo_id: 12,
        task_id: null,
        // A naive UTC timestamp used to be parsed as local time and added two hours in South Africa.
        started_at: new Date(Date.now() - 2_000).toISOString().replace('Z', ''),
        ended_at: null,
        elapsed_seconds: 0,
        live_elapsed_seconds: 2,
      }, 201);
    });
    await page.route('**/api/productivity/timer/stop', async (route) => {
      todos[0].time_spent_seconds += 2;
      await json(route, {
        id: sessionId,
        user_id: 1,
        item_type: 'todo',
        todo_id: 12,
        task_id: null,
        started_at: new Date(Date.now() - 2_000).toISOString(),
        ended_at: new Date().toISOString(),
        elapsed_seconds: 2,
        live_elapsed_seconds: 2,
      });
    });

    await page.goto('/todo', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'What must happen today?' })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Todo title').fill('Review chapter 4');
    await page.getByLabel('Todo priority').selectOption('High');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByText('Review chapter 4', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Time spent: 0m 00s/)).toBeVisible();
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    const timerPanel = page.locator('#timer');
    await expect(timerPanel.getByRole('heading', { name: 'Review chapter 4' })).toBeVisible();
    const runningClock = timerPanel.locator('.active-item-clock');
    await expect(runningClock).toHaveText(/^0h 00m \d{2}s$/);
    const firstTick = await runningClock.textContent();
    await expect.poll(async () => runningClock.textContent()).not.toBe(firstTick);
    await expect(timerPanel.getByText(/2h/)).toHaveCount(0);
    await timerPanel.getByRole('button', { name: 'Close timer and save elapsed time' }).click();
    await expect(page.getByRole('heading', { name: 'Time something without tracking it' })).toHaveCount(0);
    await expect(page.locator('.focus-grid')).toHaveClass(/todo-only/);
    await expect(page.getByText(/Time spent: 0m 02s/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Resume timer', exact: true }).click();
    await timerPanel.getByRole('button', { name: 'Pause & save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Resume timer', exact: true }).click();
    await page.getByRole('button', { name: 'Complete Review chapter 4' }).click();
    await expect(page.getByText('Review chapter 4', { exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Completed/ }).click();
    await expect(page.getByRole('button', { name: 'Reopen Review chapter 4' })).toBeVisible();
    await expect(page.getByRole('button', { name: /(?:Start|Resume|Pause).*timer/i })).toHaveCount(0);
    await expect(page.locator('.active-timer')).toHaveCount(0);
  });

  test('habit duration, protected daily check-in and final celebration are clear', async ({ page }) => {
    let habit: any = null;
    await page.route('**/api/habits**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname.endsWith('/entries')) {
        await json(route, []);
        return;
      }
      if (request.method() === 'POST' && url.pathname.endsWith('/check-in')) {
        const awaitingReview = {
          ...habit,
          last_check_in_at: new Date().toISOString(),
          completed: false,
          completed_at: null,
          check_in_count: 1,
          remaining_check_ins: 0,
          progress: 100,
          next_check_in_at: new Date(Date.now() + 86_400_000).toISOString(),
          can_check_in: false,
          completion_review_required: true,
        };
        habit = awaitingReview;
        await json(route, {
          habit: awaitingReview,
          entry: { id: 91, habit_id: 55, user_id: 1, date: new Date().toISOString(), completed: true, count: 1, created_at: new Date().toISOString() },
          review_required: true,
          completion_email_queued: false,
        });
        return;
      }
      if (request.method() === 'POST' && url.pathname.endsWith('/completion-review')) {
        const payload = request.postDataJSON();
        if (payload.established) {
          habit = {
            ...habit,
            completed: true,
            completed_at: new Date().toISOString(),
            completion_review_required: false,
            can_check_in: false,
          };
          await json(route, { habit, completed_now: true, completion_email_queued: true });
        } else {
          habit = {
            ...habit,
            duration_days: habit.duration_days + payload.additional_days,
            remaining_check_ins: payload.additional_days,
            progress: (habit.check_in_count / (habit.duration_days + payload.additional_days)) * 100,
            completed: false,
            completed_at: null,
            completion_review_required: false,
            can_check_in: false,
          };
          await json(route, { habit, completed_now: false, completion_email_queued: false });
        }
        return;
      }
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        habit = {
          id: 55,
          user_id: 1,
          name: payload.name,
          description: payload.description,
          category: 'personal',
          frequency: 'daily',
          target_count: 1,
          duration_days: payload.duration_days,
          last_check_in_at: null,
          completed: false,
          completed_at: null,
          check_in_count: 0,
          remaining_check_ins: payload.duration_days,
          progress: 0,
          next_check_in_at: null,
          can_check_in: true,
          completion_review_required: false,
          created_at: new Date().toISOString(),
        };
        await json(route, habit, 201);
        return;
      }
      await json(route, habit ? [habit] : []);
    });

    await page.goto('/dashboard#habits', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Times per day')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /21 days/ })).toBeVisible();
    await page.getByRole('button', { name: /Custom.*1.*365 days/ }).click();
    await page.getByLabel('Custom duration').fill('1');
    await page.getByLabel('Habit name').fill('Drink water after waking');
    await page.getByRole('button', { name: 'Create habit' }).click();

    await expect(page.getByText('1-day daily habit')).toBeVisible();
    await page.getByRole('button', { name: /Start first check-in: Drink water after waking/ }).click();
    const review = page.getByRole('dialog', { name: 'Does this feel like a habit now?' });
    await expect(review).toBeVisible();
    await review.getByRole('button', { name: 'Not yet, I need more days' }).click();
    await expect(page.getByRole('heading', { name: 'How many more days do you need?' })).toBeVisible();
    await page.getByLabel('Additional days').fill('7');
    await page.getByRole('button', { name: 'Add days & continue' }).click();
    await expect(page.getByText(/1 of 8 days/)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    habit = {
      ...habit,
      duration_days: 1,
      remaining_check_ins: 0,
      progress: 100,
      completion_review_required: true,
      can_check_in: false,
    };
    await page.reload({ waitUntil: 'domcontentloaded' });
    const persistedReview = page.getByRole('dialog', { name: 'Does this feel like a habit now?' });
    await expect(persistedReview).toBeVisible();
    await persistedReview.getByRole('button', { name: 'Yes, it’s a habit' }).click();
    const celebration = page.getByRole('dialog', { name: 'You did it!' });
    await expect(celebration).toBeVisible();
    await expect(celebration.getByText(/completed.*Drink water after waking.*1 daily check-in/i)).toBeVisible();
    await expect(celebration.getByText(/congratulations email/i)).toBeVisible();
    await celebration.getByRole('button', { name: 'Celebrate & continue' }).click();
    await expect(page.getByText('Drink water after waking', { exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Completed/ }).click();
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByRole('button', { name: /Completed: Drink water after waking/ })).toBeDisabled();
  });

  test('Todo remains usable without an empty timer card when one backend feed fails', async ({ page }) => {
    await page.route('**/api/productivity/todos**', async (route) => {
      await json(route, { detail: 'Temporary todo feed failure' }, 503);
    });

    await page.goto('/todo#timer', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'What must happen today?' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Time something without tracking it' })).toHaveCount(0);
    await expect(page.locator('.focus-grid')).toHaveClass(/todo-only/);
    await expect(page.getByText(/Todo opened, but todos could not be loaded/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Study timer')).toHaveCount(0);
  });

  test('AI conversation surfaces executed workspace actions', async ({ page }) => {
    await page.route('**/api/productivity/todos**', async (route) => json(route, []));
    await page.route('**/api/ai/ask', async (route) => {
      const payload = route.request().postDataJSON();
      await json(route, {
        id: 55,
        chat_id: payload.chat_id,
        question: payload.question,
        answer: 'Done — I created the task “Study networking” and added the Todo “Read notes”.',
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
    const input = page.getByLabel('Message your assistant');
    await input.fill('Create a Study networking task and add Read notes to today.');

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/ai/ask') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await expect(page.getByText(/I created the task.*Study networking.*and added the Todo.*Read notes/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.executed-actions span').nth(0)).toContainText('Created task: Study networking');
    await expect(page.locator('.executed-actions span').nth(1)).toContainText('Created Todo: Read notes');
    await expect(page.getByRole('button', { name: 'New chat' })).toBeVisible();
    await expect(page.getByText('AI updated your workspace.')).toBeVisible({ timeout: 15_000 });
  });
});
