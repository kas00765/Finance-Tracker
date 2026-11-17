import { AlertCircle, ArrowRight, Inbox } from 'lucide-react';

export function Loading({ label = 'Loading your finances…' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="notice danger" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {onRetry && (
        <button className="btn-small btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export function RateNotice({ data, onRetry }) {
  if (data.canConvert) return null;
  return (
    <div className="notice warning" role="status">
      <AlertCircle size={18} />
      <span>
        {data.ratesLoading
          ? 'Updating exchange rates. Your transactions are ready to use.'
          : 'Currency conversion is unavailable. Your original transactions are still available; combined totals will return when rates are available.'}
      </span>
      <button className="btn-small btn-secondary" onClick={onRetry} disabled={data.ratesLoading}>
        Retry rates
      </button>
    </div>
  );
}

export function Stat({ label, value, detail, tone = '', icon: Icon }) {
  return (
    <div className={`card stat-card ${tone}`}>
      <div className="row between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon size={19} />}
      </div>
      <p className="stat-value">{value}</p>
      {detail && <p className="stat-detail">{detail}</p>}
    </div>
  );
}
