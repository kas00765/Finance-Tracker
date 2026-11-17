export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthRange(month) {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split('-').map(Number);
  const last = new Date(0);
  last.setFullYear(year, number, 0);
  return { from: `${month}-01`, to: `${month}-${last.getDate()}` };
}

export function displayDate(value) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function summarize(transactions) {
  let income = 0,
    expense = 0;
  const categories = new Map(),
    months = new Map(),
    days = new Map();
  for (const t of transactions) {
    const value = t.convertedAmount;
    if (!Number.isFinite(value)) throw new Error('Exchange rates are required for this summary');
    if (t.type === 'income') income += value;
    else expense += value;
    const category = t.category_name || 'Uncategorized';
    if (!categories.has(category)) categories.set(category, { category, income: 0, expense: 0 });
    categories.get(category)[t.type] += value;
    const month = t.transaction_date.slice(0, 7);
    if (!months.has(month)) months.set(month, { month, income: 0, expense: 0 });
    months.get(month)[t.type] += value;
    const day = t.transaction_date.slice(0, 10);
    days.set(day, (days.get(day) || 0) + (t.type === 'income' ? value : -value));
  }
  let balance = 0;
  const runningBalance = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, change]) => ({ date, balance: (balance += change) }));
  return {
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
    categories: [...categories.values()].sort((a, b) => b.expense - a.expense),
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    runningBalance,
  };
}

export function filterTransactions(
  transactions,
  { search = '', type = '', category = '', sort = 'date-desc' } = {},
) {
  const query = search.trim().toLowerCase();
  const list = transactions.filter(
    (t) =>
      (!type || t.type === type) &&
      (!category ||
        (category === 'uncategorized'
          ? t.category_id == null
          : String(t.category_id) === category)) &&
      (!query ||
        `${t.note || ''} ${t.category_name || 'Uncategorized'} ${t.currency}`
          .toLowerCase()
          .includes(query)),
  );
  return list.sort((a, b) => {
    if (sort.startsWith('amount'))
      return (
        (sort === 'amount-asc' ? 1 : -1) * (a.convertedAmount - b.convertedAmount) || b.id - a.id
      );
    return (
      (sort === 'date-asc' ? 1 : -1) * a.transaction_date.localeCompare(b.transaction_date) ||
      b.id - a.id
    );
  });
}

export function budgetStatus(spent, limit) {
  if (limit === null) return { label: 'No limit', tone: 'muted', percent: 0, remaining: null };
  const percent = limit === 0 ? (spent > 0 ? 100 : 0) : Math.min(100, (spent / limit) * 100);
  const remaining = limit - spent;
  if (spent > limit) return { label: 'Over budget', tone: 'danger', percent, remaining };
  if (spent === limit) return { label: 'Limit reached', tone: 'warning', percent, remaining };
  if (spent >= limit * 0.8) return { label: 'Near limit', tone: 'warning', percent, remaining };
  return { label: 'On track', tone: 'positive', percent, remaining };
}
