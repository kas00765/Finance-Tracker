import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, BarChart3, Flame, Tag,
  Search as SearchIcon, Receipt, Plus,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { SUPPORTED_CURRENCIES, fetchRates, convertAmount, formatMoney } from '../utils/currency.js';
import { RANGE_OPTIONS, getRangeDates, rangeLabel } from '../utils/dateRange.js';

const COLORS = ['#10b981', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#fb923c'];
const POSITIVE = '#10b981';
const NEGATIVE = '#ff6b6b';
const INCOME_EXPENSE_COLORS = [POSITIVE, NEGATIVE];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { homeCurrency } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rates, setRates] = useState(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState('this-month');

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(homeCurrency);
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const amountInputRef = useRef(null);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', type: 'expense', categoryId: '', note: '', date: '' });

  useEffect(() => {
    setCurrency(homeCurrency);
  }, [homeCurrency]);

  async function loadAll() {
    try {
      const { from, to } = getRangeDates(range);
      const [txns, cats, rateData] = await Promise.all([
        api.getTransactions({ ...(from ? { from } : {}), ...(to ? { to } : {}) }),
        api.getCategories(),
        fetchRates(homeCurrency),
      ]);
      setTransactions(txns);
      setCategories(cats);
      setRates(rateData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCurrency, range]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createTransaction({
        amount: parseFloat(amount),
        currency,
        type,
        categoryId: categoryId || null,
        note,
        date,
      });
      setAmount('');
      setNote('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteTransaction(id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditForm({
      amount: t.amount,
      type: t.type,
      categoryId: t.category_id || '',
      note: t.note || '',
      date: t.transaction_date,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    setError('');
    try {
      await api.updateTransaction(id, {
        amount: parseFloat(editForm.amount),
        type: editForm.type,
        categoryId: editForm.categoryId || null,
        note: editForm.note,
        date: editForm.date,
      });
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function focusAddForm() {
    amountInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    amountInputRef.current?.focus();
  }

  // Every total/chart is computed from amounts converted into the home currency,
  // since transactions can be logged in different currencies.
  const converted = useMemo(
    () =>
      transactions.map((t) => ({
        ...t,
        convertedAmount: convertAmount(Number(t.amount), t.currency, homeCurrency, rates),
      })),
    [transactions, rates, homeCurrency]
  );

  const totalIncome = converted.filter((t) => t.type === 'income').reduce((s, t) => s + t.convertedAmount, 0);
  const totalExpense = converted.filter((t) => t.type === 'expense').reduce((s, t) => s + t.convertedAmount, 0);

  const byCategory = useMemo(() => {
    const map = {};
    converted
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const key = t.category_name || 'Uncategorized';
        map[key] = (map[key] || 0) + t.convertedAmount;
      });
    return Object.entries(map).map(([category, total]) => ({ category, total }));
  }, [converted]);

  const byMonth = useMemo(() => {
    const map = {};
    converted.forEach((t) => {
      const month = t.transaction_date.slice(0, 7);
      if (!map[month]) map[month] = { month, income: 0, expense: 0 };
      map[month][t.type] += t.convertedAmount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [converted]);

  // Average monthly spending: total expenses spread across the months that actually have data.
  const avgMonthlySpending = byMonth.length > 0 ? totalExpense / byMonth.length : 0;

  // The single largest expense transaction, for a quick "biggest hit" callout.
  const biggestExpense = useMemo(() => {
    const expenses = converted.filter((t) => t.type === 'expense');
    if (expenses.length === 0) return null;
    return expenses.reduce((max, t) => (t.convertedAmount > max.convertedAmount ? t : max), expenses[0]);
  }, [converted]);

  // Whichever category has taken the biggest bite out of spending.
  const topCategory = useMemo(() => {
    if (byCategory.length === 0) return null;
    return byCategory.reduce((max, c) => (c.total > max.total ? c : max), byCategory[0]);
  }, [byCategory]);

  // Percentage of income kept rather than spent. Null when there's no income to divide by.
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : null;

  const incomeVsExpense = [
    { name: 'Income', value: totalIncome },
    { name: 'Expenses', value: totalExpense },
  ].filter((d) => d.value > 0);

  const visibleTransactions = useMemo(() => {
    let list = converted;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.note && t.note.toLowerCase().includes(q)) ||
          (t.category_name && t.category_name.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case 'date-asc':
        sorted.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
        break;
      case 'amount-desc':
        sorted.sort((a, b) => b.convertedAmount - a.convertedAmount);
        break;
      case 'amount-asc':
        sorted.sort((a, b) => a.convertedAmount - b.convertedAmount);
        break;
      case 'date-desc':
      default:
        sorted.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    }
    return sorted;
  }, [converted, search, sortBy]);

  return (
    <div>
      <div className="page-header row between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-greeting">{greeting()} 👋 Here's your financial overview for {rangeLabel(range).toLowerCase()}.</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGE_OPTIONS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="row between">
            <div className="stat-label">Balance</div>
            <div className="kpi-icon"><Wallet size={16} /></div>
          </div>
          <p className="stat-value">{formatMoney(totalIncome - totalExpense, homeCurrency)}</p>
        </div>
        <div className="card">
          <div className="row between">
            <div className="stat-label">Income</div>
            <div className="kpi-icon"><TrendingUp size={16} /></div>
          </div>
          <p className="stat-value" style={{ color: POSITIVE }}>{formatMoney(totalIncome, homeCurrency)}</p>
        </div>
        <div className="card">
          <div className="row between">
            <div className="stat-label">Expenses</div>
            <div className="kpi-icon danger"><TrendingDown size={16} /></div>
          </div>
          <p className="stat-value" style={{ color: NEGATIVE }}>{formatMoney(totalExpense, homeCurrency)}</p>
        </div>
        <div className="card">
          <div className="row between">
            <div className="stat-label">Savings Rate</div>
            <div className="kpi-icon info"><PiggyBank size={16} /></div>
          </div>
          <p className="stat-value" style={{ color: savingsRate === null ? undefined : savingsRate >= 0 ? POSITIVE : NEGATIVE }}>
            {savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <h2 className="insights-heading">Insights</h2>
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card insight-card">
          <div className="row between">
            <div className="stat-label">Avg Monthly Spending</div>
            <div className="kpi-icon"><BarChart3 size={16} /></div>
          </div>
          <p className="stat-value" style={{ fontSize: '1.25rem' }}>{formatMoney(avgMonthlySpending, homeCurrency)}</p>
        </div>
        <div className="card insight-card">
          <div className="row between">
            <div className="stat-label">Biggest Expense</div>
            <div className="kpi-icon danger"><Flame size={16} /></div>
          </div>
          <p className="stat-value" style={{ fontSize: '1.25rem', color: NEGATIVE }}>
            {biggestExpense ? formatMoney(biggestExpense.convertedAmount, homeCurrency) : '—'}
          </p>
          {biggestExpense && (
            <div className="txn-meta">{biggestExpense.category_name || biggestExpense.note || 'Uncategorized'}</div>
          )}
        </div>
        <div className="card insight-card">
          <div className="row between">
            <div className="stat-label">Top Category</div>
            <div className="kpi-icon"><Tag size={16} /></div>
          </div>
          <p className="stat-value" style={{ fontSize: '1.15rem' }}>{topCategory ? topCategory.category : '—'}</p>
          {topCategory && <div className="txn-meta">{formatMoney(topCategory.total, homeCurrency)}</div>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add transaction</h3>
        <form onSubmit={handleAdd}>
          <div className="add-txn-grid">
            <div className="row" style={{ gap: '0.5rem' }}>
              <input
                ref={amountInputRef}
                type="number" step="0.01" placeholder="Amount" value={amount}
                onChange={(e) => setAmount(e.target.value)} required style={{ flex: 1, minWidth: 0 }}
              />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: 90 }}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input
              type="text" placeholder="Note (optional)" value={note}
              onChange={(e) => setNote(e.target.value)} style={{ gridColumn: 'span 2' }}
            />
          </div>
          <button type="submit"><Plus size={16} style={{ verticalAlign: -3, marginRight: 4 }} />Add Transaction</button>
        </form>
        {error && <p className="error" style={{ marginTop: '0.6rem' }}>{error}</p>}
      </div>

      {byCategory.length > 0 && (
        <div className="card">
          <h3>Spending by category <span className="txn-meta">(in {homeCurrency})</span></h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} label>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(v, homeCurrency)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {byMonth.length > 0 && (
        <div className="card">
          <h3>Income vs expenses by month <span className="txn-meta">(in {homeCurrency})</span></h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byMonth}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatMoney(v, homeCurrency)} />
              <Legend />
              <Bar dataKey="income" fill={POSITIVE} />
              <Bar dataKey="expense" fill={NEGATIVE} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byMonth.length > 0 && (
        <div className="card">
          <h3>Spending trend <span className="txn-meta">(in {homeCurrency})</span></h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatMoney(v, homeCurrency)} />
              <Line type="monotone" dataKey="expense" name="Spending" stroke={NEGATIVE} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {incomeVsExpense.length > 0 && (
        <div className="card">
          <h3>Income vs expenses <span className="txn-meta">(in {homeCurrency})</span></h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={incomeVsExpense} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={60} outerRadius={90} label
              >
                {incomeVsExpense.map((_, i) => (
                  <Cell key={i} fill={INCOME_EXPENSE_COLORS[i % INCOME_EXPENSE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(v, homeCurrency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="row between" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Recent transactions</h3>
          <div className="row">
            <div style={{ position: 'relative' }}>
              <SearchIcon size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text" placeholder="Search note or category" value={search}
                onChange={(e) => setSearch(e.target.value)} style={{ width: 200, paddingLeft: 32 }}
              />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Amount: high to low</option>
              <option value="amount-asc">Amount: low to high</option>
            </select>
          </div>
        </div>

        {transactions.length === 0 && (
          <div className="empty-state">
            <Receipt size={40} className="empty-state-icon" />
            <h4>No transactions yet</h4>
            <p>Start tracking your spending by adding your first transaction.</p>
            <button onClick={focusAddForm}><Plus size={16} style={{ verticalAlign: -3, marginRight: 4 }} />Add Transaction</button>
          </div>
        )}
        {transactions.length > 0 && visibleTransactions.length === 0 && <p>No transactions match your search.</p>}

        {visibleTransactions.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="txn-row" style={{ flexWrap: 'wrap' }}>
              <div className="row" style={{ flex: 1 }}>
                <input
                  type="number" step="0.01" value={editForm.amount} style={{ width: 100 }}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="date" value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
                <input
                  type="text" placeholder="Note" value={editForm.note} style={{ flex: 1, minWidth: 100 }}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                />
              </div>
              <div className="row">
                <button className="btn-small" onClick={() => saveEdit(t.id)}>Save</button>
                <button className="btn-small btn-secondary" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={t.id} className="txn-row">
              <div>
                <strong style={{ color: t.type === 'income' ? POSITIVE : NEGATIVE }}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), t.currency)}
                </strong>{' '}
                {t.currency !== homeCurrency && (
                  <span className="txn-meta">
                    (≈ {formatMoney(t.convertedAmount, homeCurrency)})
                  </span>
                )}{' '}
                {t.category_name && <span className="txn-meta">· {t.category_name}</span>}{' '}
                {t.note && <span className="txn-meta">· {t.note}</span>}
                <div className="txn-meta">{t.transaction_date}</div>
              </div>
              <div className="row">
                <button className="btn-small btn-secondary" onClick={() => startEdit(t)}>Edit</button>
                <button className="btn-small btn-danger" onClick={() => handleDelete(t.id)}>Delete</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
