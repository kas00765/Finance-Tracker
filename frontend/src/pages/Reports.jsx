import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { fetchRates, convertAmount, formatMoney } from '../utils/currency.js';

export default function Reports() {
  const { homeCurrency } = useAuth();
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rates, setRates] = useState(null);
  const [error, setError] = useState('');

  const [categoryFilter, setCategoryFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load() {
    setError('');
    try {
      const [cats, rateData] = await Promise.all([api.getCategories(), fetchRates(homeCurrency)]);
      setCategories(cats);
      setRates(rateData);
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const txns = await api.getTransactions(params);
      setTransactions(txns);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCurrency, categoryFilter, from, to]);

  const converted = useMemo(
    () =>
      transactions.map((t) => ({
        ...t,
        convertedAmount: convertAmount(Number(t.amount), t.currency, homeCurrency, rates),
      })),
    [transactions, rates, homeCurrency]
  );

  const categoryTotals = useMemo(() => {
    const map = {};
    converted.forEach((t) => {
      const key = t.category_name || 'Uncategorized';
      if (!map[key]) map[key] = { category: key, income: 0, expense: 0 };
      map[key][t.type] += t.convertedAmount;
    });
    return Object.values(map).sort((a, b) => b.expense - a.expense);
  }, [converted]);

  const runningBalance = useMemo(() => {
    const sorted = [...converted].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    let balance = 0;
    return sorted.map((t) => {
      balance += t.type === 'income' ? t.convertedAmount : -t.convertedAmount;
      return { date: t.transaction_date, balance };
    });
  }, [converted]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-greeting">Filter your transaction history and see trends over time.</p>
      </div>
      <div className="card">
        <h3>Filters</h3>
        <div className="row">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="txn-meta">
            From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="txn-meta">
            To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h3>Balance over time <span className="txn-meta">(in {homeCurrency})</span></h3>
        {runningBalance.length === 0 ? (
          <p>No transactions match these filters.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={runningBalance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v) => formatMoney(v, homeCurrency)} />
              <Line type="monotone" dataKey="balance" stroke="#764ba2" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3>Totals by category <span className="txn-meta">(in {homeCurrency})</span></h3>
        {categoryTotals.length === 0 ? (
          <p>Nothing to show yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '0.4rem 0' }}>Category</th>
                <th>Income</th>
                <th>Expense</th>
              </tr>
            </thead>
            <tbody>
              {categoryTotals.map((row) => (
                <tr key={row.category} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.4rem 0' }}>{row.category}</td>
                  <td style={{ color: '#2ed573' }}>{formatMoney(row.income, homeCurrency)}</td>
                  <td style={{ color: '#ff4757' }}>{formatMoney(row.expense, homeCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
