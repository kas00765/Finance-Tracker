import { transactionError } from './validation.js';

export const MAX_IMPORT_ROWS = 500;

export function importRequestError(rows) {
  return !Array.isArray(rows) || rows.length === 0 || rows.length > MAX_IMPORT_ROWS
    ? `Provide between 1 and ${MAX_IMPORT_ROWS} transactions` : null;
}

function fingerprint(transaction) {
  return JSON.stringify([transaction.date, Number(transaction.amount).toFixed(2), transaction.type,
    transaction.currency, transaction.categoryId ?? null, transaction.note || '']);
}

// Resolves category names only within this account. Preview and commit use the
// same validation and duplicate rules; commit rechecks against current data.
export async function prepareImport(db, userId, rows) {
  const categories = (await db.query('SELECT id, name FROM categories WHERE user_id = $1', [userId])).rows;
  const results = rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { status: 'invalid', error: 'Expected a transaction object' };
    if ('categoryId' in row) return { status: 'invalid', error: 'Use a category name, not a category ID' };
    if (row.category != null && (typeof row.category !== 'string' || row.category.length > 100)) {
      return { status: 'invalid', error: 'Category must be text with at most 100 characters' };
    }
    const name = (row.category || '').trim();
    const matches = name ? categories.filter((c) => c.name.trim().toLowerCase() === name.toLowerCase()) : [];
    if (matches.length > 1) return { status: 'invalid', error: `More than one category matches "${name}". Rename it in Settings or ignore the category column.` };
    if (name && !matches.length && name.toLowerCase() !== 'uncategorized') {
      return { status: 'invalid', error: `Category "${name}" does not exist. Add it in Settings or ignore the category column.` };
    }
    const transaction = { amount: row.amount, type: row.type, date: row.date, currency: row.currency,
      categoryId: matches[0]?.id ?? null, note: row.note ?? null };
    const error = transactionError(transaction);
    if (error) return { status: 'invalid', error };
    if (transaction.note && transaction.note.length > 2000) return { status: 'invalid', error: 'Note must be at most 2,000 characters' };
    transaction.amount = Number(transaction.amount).toFixed(2);
    transaction.note = transaction.note || null;
    transaction.categoryName = matches[0]?.name || 'Uncategorized';
    return { status: 'ready', transaction };
  });
  const valid = results.filter((row) => row.status === 'ready');
  const dates = valid.map((row) => row.transaction.date).sort();
  const existing = dates.length ? (await db.query(
    `SELECT amount, type, currency, category_id, note, to_char(transaction_date, 'YYYY-MM-DD') AS date
     FROM transactions WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3`,
    [userId, dates[0], dates[dates.length - 1]],
  )).rows : [];
  const saved = new Set(existing.map((row) => fingerprint({ ...row, categoryId: row.category_id })));
  const seen = new Set();
  for (const row of valid) {
    const key = fingerprint(row.transaction);
    if (saved.has(key) || seen.has(key)) {
      row.status = 'duplicate';
      row.error = saved.has(key) ? 'Matches a saved transaction' : 'Repeated in this file';
    }
    seen.add(key);
  }
  return results;
}
