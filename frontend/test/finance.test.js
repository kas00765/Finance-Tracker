import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetStatus,
  filterTransactions,
  localDate,
  monthRange,
  summarize,
} from '../src/utils/finance.js';
import { transactionsToCsv } from '../src/utils/csv.js';
import { convertAmount, fetchRates } from '../src/utils/currency.js';

test('local dates follow the calendar rather than UTC, including month boundaries', () => {
  const fakeDate = { getFullYear: () => 2026, getMonth: () => 0, getDate: () => 1 };
  assert.equal(localDate(fakeDate), '2026-01-01');
  assert.deepEqual(monthRange('2024-02'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.equal(monthRange('2026-13'), null);
  assert.equal(monthRange(''), null);
});

test('summaries group same-day changes and keep category names safe as map keys', () => {
  const result = summarize([
    {
      type: 'expense',
      category_name: '__proto__',
      convertedAmount: 25,
      transaction_date: '2026-11-02',
    },
    {
      type: 'income',
      category_name: 'Salary',
      convertedAmount: 100,
      transaction_date: '2026-11-01',
    },
    {
      type: 'expense',
      category_name: '__proto__',
      convertedAmount: 10,
      transaction_date: '2026-11-02',
    },
  ]);
  assert.equal(result.net, 65);
  assert.equal(result.savingsRate, 65);
  assert.deepEqual(result.runningBalance, [
    { date: '2026-11-01', balance: 100 },
    { date: '2026-11-02', balance: 65 },
  ]);
  assert.equal(result.categories[0].expense, 35);
  assert.throws(() => summarize([{ type: 'expense', convertedAmount: null }]), /Exchange rates/);
});

test('filters combine search, type and category and sort by converted amounts without mutating input', () => {
  const transactions = [
    {
      id: 1,
      type: 'expense',
      category_id: 2,
      category_name: 'Food',
      note: 'Lunch',
      currency: 'USD',
      convertedAmount: 20,
      transaction_date: '2026-11-03',
    },
    {
      id: 2,
      type: 'expense',
      category_id: 2,
      category_name: 'Food',
      note: 'Lunch',
      currency: 'EUR',
      convertedAmount: 30,
      transaction_date: '2026-11-02',
    },
    {
      id: 3,
      type: 'income',
      category_id: null,
      currency: 'USD',
      convertedAmount: 100,
      transaction_date: '2026-11-03',
    },
  ];
  assert.deepEqual(
    filterTransactions(transactions, {
      search: ' lunch ',
      type: 'expense',
      category: '2',
      sort: 'amount-desc',
    }).map((t) => t.id),
    [2, 1],
  );
  assert.deepEqual(
    filterTransactions(transactions, { category: 'uncategorized' }).map((t) => t.id),
    [3],
  );
  assert.equal(transactions[0].id, 1);
});

test('budget warnings handle exact limits, overspending, zero limits and unbudgeted categories', () => {
  assert.equal(budgetStatus(79, 100).label, 'On track');
  assert.equal(budgetStatus(80, 100).label, 'Near limit');
  assert.equal(budgetStatus(100, 100).label, 'Limit reached');
  assert.equal(budgetStatus(120, 100).remaining, -20);
  assert.equal(budgetStatus(1, 0).percent, 100);
  assert.equal(budgetStatus(0, 0).label, 'Limit reached');
  assert.equal(budgetStatus(100, null).label, 'No limit');
});

test('CSV preserves original currencies and escapes quotes, multiline text and spreadsheet formulas', () => {
  const csv = transactionsToCsv([
    {
      transaction_date: '2026-11-01',
      type: 'expense',
      category_name: '=1+1',
      note: 'Cafe, "morning"\ncoffee',
      amount: '12.50',
      currency: 'EUR',
      convertedAmount: 20,
    },
  ]);
  assert.ok(csv.startsWith('\uFEFFDate,Type,Category,Note,Amount,Currency\r\n'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"Cafe, ""morning""\ncoffee"'));
  assert.ok(csv.includes('"12.50","EUR"'));
  assert.ok(!csv.includes('"20"'));
});

test('missing, mismatched, and zero exchange rates never silently produce totals', () => {
  assert.throws(() => convertAmount(5, 'USD', 'EUR', null), /Missing exchange rate/);
  assert.throws(
    () => convertAmount(5, 'USD', 'EUR', { base: 'GBP', rates: { USD: 2 } }),
    /Missing exchange rate/,
  );
  assert.equal(convertAmount(5, 'USD', 'USD', null), 5);
});

test('rates cache deduplicates requests and a failed request can be retried', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify({ base: 'EUR', rates: { USD: 1.25 }, date: '2026-11-16' }));
  });
  await Promise.all([fetchRates('EUR'), fetchRates('EUR')]);
  assert.equal(requests, 1);
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 503 }));
  await assert.rejects(fetchRates('GBP'));
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ base: 'GBP', rates: { USD: 1.3 } })),
  );
  assert.equal((await fetchRates('GBP')).base, 'GBP');
});
