import { test, expect } from '@playwright/test';

async function setup(page, { failOnce = false } = {}) {
  const previews = [],
    imports = [];
  await page.addInitScript(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('theme', 'dark');
  });
  await page.route('https://api.frankfurter.dev/**', (route) =>
    route.fulfill({ json: { base: 'USD', rates: {}, date: '2026-11-23' } }),
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/users/me')
      return route.fulfill({ json: { id: 1, email: 'test@example.com', home_currency: 'USD' } });
    if (path === '/api/categories') return route.fulfill({ json: [{ id: 1, name: 'Food' }] });
    if (path === '/api/transactions/import/preview') {
      const { rows } = route.request().postDataJSON();
      previews.push(rows);
      return route.fulfill({
        json: {
          rows: rows.map((row) =>
            row.note === 'Existing'
              ? { status: 'duplicate', error: 'Matches a saved transaction' }
              : row.category === 'Missing'
                ? { status: 'invalid', error: 'Category does not exist' }
                : {
                    status: 'ready',
                    transaction: { ...row, categoryName: row.category || 'Uncategorized' },
                  },
          ),
        },
      });
    }
    if (path === '/api/transactions/import') {
      const { rows } = route.request().postDataJSON();
      imports.push(rows);
      if (failOnce) {
        failOnce = false;
        return route.fulfill({
          status: 500,
          json: { error: 'Import could not be completed. Retry safely.' },
        });
      }
      return route.fulfill({ status: 201, json: { imported: rows.length, skipped: 0 } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  return { previews, imports };
}
const upload = (page, text, name = 'transactions.csv') =>
  page
    .getByLabel('CSV file', { exact: true })
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });

test('preview is read-only, explains invalid and duplicate records, and imports only selected rows', async ({
  page,
}, testInfo) => {
  const calls = await setup(page);
  await upload(
    page,
    'Date,Amount,Type,Category,Note\n2026-11-01,12,expense,Food,Lunch\n2026-11-02,15,expense,Food,Dinner\n2026-11-03,10,expense,Food,Existing\n2026-11-04,5,expense,Missing,Other\n2026-02-30,1,expense,Food,Invalid date',
  );
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('2 ready', { exact: true })).toBeVisible();
  await expect(page.getByText('2 invalid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Import record 3', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Import record 5', { exact: true })).toBeDisabled();
  expect(calls.imports).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('import-preview.png'), fullPage: true });
  expect(calls.previews[0]).toHaveLength(4);
  await page.getByLabel('Import record 2', { exact: true }).uncheck();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Import 1 selected' }).click();
  await expect(page.getByRole('heading', { name: '1 transaction imported' })).toBeVisible();
  expect(calls.imports[0].map((r) => r.note)).toEqual(['Lunch']);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('bank date and amount formats are explicit and failed saves retain the selection for retry', async ({
  page,
}) => {
  const calls = await setup(page, { failOnce: true });
  await upload(page, 'Posted Date;Value;Description\n23/11/2026;-1.234,56;Café');
  await page.getByLabel('Date format', { exact: true }).selectOption('dmy');
  await page.getByLabel('Amount format', { exact: true }).selectOption('comma');
  await page.getByLabel('Default currency', { exact: true }).selectOption('EUR');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await page.getByRole('button', { name: 'Import 1 selected' }).click();
  await expect(
    page.getByText('Import could not be completed. Retry safely.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Import record 1', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Import 1 selected' }).click();
  await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
  expect(calls.imports).toHaveLength(2);
  expect(calls.imports[0][0]).toEqual({
    date: '2026-11-23',
    amount: '1234.56',
    type: 'expense',
    currency: 'EUR',
    category: '',
    note: 'Café',
  });
});

test('file errors are actionable and cancelling mapping never commits', async ({ page }) => {
  const calls = await setup(page);
  await upload(page, 'Date,Amount\n');
  await expect(page.getByRole('alert')).toContainText('transaction records');
  await upload(page, 'x'.repeat(1024 * 1024 + 1));
  await expect(page.getByRole('alert')).toContainText('too large');
  await upload(page, 'Date,Amount\n2026-11-01,-12');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(calls.previews).toHaveLength(0);
  expect(calls.imports).toHaveLength(0);
});

test('review pagination keeps selections across pages and supports returning to mapping', async ({
  page,
}) => {
  const calls = await setup(page);
  await upload(
    page,
    'Date,Amount,Note\n' +
      Array.from({ length: 21 }, (_, i) => `2026-11-01,-12,Item ${i}`).join('\n'),
  );
  await page.getByRole('button', { name: 'Preview import' }).click();
  await page.getByLabel('Import record 1', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Next records' }).click();
  await expect(page.getByLabel('Import record 21', { exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Import 20 selected' })).toBeEnabled();
  await page.getByRole('button', { name: 'Back to mapping' }).click();
  await expect(page.getByLabel('Amount column', { exact: true })).toHaveValue('1');
  expect(calls.imports).toHaveLength(0);
});
