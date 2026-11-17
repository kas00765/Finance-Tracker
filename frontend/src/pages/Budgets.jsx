import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Wallet, AlertCircle, Plus } from 'lucide-react';
import { api } from '../api.js';
import { useFinanceData } from '../hooks/useFinanceData.js';
import { SUPPORTED_CURRENCIES, convertAmount, formatMoney } from '../utils/currency.js';
import { budgetStatus, localDate, monthRange } from '../utils/finance.js';
import { EmptyState, ErrorNotice, Loading, RateNotice, Stat } from '../components/Feedback.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';

export default function Budgets() {
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const { data, loading, error, reload, retryRates, homeCurrency } = useFinanceData(
    monthRange(month),
    month,
  );
  const [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null);
  const [amount, setAmount] = useState(''),
    [currency, setCurrency] = useState(homeCurrency);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(''),
    [message, setMessage] = useState('');
  const pending = useRef(false);
  const money = (value) => formatMoney(value, homeCurrency);
  const spentByCategory = new Map();
  if (data?.canConvert)
    for (const t of data.transactions) {
      if (t.type === 'expense')
        spentByCategory.set(
          t.category_id,
          (spentByCategory.get(t.category_id) || 0) + t.convertedAmount,
        );
    }
  const rows = (data?.categories || [])
    .map((category) => {
      const budget = data.budgets.find((b) => b.category_id === category.id);
      const spent = spentByCategory.get(category.id) || 0;
      const limit =
        budget && data.canConvert
          ? convertAmount(Number(budget.amount), budget.currency, homeCurrency, data.rates)
          : null;
      return { category, budget, spent, limit, status: budgetStatus(spent, limit) };
    })
    .sort(
      (a, b) =>
        Number(Boolean(b.budget)) - Number(Boolean(a.budget)) ||
        a.category.name.localeCompare(b.category.name),
    );
  const planned = rows.reduce((sum, row) => sum + (row.limit || 0), 0);
  const trackedSpending = rows.filter((row) => row.budget).reduce((sum, row) => sum + row.spent, 0);
  const totalSpending = [...spentByCategory.values()].reduce((sum, value) => sum + value, 0);
  const attention = rows.filter(
    (row) => row.budget && ['warning', 'danger'].includes(row.status.tone),
  ).length;
  function edit(row) {
    setEditor(row);
    setAmount(row.budget?.amount ?? '');
    setCurrency(row.budget?.currency || homeCurrency);
    setActionError('');
  }
  async function mutate(action, success) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError('');
    try {
      await action();
      setEditor(null);
      setDeleting(null);
      setMessage(success);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
          <h1>Budgets</h1>
          <p className="page-greeting">Set a plan. See what's left. Stay in control.</p>
        </div>
        <label className="month-control">
          Budget month
          <input
            type="month"
            aria-label="Budget month"
            value={month}
            onChange={(e) => {
              if (monthRange(e.target.value)) {
                setMonth(e.target.value);
                setMessage('');
              }
            }}
          />
        </label>
      </header>
      {message && (
        <p className="notice positive" role="status">
          {message}
        </p>
      )}
      {loading && <Loading label="Loading your budgets…" />}
      <ErrorNotice message={error} onRetry={reload} />
      {data && (
        <>
          <RateNotice data={data} onRetry={retryRates} />
          <div className="stat-grid three">
            <Stat
              label="Total planned"
              value={data.canConvert ? money(planned) : '—'}
              detail={`${data.budgets.length} category limits`}
              icon={Target}
            />
            <Stat
              label="Remaining in plan"
              value={data.canConvert ? money(planned - trackedSpending) : '—'}
              detail="Across categories with a budget"
              tone="featured"
              icon={Wallet}
            />
            <Stat
              label="Needs attention"
              value={data.canConvert ? String(attention) : '—'}
              detail="Categories at 80% or above"
              icon={AlertCircle}
            />
          </div>
          {data.canConvert && totalSpending > trackedSpending && (
            <div className="notice warning">
              <AlertCircle size={18} />
              <span>
                {money(totalSpending - trackedSpending)} spent outside your budgeted categories. Add
                limits below to include those expenses in your plan.
              </span>
            </div>
          )}
          <div className="section-heading">
            <h2>Category budgets</h2>
            <span className="muted small">Comparisons in {homeCurrency}</span>
          </div>
          {!rows.length ? (
            <EmptyState
              title="Start with a category"
              description="Add categories in Settings, then set a monthly limit for each."
            />
          ) : (
            <div className="budget-grid">
              {rows.map((row) => (
                <section className="card budget-card" key={row.category.id}>
                  <div className="section-heading">
                    <h3>{row.category.name}</h3>
                    <span className={`badge ${data.canConvert ? row.status.tone : 'muted'}`}>
                      {data.canConvert ? row.status.label : 'Rates unavailable'}
                    </span>
                  </div>
                  <p className="budget-spent">
                    {data.canConvert ? money(row.spent) : '—'}{' '}
                    <span className="muted small">spent</span>
                  </p>
                  <p className="muted small">
                    {row.budget
                      ? `of ${formatMoney(Number(row.budget.amount), row.budget.currency)} planned${row.budget.currency !== homeCurrency && data.canConvert ? ` (≈ ${money(row.limit)})` : ''}`
                      : 'No monthly limit set'}
                  </p>
                  {row.budget && data.canConvert && (
                    <>
                      <div
                        className={`progress-bar ${row.status.tone}`}
                        role="progressbar"
                        aria-label={`${row.category.name} budget used`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(row.status.percent)}
                        aria-valuetext={`${money(row.spent)} spent of ${money(row.limit)}`}
                      >
                        <span style={{ width: `${row.status.percent}%` }} />
                      </div>
                      <p className={`small ${row.status.tone}`}>
                        {row.status.remaining < 0
                          ? `${money(-row.status.remaining)} over your limit`
                          : `${money(row.status.remaining)} left to spend`}
                      </p>
                    </>
                  )}
                  <div className="budget-actions">
                    <button className="btn-secondary btn-small" onClick={() => edit(row)}>
                      {row.budget ? (
                        'Edit budget'
                      ) : (
                        <>
                          <Plus size={15} />
                          Set budget
                        </>
                      )}
                    </button>
                    {row.budget && (
                      <button
                        className="text-button danger"
                        aria-label={`Remove ${row.category.name} budget`}
                        onClick={() => {
                          setDeleting(row);
                          setActionError('');
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
          <p className="footnote">
            Need another category? <Link to="/settings">Manage categories</Link>. Saved limits keep
            their original currency when your home currency changes.
          </p>
        </>
      )}
      {editor && (
        <Modal
          title={`${editor.budget ? 'Edit' : 'Set'} ${editor.category.name} budget`}
          onClose={() => setEditor(null)}
          busy={busy}
        >
          <p className="muted">Monthly spending limit for {month}.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                () => api.saveBudget(editor.category.id, month, amount, currency),
                'Budget saved.',
              );
            }}
          >
            <fieldset className="form-grid" disabled={busy}>
              <label>
                Budget amount
                <input
                  autoFocus
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Budget currency
                <select
                  aria-label="Budget currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <ErrorNotice message={actionError} />
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button disabled={busy}>{busy ? 'Saving…' : 'Save budget'}</button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Remove ${deleting.category.name} budget?`}
          description="This removes the monthly limit. Your transactions will stay in place."
          onClose={() => setDeleting(null)}
          onConfirm={() => mutate(() => api.deleteBudget(deleting.budget.id), 'Budget removed.')}
          busy={busy}
          error={actionError}
        />
      )}
    </div>
  );
}
