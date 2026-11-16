import { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { SUPPORTED_CURRENCIES, fetchRates, convertAmount, formatMoney, hasRatesFor } from '../utils/currency.js';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

// Returns the actual last calendar day of a 'YYYY-MM' month (28-31), since
// not every month has 31 days and Postgres rejects e.g. '2026-09-31'.
function lastDayOfMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export default function Budgets() {
  const { homeCurrency } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rates, setRates] = useState(null);
  const [error, setError] = useState('');

  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState(homeCurrency);
  const ratesReady = rates?.base === homeCurrency && hasRatesFor(
    [...budgets.map((budget) => budget.currency), ...transactions.map((transaction) => transaction.currency)],
    homeCurrency, rates,
  );

  async function load() {
    setError('');
    try {
      const [cats, budgetData, rateData] = await Promise.all([
        api.getCategories(),
        api.getBudgets(month),
        fetchRates(homeCurrency),
      ]);
      setCategories(cats);
      setBudgets(budgetData);
      setRates(rateData);
      const lastDay = String(lastDayOfMonth(month)).padStart(2, '0');
      const txns = await api.getTransactions({ from: `${month}-01`, to: `${month}-${lastDay}` });
      setTransactions(txns);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, homeCurrency]);

  const spendByCategory = useMemo(() => {
    const map = {};
    if (!ratesReady) return map;
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const converted = convertAmount(Number(t.amount), t.currency, homeCurrency, rates);
        map[t.category_id] = (map[t.category_id] || 0) + converted;
      });
    return map;
  }, [transactions, rates, homeCurrency, ratesReady]);

  function startEdit(categoryId, existingAmount, existingCurrency) {
    setEditingCategoryId(categoryId);
    setEditAmount(existingAmount ?? '');
    setEditCurrency(existingCurrency || homeCurrency);
  }

  async function handleSave(categoryId) {
    setError('');
    try {
      await api.saveBudget(categoryId, month, editAmount, editCurrency);
      setEditingCategoryId('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(budgetId) {
    try {
      await api.deleteBudget(budgetId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const rows = [...categories]
    .sort((a, b) => {
      const aOther = a.name.toLowerCase() === 'other';
      const bOther = b.name.toLowerCase() === 'other';
      if (aOther && !bOther) return 1;
      if (bOther && !aOther) return -1;
      return a.name.localeCompare(b.name);
    })
    .map((c) => {
      const budget = budgets.find((b) => b.category_id === c.id);
      const spent = spendByCategory[c.id] || 0;
      const limit = budget && ratesReady ? convertAmount(Number(budget.amount), budget.currency, homeCurrency, rates) : null;
      const pct = limit ? Math.min((spent / limit) * 100, 100) : (limit === 0 && spent > 0 ? 100 : 0);
      const over = limit !== null && spent > limit;
      return { category: c, budget, spent, limit, pct, over };
    });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Budgets</h1>
        <p className="page-greeting">Set monthly limits per category and track your progress.</p>
      </div>
      <div className="card">
        <h3>Monthly budgets</h3>
        <p className="txn-meta">
          Set a spending limit per category for a given month. Limits keep their saved currency; limits and spending are converted to {homeCurrency} for comparison.
        </p>
        <div className="row">
          <label className="txn-meta">
            Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        </div>
        {error && <p className="error" style={{ marginTop: '0.6rem' }}>{error}</p>}
        {rates?.base === homeCurrency && !ratesReady && (
          <p className="error" role="alert">Exchange rates are unavailable for a saved currency. Budget comparisons cannot be displayed.</p>
        )}
      </div>

      {ratesReady && rows.map(({ category, budget, spent, limit, pct, over }) => (
        <div key={category.id} className="card">
          <div className="row between">
            <strong>{category.name}</strong>
            <span className="txn-meta">
              {formatMoney(spent, homeCurrency)}
              {limit !== null && ` / ${formatMoney(limit, homeCurrency)}`}
            </span>
          </div>

          {limit !== null && (
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: over ? 'linear-gradient(135deg, #ff6b6b, #ee5253)' : 'linear-gradient(135deg, #4ade9a, #2ed573)',
                }}
              />
            </div>
          )}
          {over && <p className="error" style={{ marginTop: '0.4rem' }}>Over budget</p>}

          <div className="row" style={{ marginTop: '0.75rem' }}>
            {editingCategoryId === category.id ? (
              <>
                <input
                  type="number" min="0" step="0.01" aria-label="Budget amount" placeholder="Budget amount" value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)} style={{ width: 140 }}
                />
                <select aria-label="Budget currency" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}>
                  {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <button className="btn-small" onClick={() => handleSave(category.id)}>Save</button>
                <button className="btn-small btn-secondary" onClick={() => setEditingCategoryId('')}>Cancel</button>
              </>
            ) : (
              <>
                <button className="btn-small btn-secondary" onClick={() => startEdit(category.id, budget?.amount, budget?.currency)}>
                  {limit !== null ? 'Edit budget' : 'Set budget'}
                </button>
                {budget && (
                  <button className="btn-small btn-danger" onClick={() => handleDelete(budget.id)}>Remove</button>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      {categories.length === 0 && (
        <div className="card">
          <p>No categories yet — add some on the Settings page first.</p>
        </div>
      )}
    </div>
  );
}
