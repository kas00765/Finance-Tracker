// Computes { from, to } date strings ('YYYY-MM-DD') for a named range, or
// { from: undefined, to: undefined } for 'all-time' (no filtering).
export const RANGE_OPTIONS = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-3-months', label: 'Last 3 months' },
  { key: 'this-year', label: 'This year' },
  { key: 'all-time', label: 'All time' },
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function getRangeDates(rangeKey) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12

  switch (rangeKey) {
    case 'this-month':
      return { from: toDateStr(y, m, 1), to: toDateStr(y, m, lastDayOfMonth(y, m)) };
    case 'last-month': {
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      return { from: toDateStr(ly, lm, 1), to: toDateStr(ly, lm, lastDayOfMonth(ly, lm)) };
    }
    case 'last-3-months': {
      let startMonth = m - 2;
      let startYear = y;
      if (startMonth <= 0) {
        startMonth += 12;
        startYear -= 1;
      }
      return {
        from: toDateStr(startYear, startMonth, 1),
        to: toDateStr(y, m, lastDayOfMonth(y, m)),
      };
    }
    case 'this-year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'all-time':
    default:
      return { from: undefined, to: undefined };
  }
}

export function rangeLabel(rangeKey) {
  return RANGE_OPTIONS.find((r) => r.key === rangeKey)?.label || 'All time';
}
