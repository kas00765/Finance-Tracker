import { lazy, Suspense, useMemo, useState } from 'react';
import { Download, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { useFinanceData } from '../hooks/useFinanceData.js';
import { formatMoney } from '../utils/currency.js';
import { summarize, displayDate } from '../utils/finance.js';
import { getRangeDates } from '../utils/dateRange.js';
import { downloadTransactions } from '../utils/csv.js';
import { EmptyState, ErrorNotice, Loading, RateNotice, Stat } from '../components/Feedback.jsx';

const BalanceChart = lazy(() =>
  import('../components/FinanceCharts.jsx').then((module) => ({ default: module.BalanceChart })),
);

export default function Reports() {
  const [applied, setApplied] = useState(() => getRangeDates('this-month'));
  const [draft, setDraft] = useState(() => ({ ...getRangeDates('this-month'), category: '' }));
  const [filterError, setFilterError] = useState('');
  const { data, loading, error, reload, retryRates, homeCurrency } = useFinanceData(applied);
  const summary = useMemo(() => (data?.canConvert ? summarize(data.transactions) : null), [data]);
  const money = (value) => formatMoney(value, homeCurrency);
  function apply(event) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError('The end date must be on or after the start date.');
      return;
    }
    setFilterError('');
    setApplied(Object.fromEntries(Object.entries(draft).filter(([, value]) => value)));
  }
  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">UNDERSTAND THE BIGGER PICTURE</p>
          <h1>Reports</h1>
          <p className="page-greeting">Turn your transaction history into a clearer picture.</p>
        </div>
        <button
          className="btn-secondary"
          disabled={!data?.transactions.length}
          onClick={() => downloadTransactions(data.transactions, 'finance-guard-report.csv')}
        >
          <Download size={17} />
          Export report
        </button>
      </header>
      <section className="card">
        <form className="report-filters" onSubmit={apply}>
          <label>
            From
            <input
              type="date"
              value={draft.from || ''}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draft.to || ''}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              aria-label="Category"
              value={draft.category || ''}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <option value="">All categories</option>
              {data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button>Apply filters</button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setDraft({ from: '', to: '', category: '' });
              setApplied({});
              setFilterError('');
            }}
          >
            Reset
          </button>
        </form>
        <ErrorNotice message={filterError} />
      </section>
      {loading && <Loading label="Preparing your report…" />}
      <ErrorNotice message={error} onRetry={reload} />
      {data && (
        <>
          <p className="report-scope muted">
            {applied.from ? displayDate(applied.from) : 'Beginning of history'} —{' '}
            {applied.to ? displayDate(applied.to) : 'Latest transaction'} ·{' '}
            {data.transactions.length} transactions
            {applied.category
              ? ` · ${data.categories.find((c) => String(c.id) === applied.category)?.name || 'Selected category'}`
              : ''}
          </p>
          <RateNotice data={data} onRetry={retryRates} />
          {!data.transactions.length ? (
            <section className="card">
              <EmptyState
                title="Nothing in this range"
                description="Try a wider date range or another category to see your report."
              />
            </section>
          ) : (
            summary && (
              <>
                <div className="stat-grid three">
                  <Stat
                    label="Income"
                    value={money(summary.income)}
                    icon={ArrowDownLeft}
                    tone="positive"
                  />
                  <Stat label="Expenses" value={money(summary.expense)} icon={ArrowUpRight} />
                  <Stat
                    label="Net cash flow"
                    value={money(summary.net)}
                    icon={Wallet}
                    tone="featured"
                  />
                </div>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Net cash flow over time</h2>
                      <p className="muted">
                        Cumulative income minus expenses, starting at zero for this selection.
                      </p>
                    </div>
                    <span className="badge">{homeCurrency}</span>
                  </div>
                  <Suspense fallback={<Loading label="Loading chart…" />}>
                    <BalanceChart data={summary.runningBalance} currency={homeCurrency} />
                  </Suspense>
                </section>
                <section className="card">
                  <div className="section-heading">
                    <h2>Category breakdown</h2>
                    <span className="muted small">Amounts in {homeCurrency}</span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Income, expenses, and net cash flow by category
                      </caption>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Income</th>
                          <th>Expenses</th>
                          <th>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.categories.map((row) => (
                          <tr key={row.category}>
                            <th scope="row">{row.category}</th>
                            <td className="positive">{money(row.income)}</td>
                            <td>{money(row.expense)}</td>
                            <td>{money(row.income - row.expense)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          <td>{money(summary.income)}</td>
                          <td>{money(summary.expense)}</td>
                          <td>{money(summary.net)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              </>
            )
          )}
          <p className="footnote">
            CSV exports preserve original amounts and currencies.{' '}
            {data.rates?.date
              ? `Charts use exchange rates from ${displayDate(data.rates.date)}, not historical transaction-date rates.`
              : 'Same-currency totals do not require exchange rates.'}
          </p>
        </>
      )}
    </div>
  );
}
