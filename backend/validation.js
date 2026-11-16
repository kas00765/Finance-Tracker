export const CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD']);

export function validId(value) {
  if (!['string', 'number'].includes(typeof value)) return false;
  return /^(?:[1-9]\d*)$/.test(String(value)) && Number(value) <= 2147483647;
}

export function validAmount(value, allowZero = false) {
  if (!['number', 'string'].includes(typeof value)) return false;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount < 1e10 && (allowZero ? amount >= 0 : amount > 0);
}

export function validMonth(value) {
  return typeof value === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function transactionError(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A transaction object is required';
  if ((!partial || 'amount' in body) && !validAmount(body.amount)) return 'Amount must be positive, below 10 billion, and have at most 2 decimal places';
  if ((!partial || 'type' in body) && !['income', 'expense'].includes(body.type)) return 'Type must be income or expense';
  if ('categoryId' in body && body.categoryId !== null && !validId(body.categoryId)) return 'Invalid category';
  if ('currency' in body && !CURRENCIES.has(body.currency)) return 'Unsupported currency';
  if ('date' in body && !validDate(body.date)) return 'Date must be a valid YYYY-MM-DD date';
  if ('note' in body && body.note !== null && typeof body.note !== 'string') return 'Note must be text';
  return null;
}

export async function ownsCategory(db, userId, categoryId) {
  if (categoryId == null) return true;
  const result = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  return result.rows.length > 0;
}
