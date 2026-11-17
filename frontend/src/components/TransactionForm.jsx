import { useRef, useState } from 'react';
import { api } from '../api.js';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';
import { localDate } from '../utils/finance.js';
import Modal from './Modal.jsx';

export default function TransactionForm({
  transaction,
  categories,
  homeCurrency,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    amount: transaction?.amount ?? '',
    currency: transaction?.currency || homeCurrency,
    type: transaction?.type || 'expense',
    categoryId: transaction?.category_id || '',
    note: transaction?.note || '',
    date: transaction?.transaction_date.slice(0, 10) || localDate(),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  function field(name) {
    return {
      value: form[name],
      onChange: (event) => setForm({ ...form, [name]: event.target.value }),
    };
  }
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, categoryId: form.categoryId || null };
      if (transaction) await api.updateTransaction(transaction.id, payload);
      else await api.createTransaction(payload);
      onSaved(transaction ? 'Transaction updated.' : 'Transaction added.');
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={transaction ? 'Edit transaction' : 'Add transaction'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-grid">
          <label>
            Amount
            <input
              autoFocus
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              placeholder="0.00"
              {...field('amount')}
            />
          </label>
          <label>
            Currency
            <select aria-label="Currency" {...field('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select aria-label="Type" {...field('type')}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            Category
            <select aria-label="Category" {...field('categoryId')}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" required {...field('date')} />
          </label>
          <label className="span-all">
            Note <span className="muted">(optional)</span>
            <input type="text" placeholder="What was this for?" {...field('note')} />
          </label>
        </fieldset>
        <p className="error" role={error ? 'alert' : undefined}>
          {error}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button disabled={busy}>{busy ? 'Saving…' : 'Save transaction'}</button>
        </div>
      </form>
    </Modal>
  );
}
