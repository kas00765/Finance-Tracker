import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Plus,
  Search,
  Wallet,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api.js';
import { useFinanceData } from '../hooks/useFinanceData.js';
import { formatMoney } from '../utils/currency.js';
import { RANGE_OPTIONS, getRangeDates, rangeLabel } from '../utils/dateRange.js';
import { displayDate, filterTransactions, summarize } from '../utils/finance.js';
import { downloadTransactions } from '../utils/csv.js';
import { EmptyState, ErrorNotice, Loading, RateNotice, Stat } from '../components/Feedback.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';

const CashflowChart = lazy(() =>
  import('../components/FinanceCharts.jsx').then((module) => ({ default: module.CashflowChart })),
);
const PAGE_SIZE = 10;

export default function Dashboard() {
  const [range, setRange] = useState('this-month');
  const dates = getRangeDates(range);
  const params = Object.fromEntries(Object.entries(dates).filter(([, value]) => value));
  const { data, loading, error, reload, retryRates, homeCurrency } = useFinanceData(params);
  const [filters, setFilters] = useState({ search: '', type: '', category: '', sort: 'date-desc' });
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(''),
    [message, setMessage] = useState('');
  const pending = useRef(false);
  const summary = useMemo(() => (data?.canConvert ? summarize(data.transactions) : null), [data]);
  const biggestExpense = data?.canConvert
    ? data.transactions
        .filter((t) => t.type === 'expense')
        .reduce(
          (biggest, t) => (!biggest || t.convertedAmount > biggest.convertedAmount ? t : biggest),
          null,
        )
    : null;
  const visible = useMemo(
    () =>
      filterTransactions(data?.transactions || [], {
        ...filters,
        sort: !data?.canConvert && filters.sort.startsWith('amount') ? 'date-desc' : filters.sort,
      }),
    [data, filters],
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  function filter(name, value) {
    setFilters({ ...filters, [name]: value });
    setPage(1);
  }
  function saved(text) {
    setEditor(null);
    setMessage(text);
    reload();
  }
  async function remove() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError('');
    try {
      await api.deleteTransaction(deleting.id);
      setDeleting(null);
      setMessage('Transaction deleted.');
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const money = (value) => formatMoney(value, homeCurrency);

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUR MONEY, AT A GLANCE</p>
          <h1>Overview</h1>
          <p className="page-greeting">A little clarity for every financial decision.</p>
        </div>
        <div className="row">
          <label className="sr-only" htmlFor="overview-range">
            Date range
          </label>
          <select
            id="overview-range"
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              setPage(1);
            }}
          >
            {RANGE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setMessage('');
              setEditor({});
            }}
            disabled={!data}
          >
            <Plus size={17} />
            Add transaction
          </button>
        </div>
      </header>
      {message && (
        <div className="notice positive" role="status">
          {message}
          <button className="text-button" onClick={() => setMessage('')}>
            Dismiss
          </button>
        </div>
      )}
      {loading && <Loading />}
      <ErrorNotice message={error} onRetry={reload} />
      {data && (
        <>
          <RateNotice data={data} onRetry={retryRates} />
          <div className="stat-grid">
            <Stat
              label="Net cash flow"
              value={money(summary?.net)}
              detail={rangeLabel(range)}
              tone="featured"
              icon={Wallet}
            />
            <Stat
              label="Income"
              value={money(summary?.income)}
              detail="Money coming in"
              tone="positive"
              icon={ArrowDownLeft}
            />
            <Stat
              label="Expenses"
              value={money(summary?.expense)}
              detail="Money going out"
              icon={ArrowUpRight}
            />
            <Stat
              label="Savings rate"
              value={summary?.savingsRate == null ? '—' : `${summary.savingsRate.toFixed(1)}%`}
              detail="Share of income retained"
              icon={PiggyBank}
            />
          </div>
          {summary && data.transactions.length > 0 && (
            <div className="overview-charts">
              <section className="card">
                <div className="section-heading">
                  <div>
                    <h2>Cash flow</h2>
                    <p className="muted">Income and expenses by month</p>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="income-dot" />
                      Income
                    </span>
                    <span>
                      <i className="expense-dot" />
                      Expenses
                    </span>
                  </div>
                </div>
                <Suspense fallback={<Loading label="Loading chart…" />}>
                  <CashflowChart data={summary.months} currency={homeCurrency} />
                </Suspense>
              </section>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <h2>Where it goes</h2>
                    <p className="muted">Your largest spending categories</p>
                  </div>
                  <span className="badge">{homeCurrency}</span>
                </div>
                {summary.expense === 0 ? (
                  <EmptyState
                    title="No expenses yet"
                    description="Your spending breakdown will appear here."
                  />
                ) : (
                  <div className="category-breakdown">
                    {summary.categories
                      .filter((c) => c.expense > 0)
                      .slice(0, 5)
                      .map((c, index) => (
                        <div key={c.category}>
                          <div className="row between">
                            <span>
                              <span className="category-number">0{index + 1}</span>
                              {c.category}
                            </span>
                            <strong>{money(c.expense)}</strong>
                          </div>
                          <div className="mini-track">
                            <span style={{ width: `${(c.expense / summary.expense) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    <p className="muted small">
                      Largest category: {summary.categories[0].category} ·{' '}
                      {((summary.categories[0].expense / summary.expense) * 100).toFixed(0)}% of
                      expenses
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
          {summary && data.transactions.length > 0 && (
            <div className="insights-strip">
              <p>
                <span className="muted">Average monthly spending</span>
                <strong>{money(summary.expense / summary.months.length)}</strong>
                <small className="muted">
                  Across {summary.months.length} recorded{' '}
                  {summary.months.length === 1 ? 'month' : 'months'}
                </small>
              </p>
              <p>
                <span className="muted">Largest expense</span>
                <strong>{biggestExpense ? money(biggestExpense.convertedAmount) : '—'}</strong>
                <small className="muted">
                  {biggestExpense?.note ||
                    biggestExpense?.category_name ||
                    'No expenses in this range'}
                </small>
              </p>
            </div>
          )}
          <section className="card transaction-section">
            <div className="section-heading">
              <div>
                <h2>
                  Transactions <span className="count">{data.transactions.length}</span>
                </h2>
                <p className="muted">
                  {rangeLabel(range)} · amounts shown in their original currency
                </p>
              </div>
              <button
                className="btn-secondary btn-small"
                disabled={!visible.length}
                onClick={() => downloadTransactions(visible)}
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
            <div className="transaction-filters">
              <label className="search-field">
                <span className="sr-only">Search transactions</span>
                <Search size={17} />
                <input
                  placeholder="Search notes, categories, currency…"
                  value={filters.search}
                  onChange={(e) => filter('search', e.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">Transaction type</span>
                <select
                  aria-label="Transaction type"
                  value={filters.type}
                  onChange={(e) => filter('type', e.target.value)}
                >
                  <option value="">All types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filter category</span>
                <select
                  aria-label="Filter category"
                  value={filters.category}
                  onChange={(e) => filter('category', e.target.value)}
                >
                  <option value="">All categories</option>
                  <option value="uncategorized">Uncategorized</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Sort transactions</span>
                <select
                  aria-label="Sort transactions"
                  value={
                    !data.canConvert && filters.sort.startsWith('amount')
                      ? 'date-desc'
                      : filters.sort
                  }
                  onChange={(e) => filter('sort', e.target.value)}
                >
                  <option value="date-desc">Newest first</option>
                  <option value="date-asc">Oldest first</option>
                  <option value="amount-desc" disabled={!data.canConvert}>
                    Amount: high to low
                  </option>
                  <option value="amount-asc" disabled={!data.canConvert}>
                    Amount: low to high
                  </option>
                </select>
              </label>
            </div>
            {data.transactions.length === 0 ? (
              <EmptyState
                title="A fresh start"
                description="No transactions in this date range. Add one or choose a different range."
                action="Add your first transaction"
                onAction={() => setEditor({})}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                title="No matches"
                description="Try another search or clear your filters."
                action="Clear filters"
                onAction={() => {
                  setFilters({ search: '', type: '', category: '', sort: 'date-desc' });
                  setPage(1);
                }}
              />
            ) : (
              <>
                <div className="transaction-head">
                  <span>Transaction</span>
                  <span>Amount</span>
                  <span>Actions</span>
                </div>
                {visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((t) => (
                  <article className="transaction-row" key={t.id}>
                    <div className="transaction-info">
                      <span className={`transaction-icon ${t.type === 'income' ? 'positive' : ''}`}>
                        {t.type === 'income' ? (
                          <ArrowDownLeft size={19} />
                        ) : (
                          <ArrowUpRight size={19} />
                        )}
                      </span>
                      <div>
                        <strong>{t.note || t.category_name || 'Uncategorized'}</strong>
                        <div className="transaction-meta">
                          {t.category_name || 'Uncategorized'}
                          <span>·</span>
                          {displayDate(t.transaction_date)}
                          <span>·</span>
                          {t.type === 'income' ? 'Income' : 'Expense'}
                        </div>
                      </div>
                    </div>
                    <div className={`transaction-amount ${t.type === 'income' ? 'positive' : ''}`}>
                      <strong>
                        {t.type === 'income' ? '+' : '−'}
                        {formatMoney(Number(t.amount), t.currency)}
                      </strong>
                      {t.currency !== homeCurrency && t.convertedAmount !== null && (
                        <small>≈ {money(t.convertedAmount)}</small>
                      )}
                    </div>
                    <div className="transaction-actions">
                      <button
                        className="text-button"
                        aria-label={`Edit ${t.note || t.category_name || 'transaction'}`}
                        onClick={() => setEditor({ transaction: t })}
                      >
                        Edit
                      </button>
                      <button
                        className="text-button danger"
                        aria-label={`Delete ${t.note || t.category_name || 'transaction'}`}
                        onClick={() => {
                          setDeleting(t);
                          setActionError('');
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                <div className="pagination">
                  <span>
                    {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, visible.length)} of {visible.length}{' '}
                    transactions
                  </span>
                  <div className="row">
                    <button
                      className="btn-icon"
                      aria-label="Previous page"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      Page {currentPage} of {pages}
                    </span>
                    <button
                      className="btn-icon"
                      aria-label="Next page"
                      disabled={currentPage === pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          {data.rates?.date && (
            <p className="footnote">
              Converted amounts use exchange rates from {displayDate(data.rates.date)}. Totals cover
              the selected date range.
            </p>
          )}
        </>
      )}
      {editor && data && (
        <TransactionForm
          transaction={editor.transaction}
          categories={data.categories}
          homeCurrency={homeCurrency}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete transaction?"
          description={`This will permanently remove ${deleting.note || deleting.category_name || 'this transaction'} (${formatMoney(Number(deleting.amount), deleting.currency)}).`}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
          busy={busy}
          error={actionError}
        />
      )}
    </div>
  );
}
