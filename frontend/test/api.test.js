import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/api.js';
import { SESSION_EXPIRED } from '../src/utils/session.js';
import { convertAmount, hasRatesFor } from '../src/utils/currency.js';

beforeEach((t) => {
  const values = new Map([
    ['token', 'current-token'],
    ['user', '{malformed legacy data'],
  ]);
  function stubGlobal(name, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  stubGlobal('localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  stubGlobal('window', new EventTarget());
});

test('authenticated 401 clears stored credentials and notifies the UI once', async (t) => {
  let expired = 0;
  window.addEventListener(SESSION_EXPIRED, () => expired++);
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ error: 'Expired' }), { status: 401 }),
  );
  await assert.rejects(api.getMe(), { status: 401 });
  assert.equal(localStorage.getItem('token'), null);
  assert.equal(localStorage.getItem('user'), null);
  assert.equal(expired, 1);
});

test('failed login does not expire an existing session or send its token', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  });
  await assert.rejects(api.login('someone@example.com', 'wrong'), { status: 401 });
  assert.equal(localStorage.getItem('token'), 'current-token');
});

test('a delayed 401 from an old request cannot clear a newly signed-in session', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    localStorage.setItem('token', 'new-token');
    return new Response('{}', { status: 401 });
  });
  await assert.rejects(api.getTransactions(), { status: 401 });
  assert.equal(localStorage.getItem('token'), 'new-token');
});

test('server and network failures preserve credentials for retry', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  await assert.rejects(api.getMe(), { status: 500 });
  assert.equal(localStorage.getItem('token'), 'current-token');
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Network unavailable');
  });
  await assert.rejects(api.getMe(), /Network unavailable/);
  assert.equal(localStorage.getItem('token'), 'current-token');
});

test('budget edits send the saved currency and decimal amount without rounding', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/budgets');
    assert.deepEqual(JSON.parse(options.body), {
      categoryId: 1,
      month: '2026-11',
      amount: '100.25',
      currency: 'USD',
    });
    return new Response('{}', { status: 201 });
  });
  await api.saveBudget(1, '2026-11', '100.25', 'USD');
});

test('budget limits and spending convert from their saved currencies to the same home currency', () => {
  const rates = { base: 'EUR', rates: { USD: 1.25, GBP: 0.8 } };
  const limit = convertAmount(100, 'USD', 'EUR', rates);
  const spent = convertAmount(40, 'GBP', 'EUR', rates);
  assert.equal(limit, 80);
  assert.equal(spent, 50);
  assert.equal(spent / limit, 0.625);
  assert.equal(convertAmount(100, 'USD', 'USD', null), 100);
});

test('budget comparisons wait for matching, complete exchange rates', () => {
  assert.equal(hasRatesFor(['USD'], 'EUR', null), false);
  assert.equal(hasRatesFor(['USD'], 'EUR', { base: 'USD', rates: { USD: 1 } }), false);
  assert.equal(hasRatesFor(['USD'], 'EUR', { base: 'EUR', rates: {} }), false);
  assert.equal(hasRatesFor(['USD'], 'EUR', { base: 'EUR', rates: { USD: 0 } }), false);
  assert.equal(hasRatesFor(['USD', 'EUR'], 'EUR', { base: 'EUR', rates: { USD: 1.25 } }), true);
});
