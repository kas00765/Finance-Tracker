import { test, expect } from '@playwright/test';

async function setup(
  page,
  { rateFailure = false, initialFailure = false, mixedCurrency = false } = {},
) {
  let categories = [
    { id: 1, name: 'Food' },
    { id: 2, name: 'Rent' },
    { id: 3, name: 'Salary' },
    { id: 4, name: 'Transport' },
  ];
  let transactions = [
    {
      id: 1,
      amount: '4200',
      type: 'income',
      category_id: 3,
      category_name: 'Salary',
      note: 'Monthly salary',
      currency: 'USD',
      transaction_date: '2026-11-01',
    },
    {
      id: 2,
      amount: '1200',
      type: 'expense',
      category_id: 2,
      category_name: 'Rent',
      note: 'Apartment rent',
      currency: 'USD',
      transaction_date: '2026-11-02',
    },
    {
      id: 3,
      amount: '240',
      type: 'expense',
      category_id: 1,
      category_name: 'Food',
      note: 'Weekly groceries',
      currency: mixedCurrency ? 'EUR' : 'USD',
      transaction_date: '2026-11-03',
    },
    {
      id: 4,
      amount: '45',
      type: 'expense',
      category_id: 4,
      category_name: 'Transport',
      note: 'Train pass',
      currency: 'USD',
      transaction_date: '2026-11-04',
    },
    ...Array.from({ length: 9 }, (_, index) => ({
      id: index + 5,
      amount: '5',
      type: 'expense',
      category_id: 1,
      category_name: 'Food',
      note: `Coffee ${index + 1}`,
      currency: 'USD',
      transaction_date: `2026-11-${String(index + 5).padStart(2, '0')}`,
    })),
  ];
  let budgets = [
    { id: 1, category_id: 1, amount: '300', currency: 'USD', month: '2026-11' },
    { id: 2, category_id: 2, amount: '1000', currency: 'USD', month: '2026-11' },
  ];
  const writes = [];
  let fail = initialFailure;
  await page.clock.install({ time: new Date('2026-11-17T06:00:00Z') });
  await page.addInitScript(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('theme', 'dark');
  });
  await page.route('https://api.frankfurter.dev/**', (route) =>
    rateFailure
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({
          json: { base: 'USD', rates: { EUR: 0.8, GBP: 0.75 }, date: '2026-11-16' },
        }),
  );
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    const body = method === 'GET' || method === 'DELETE' ? null : req.postDataJSON();
    if (method !== 'GET') writes.push({ method, path, body });
    if (path === '/api/users/me')
      return route.fulfill({ json: { id: 1, email: 'alex@example.com', home_currency: 'USD' } });
    if (path.startsWith('/api/categories')) {
      if (method === 'POST') {
        const category = { id: 100, name: body.name };
        categories.push(category);
        return route.fulfill({ status: 201, json: category });
      }
      if (method === 'DELETE') {
        categories = categories.filter((c) => c.id !== Number(path.split('/').pop()));
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: categories });
    }
    if (path === '/api/budgets') {
      if (method === 'POST') {
        const categoryId = Number(body.categoryId);
        budgets = [
          ...budgets.filter((b) => b.category_id !== categoryId),
          { id: categoryId, category_id: categoryId, ...body },
        ];
        return route.fulfill({ status: 201, json: body });
      }
      return route.fulfill({ json: budgets });
    }
    if (path.startsWith('/api/transactions')) {
      if (method === 'GET') {
        if (fail) return route.fulfill({ status: 500, json: { error: 'Temporarily unavailable' } });
        let rows = transactions;
        if (url.searchParams.get('from'))
          rows = rows.filter((t) => t.transaction_date >= url.searchParams.get('from'));
        if (url.searchParams.get('to'))
          rows = rows.filter((t) => t.transaction_date <= url.searchParams.get('to'));
        if (url.searchParams.get('category'))
          rows = rows.filter((t) => String(t.category_id) === url.searchParams.get('category'));
        return route.fulfill({ json: rows });
      }
      const id = Number(path.split('/').pop());
      if (method === 'DELETE') {
        transactions = transactions.filter((t) => t.id !== id);
        return route.fulfill({ status: 204 });
      }
      const transaction = {
        ...body,
        category_id: body.categoryId ? Number(body.categoryId) : null,
        category_name: categories.find((c) => c.id === Number(body.categoryId))?.name,
        transaction_date: body.date,
        id: method === 'POST' ? 100 : id,
      };
      transactions = [...transactions.filter((t) => t.id !== id), transaction];
      return route.fulfill({ status: method === 'POST' ? 201 : 200, json: transaction });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });
  writes.recover = () => {
    fail = false;
  };
  return writes;
}

test('overview filters, pagination, export, and responsive layout', async ({ page }, testInfo) => {
  await setup(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('.transaction-row')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.transaction-row')).toHaveCount(3);
  await page.getByLabel('Search transactions').fill('groceries');
  await expect(page.locator('.transaction-row')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('finance-guard-transactions.csv');
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv).toContain('Weekly groceries');
  expect(csv).not.toContain('Monthly salary');
  await page.getByLabel('Search transactions').fill('');
  await expect(page.locator('.transaction-row')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath('overview-preview.png'),
    animations: 'disabled',
    scale: 'css',
  });
  await page.screenshot({
    path: testInfo.outputPath('overview-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({
    path: testInfo.outputPath('overview-light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('add, edit currency, cancel deletion and confirm deletion', async ({ page }) => {
  const writes = await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount', { exact: true }).fill('18.50');
  await dialog.getByLabel('Category', { exact: true }).selectOption('1');
  await dialog.getByLabel('Note').fill('Test lunch');
  await dialog.getByRole('button', { name: 'Save transaction' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Edit Test lunch' }).click();
  await dialog.getByLabel('Currency', { exact: true }).selectOption('EUR');
  await dialog.getByRole('button', { name: 'Save transaction' }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes.filter((w) => w.method === 'POST')).toHaveLength(1);
  expect(writes.find((w) => w.method === 'PUT').body.currency).toBe('EUR');
  await page.getByRole('button', { name: 'Delete Test lunch' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(writes.filter((w) => w.method === 'DELETE')).toHaveLength(0);
  await page.getByRole('button', { name: 'Delete Test lunch' }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete Test lunch' })).not.toBeVisible();
  expect(writes.filter((w) => w.method === 'DELETE')).toHaveLength(1);
});

test('budgets show warnings, remaining money, and unbudgeted spending', async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto('/budgets');
  await expect(page.getByText('Near limit', { exact: true })).toBeVisible();
  await expect(page.getByText('Over budget', { exact: true })).toBeVisible();
  await expect(page.getByText('$200.00 over your limit', { exact: true })).toBeVisible();
  await expect(page.getByText(/spent outside your budgeted categories/)).toBeVisible();
  await page
    .locator('.budget-card')
    .filter({ has: page.getByRole('heading', { name: 'Food', exact: true }) })
    .getByRole('button', { name: 'Edit budget' })
    .click();
  await page.getByRole('dialog').getByLabel('Budget amount').fill('500');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(page.getByText('Near limit', { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('budgets.png'), fullPage: true });
});

test('reports validate dates and group filtered totals', async ({ page }) => {
  await setup(page);
  await page.goto('/reports');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('From', { exact: true }).fill('2026-12-01');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('alert')).toContainText('end date');
  await page.getByLabel('From', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Category', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('$285.00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('API failure shows retry rather than empty data', async ({ page }) => {
  const scenario = await setup(page, { initialFailure: true });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable');
  await expect(page.getByText('A fresh start', { exact: true })).not.toBeVisible();
  scenario.recover();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.transaction-row')).toHaveCount(10);
});

test('rate outage preserves original transactions and same-currency totals', async ({ page }) => {
  await setup(page, { rateFailure: true });
  await page.goto('/');
  await expect(page.locator('.transaction-row')).toHaveCount(10);
  await expect(
    page.locator('.stat-card').filter({ has: page.getByText('Income', { exact: true }) }),
  ).toContainText('$4,200.00');
  await expect(page.getByText(/Currency conversion is unavailable/)).not.toBeVisible();
});

test('mixed-currency outage hides combined totals but leaves transactions and entry usable', async ({
  page,
}) => {
  await setup(page, { rateFailure: true, mixedCurrency: true });
  await page.goto('/');
  await expect(page.getByText(/Currency conversion is unavailable/)).toBeVisible();
  await expect(page.locator('.stat-card').filter({ hasText: 'Expenses' })).toContainText('—');
  await expect(page.locator('.transaction-row')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Add transaction', exact: true })).toBeEnabled();
});

test('a late response for the previous date range cannot replace the current selection', async ({
  page,
}) => {
  await setup(page);
  let release;
  let signalRequested;
  const requested = new Promise((resolve) => {
    signalRequested = resolve;
  });
  await page.route('**/api/transactions?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('from') !== '2026-11-01')
      return route.fallback();
    await new Promise((resolve) => {
      release = resolve;
      signalRequested();
    });
    await route.fulfill({
      json: [
        {
          id: 200,
          amount: '100',
          currency: 'USD',
          type: 'income',
          transaction_date: '2026-11-01',
          note: 'Late November income',
        },
      ],
    });
  });
  await page.goto('/');
  await requested;
  await page.getByLabel('Date range', { exact: true }).selectOption('last-month');
  await expect(page.getByText('A fresh start', { exact: true })).toBeVisible();
  const response = page.waitForResponse((res) => res.url().includes('from=2026-11-01'));
  release();
  await response;
  await expect(page.getByText('Late November income', { exact: true })).not.toBeVisible();
  await expect(page.getByText('A fresh start', { exact: true })).toBeVisible();
});

test('settings categories require confirmation before deletion', async ({ page }, testInfo) => {
  const writes = await setup(page);
  await page.goto('/settings');
  await page.getByLabel('New category name').fill('Health & wellness');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await expect(page.getByText('Category added.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Health & wellness category' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Budgets for this category will also be removed',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(writes.filter((w) => w.method === 'DELETE')).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
});

test('slow exchange rates never block transaction viewing or entry', async ({ page }) => {
  await setup(page, { mixedCurrency: true });
  let release;
  await page.route('https://api.frankfurter.dev/**', async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: { base: 'USD', rates: { EUR: 0.8 }, date: '2026-11-16' } });
  });
  await page.goto('/');
  await expect(page.locator('.transaction-row')).toHaveCount(10);
  await expect(
    page.getByText('Updating exchange rates. Your transactions are ready to use.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  release();
  await expect(
    page.locator('.stat-card').filter({ has: page.getByText('Expenses', { exact: true }) }),
  ).toContainText('$1,590.00');
});

test('expired sessions return to the accessible login form', async ({ page }, testInfo) => {
  await setup(page);
  await page.route('**/api/users/me', (route) =>
    route.fulfill({ status: 401, json: { error: 'Session expired' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
});
