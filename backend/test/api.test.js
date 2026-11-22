import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PGlite } from '@electric-sql/pglite';
import { pool } from '../db/index.js';
import auth from '../routes/auth.js';
import transactions from '../routes/transactions.js';
import budgets from '../routes/budgets.js';
import users from '../routes/users.js';
import categories from '../routes/categories.js';

process.env.JWT_SECRET = 'integration-tests-only-secret';
const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
const db = new PGlite();
const query = pool.query;
const connect = pool.connect;
let server, base;
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/migration_integrity.sql', import.meta.url), 'utf8');

before(async () => {
  await db.exec(schema);
  await db.exec(migration);
  pool.query = (sql, params) => db.query(sql, params);
  pool.connect = async () => ({ query: (sql, params) => db.query(sql, params), release() {} });
  const app = express();
  app.use('/transactions/import', express.json({ limit: '2mb' }));
  app.use(express.json());
  app.use('/auth', auth);
  app.use('/transactions', transactions);
  app.use('/budgets', budgets);
  app.use('/users', users);
  app.use('/categories', categories);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await db.exec(`TRUNCATE users RESTART IDENTITY CASCADE;
    INSERT INTO users (email, password_hash, home_currency) VALUES
      ('first@example.com', 'unused', 'USD'), ('second@example.com', 'unused', 'EUR');
    INSERT INTO categories (user_id, name) VALUES (1, 'Food'), (2, 'Private category');`);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  pool.query = query;
  pool.connect = connect;
  await pool.end();
  await db.close();
});

async function request(path, method = 'GET', body, authToken = token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

test('transaction create and update reject another user’s category without writing', async () => {
  const created = await request('/transactions', 'POST', { amount: 12, type: 'expense', categoryId: 1, note: 'Keep me' });
  assert.equal(created.status, 201);
  assert.equal((await request('/transactions', 'POST', { amount: 10, type: 'expense', categoryId: 2 })).status, 400);
  assert.equal((await request(`/transactions/${created.body.id}`, 'PUT', { categoryId: 2 })).status, 400);
  const rows = (await db.query('SELECT * FROM transactions')).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category_id, 1);
});

test('transaction dates remain calendar dates on create, list, and update', async () => {
  const created = await request('/transactions', 'POST', { amount: 10, type: 'expense', date: '2026-01-01' });
  assert.equal(created.body.transaction_date, '2026-01-01');
  assert.equal((await request('/transactions')).body[0].transaction_date, '2026-01-01');
  const updated = await request(`/transactions/${created.body.id}`, 'PUT', { date: '2024-02-29' });
  assert.equal(updated.body.transaction_date, '2024-02-29');
});

test('partial transaction updates preserve omitted fields and can explicitly clear them', async () => {
  const created = await request('/transactions', 'POST', { amount: 12, type: 'expense', categoryId: 1, note: 'Keep me' });
  const updated = await request(`/transactions/${created.body.id}`, 'PUT', { amount: '18.25' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.category_id, 1);
  assert.equal(updated.body.note, 'Keep me');
  const cleared = await request(`/transactions/${created.body.id}`, 'PUT', { categoryId: null, note: null });
  assert.equal(cleared.body.category_id, null);
  assert.equal(cleared.body.note, null);
});

test('account boundaries also apply to reads, updates, and deletes', async () => {
  const secondToken = jwt.sign({ userId: 2 }, process.env.JWT_SECRET);
  const created = await request('/transactions', 'POST', { amount: 10, type: 'expense', categoryId: 2 }, secondToken);
  assert.deepEqual((await request('/transactions')).body, []);
  assert.equal((await request(`/transactions/${created.body.id}`, 'PUT', { amount: 20 })).status, 404);
  await request(`/transactions/${created.body.id}`, 'DELETE');
  assert.equal((await db.query('SELECT * FROM transactions')).rows.length, 1);
});

test('invalid amounts, types, dates, currencies, and category IDs return 400 on create and update', async () => {
  const created = await request('/transactions', 'POST', { amount: 10, type: 'expense' });
  const invalid = [
    ...[-1, 0, 'NaN', 'Infinity', true, [], {}, '', '1.234', 1e10].map((amount) => ({ amount })),
    { type: 'refund' }, { date: '2026-02-30' }, { date: '2025-02-29' }, { date: '0000-01-01' },
    { currency: 'ZZZ' }, { categoryId: -1 }, { categoryId: [1] }, { note: {} },
  ];
  for (const change of invalid) {
    assert.equal((await request('/transactions', 'POST', { amount: 10, type: 'expense', ...change })).status, 400, JSON.stringify(change));
    assert.equal((await request(`/transactions/${created.body.id}`, 'PUT', change)).status, 400, JSON.stringify(change));
  }
  assert.equal((await request('/transactions', 'POST', { amount: '0.01', type: 'income', date: '2024-02-29' })).status, 201);
  assert.equal((await request('/transactions?from=2026-02-30')).status, 400);
  assert.equal((await request('/transactions?from=2026-02-02&to=2026-01-01')).status, 400);
  assert.equal((await request('/transactions/bad', 'DELETE')).status, 400);
});

test('budgets reject foreign categories, malformed months, and invalid amounts', async () => {
  const body = { categoryId: 1, month: '2026-11', amount: 100 };
  for (const change of [{ categoryId: 2 }, { month: '2026-13' }, { month: '2026-1' }, { month: '0000-01' }, { amount: -1 }, { amount: true }, { amount: '1.001' }, { currency: 'ZZZ' }]) {
    assert.equal((await request('/budgets', 'POST', { ...body, ...change })).status, 400);
  }
  assert.equal((await request('/budgets?month=2026-99')).status, 400);
  assert.equal((await request('/budgets', 'POST', { ...body, amount: 0 })).status, 201);
});

test('saved budget currency survives home-currency changes and edits', async () => {
  const body = { categoryId: 1, month: '2026-11', amount: 100 };
  assert.equal((await request('/budgets', 'POST', body)).body.currency, 'USD');
  assert.equal((await request('/users/me', 'PUT', { homeCurrency: 'EUR' })).status, 200);
  const budget = (await request('/budgets?month=2026-11')).body[0];
  assert.equal(budget.currency, 'USD');
  assert.equal(Number(budget.amount), 100);
  assert.equal((await request('/budgets', 'POST', { ...body, amount: 120 })).body.currency, 'USD');
  assert.equal((await request('/budgets', 'POST', { ...body, currency: 'GBP' })).body.currency, 'GBP');
  assert.equal((await request('/users/me', 'PUT', { homeCurrency: 'XYZ' })).status, 400);
});

test('database constraints prevent cross-account category links and invalid amounts/months', async () => {
  await assert.rejects(db.query("INSERT INTO transactions(user_id, category_id, amount, type) VALUES (1, 2, 1, 'expense')"), { code: '23503' });
  await assert.rejects(db.query("INSERT INTO transactions(user_id, amount, type) VALUES (1, -1, 'expense')"), { code: '23514' });
  await assert.rejects(db.query("INSERT INTO budgets(user_id, category_id, amount, month, currency) VALUES (1, 2, 1, '2026-11', 'USD')"), { code: '23503' });
  await assert.rejects(db.query("INSERT INTO budgets(user_id, category_id, amount, month, currency) VALUES (1, 1, -1, '2026-11', 'USD')"), { code: '23514' });
  await assert.rejects(db.query("INSERT INTO budgets(user_id, category_id, amount, month, currency) VALUES (1, 1, 1, '2026-13', 'USD')"), { code: '23514' });
});

test('category deletion still clears transactions and deletes budgets', async () => {
  await request('/transactions', 'POST', { amount: 1, type: 'expense', categoryId: 1 });
  await request('/budgets', 'POST', { categoryId: 1, month: '2026-11', amount: 20 });
  await db.query('DELETE FROM categories WHERE id = 1');
  assert.equal((await db.query('SELECT category_id FROM transactions')).rows[0].category_id, null);
  assert.equal((await db.query('SELECT * FROM budgets')).rows.length, 0);
});

test('signup commits the account and all categories, and duplicate email returns 409', async () => {
  const body = { email: 'new@example.com', password: 'test-password' };
  const result = await request('/auth/signup', 'POST', body);
  assert.equal(result.status, 201);
  assert.equal(result.body.user.home_currency, 'USD');
  assert.equal((await db.query('SELECT * FROM categories WHERE user_id = $1', [result.body.user.id])).rows.length, 6);
  assert.equal((await request('/auth/signup', 'POST', body)).status, 409);
  const login = await request('/auth/login', 'POST', body);
  assert.equal(login.status, 200);
  assert.equal(login.body.user.home_currency, 'USD');
});

test('signup rolls back account and seeded categories when a category insert fails', async (t) => {
  t.mock.method(console, 'error', () => {});
  await db.exec(`CREATE FUNCTION fail_category() RETURNS trigger AS $$
    BEGIN IF NEW.name = 'Rent' THEN RAISE EXCEPTION 'injected seed failure'; END IF; RETURN NEW; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_seed BEFORE INSERT ON categories FOR EACH ROW EXECUTE FUNCTION fail_category();`);
  try {
    assert.equal((await request('/auth/signup', 'POST', { email: 'rollback@example.com', password: 'test-password' })).status, 500);
    assert.equal((await db.query("SELECT * FROM users WHERE email = 'rollback@example.com'")).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM categories')).rows.length, 2);
  } finally {
    await db.exec('DROP TRIGGER fail_seed ON categories; DROP FUNCTION fail_category();');
  }
});

test('session profile returns user details and rejects expired or deleted users', async () => {
  const me = await request('/users/me');
  assert.deepEqual(me.body, { id: 1, email: 'first@example.com', home_currency: 'USD' });
  const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await request('/users/me', 'GET', undefined, expired)).status, 401);
  await db.query('DELETE FROM users WHERE id = 1');
  assert.equal((await request('/users/me')).status, 401);
});

test('malformed signup, login, and category values return 400', async () => {
  for (const body of [{ email: {}, password: 'secret' }, { email: 'invalid', password: 'secret' }, { email: 'a@example.com', password: {} }, { email: 'a@example.com', password: 'a'.repeat(73) }]) {
    assert.equal((await request('/auth/signup', 'POST', body)).status, 400);
  }
  assert.equal((await request('/auth/login', 'POST', { email: [], password: {} })).status, 400);
  for (const name of [{}, [], '', ' '.repeat(5), 'a'.repeat(101)]) {
    assert.equal((await request('/categories', 'POST', { name })).status, 400);
  }
  assert.equal((await request('/categories/bad', 'DELETE')).status, 400);
});

test('migration backfills old budgets and can be rerun without changing stored currency', async () => {
  await db.exec('ALTER TABLE budgets DROP COLUMN currency');
  await db.exec("INSERT INTO budgets(user_id, category_id, month, amount) VALUES (2, 2, '2026-11', 50)");
  await db.exec(migration);
  assert.equal((await db.query('SELECT currency FROM budgets')).rows[0].currency, 'EUR');
  await db.exec("UPDATE users SET home_currency = 'GBP' WHERE id = 2");
  await db.exec(migration);
  assert.equal((await db.query('SELECT currency FROM budgets')).rows[0].currency, 'EUR');
});

const importRow = (extra = {}) => ({ amount: '12.50', type: 'expense', currency: 'USD', date: '2026-11-01', category: 'Food', note: 'Groceries', ...extra });

test('import preview validates records and detects file duplicates without writing', async () => {
  const result = await request('/transactions/import/preview', 'POST', { rows: [importRow(), importRow(), importRow({ date: '2026-02-30' }), importRow({ currency: 'ZZZ' })] });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.rows.map(r => r.status), ['ready', 'duplicate', 'invalid', 'invalid']);
  assert.equal(result.body.rows[0].transaction.categoryId, 1);
  assert.equal((await db.query('SELECT * FROM transactions')).rows.length, 0);
});

test('imports are account-scoped, skip exact matches, and recheck on commit', async () => {
  const rows = [importRow(), importRow(), importRow({ currency: 'EUR' })];
  const first = await request('/transactions/import', 'POST', { rows });
  assert.equal(first.status, 201);
  assert.deepEqual(first.body, { imported: 2, skipped: 1 });
  const retry = await request('/transactions/import', 'POST', { rows });
  assert.deepEqual(retry.body, { imported: 0, skipped: 3 });
  const preview = await request('/transactions/import/preview', 'POST', { rows });
  assert.ok(preview.body.rows.every(r => r.status === 'duplicate'));
  const secondToken = jwt.sign({ userId: 2 }, process.env.JWT_SECRET);
  const other = await request('/transactions/import', 'POST', { rows: [importRow({ category: '' })] }, secondToken);
  assert.equal(other.body.imported, 1);
  const fresh = importRow({ note: 'Created after preview' });
  await request('/transactions/import/preview', 'POST', { rows: [fresh] });
  await request('/transactions', 'POST', { ...fresh, categoryId: 1 });
  assert.deepEqual((await request('/transactions/import', 'POST', { rows: [fresh] })).body, { imported: 0, skipped: 1 });
});

test('import rejects unknown, foreign, ambiguous, and direct-ID categories', async () => {
  for (const extra of [{ category: 'Private category' }, { categoryId: 2 }, { category: 'Missing' }]) {
    assert.equal((await request('/transactions/import', 'POST', { rows: [importRow(extra)] })).status, 400);
  }
  await db.query("INSERT INTO categories (user_id, name) VALUES (1, ' food ')");
  assert.equal((await request('/transactions/import', 'POST', { rows: [importRow()] })).status, 400);
  assert.equal((await db.query('SELECT * FROM transactions')).rows.length, 0);
});

test('invalid import batches never partially save, and dates and currencies are required', async () => {
  for (const extra of [{ date: undefined }, { currency: undefined }, { amount: 0 }, { note: 'x'.repeat(2001) }]) {
    const result = await request('/transactions/import', 'POST', { rows: [importRow(), importRow(extra)] });
    assert.equal(result.status, 400);
  }
  for (const rows of [null, [], {}, Array(501).fill(importRow())]) {
    assert.equal((await request('/transactions/import', 'POST', { rows })).status, 400);
  }
  assert.equal((await db.query('SELECT * FROM transactions')).rows.length, 0);
});

test('database failure rolls back the entire import and a retry succeeds', async () => {
  await db.exec(`CREATE FUNCTION fail_import_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.note = 'fail' THEN RAISE EXCEPTION 'test import failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_import_test BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION fail_import_test();`);
  const rows = [importRow(), importRow({ note: 'fail' })];
  try {
    assert.equal((await request('/transactions/import', 'POST', { rows })).status, 500);
    assert.equal((await db.query('SELECT * FROM transactions')).rows.length, 0);
  } finally {
    await db.exec('DROP TRIGGER fail_import_test ON transactions; DROP FUNCTION fail_import_test();');
  }
  assert.deepEqual((await request('/transactions/import', 'POST', { rows })).body, { imported: 2, skipped: 0 });
});

test('imports accept 500 records and require an authenticated account', async () => {
  const rows = Array.from({ length: 500 }, (_, i) => importRow({ note: `Record ${i} ${"x".repeat(300)}` }));
  assert.equal((await request('/transactions/import', 'POST', { rows }, 'invalid')).status, 401);
  assert.deepEqual((await request('/transactions/import', 'POST', { rows })).body, { imported: 500, skipped: 0 });
});
