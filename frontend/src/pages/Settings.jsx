import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';
import { EmptyState, ErrorNotice, Loading } from '../components/Feedback.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';

export default function Settings() {
  const { homeCurrency, setHomeCurrency } = useAuth();
  const [selectedCurrency, setSelectedCurrency] = useState(homeCurrency);
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [newCategory, setNewCategory] = useState(''),
    [deleting, setDeleting] = useState(null);
  const pending = useRef(false);
  const categories = useResource('categories', () => api.getCategories());
  useEffect(() => {
    setSelectedCurrency(homeCurrency);
  }, [homeCurrency]);
  async function save(action, work, success) {
    if (pending.current) return;
    pending.current = true;
    setBusy(action);
    setMessage('');
    setError('');
    try {
      await work();
      setMessage(success);
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy('');
    }
  }
  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>Settings</h1>
          <p className="page-greeting">Your preferences, your way of organizing money.</p>
        </div>
      </header>
      {message && (
        <p className="notice positive" role="status">
          {message}
        </p>
      )}
      {!deleting && <ErrorNotice message={error} />}
      <div className="settings-grid">
        <section className="card">
          <h2>Home currency</h2>
          <p className="muted" style={{ marginTop: 12 }}>
            Choose the currency used for summaries and charts. Transactions and budgets retain their
            original currencies.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(
                'currency',
                async () => {
                  await api.updateHomeCurrency(selectedCurrency);
                  setHomeCurrency(selectedCurrency);
                },
                'Home currency updated.',
              );
            }}
          >
            <label>
              Display currency
              <select
                aria-label="Display currency"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                disabled={Boolean(busy)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              style={{ marginTop: 18 }}
              disabled={Boolean(busy) || selectedCurrency === homeCurrency}
            >
              {busy === 'currency' ? 'Saving…' : 'Save currency'}
            </button>
          </form>
        </section>
        <section className="card">
          <h2>Categories</h2>
          <p className="muted" style={{ marginTop: 12 }}>
            Organize transactions around the things you spend on.
          </p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              save(
                'category',
                async () => {
                  await api.createCategory(newCategory.trim());
                  setNewCategory('');
                  categories.reload();
                },
                'Category added.',
              );
            }}
          >
            <label className="sr-only" htmlFor="new-category">
              New category name
            </label>
            <input
              id="new-category"
              placeholder="e.g. Health & wellness"
              value={newCategory}
              maxLength={100}
              required
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={Boolean(busy)}
            />
            <button disabled={Boolean(busy) || !newCategory.trim()}>
              {busy === 'category' ? 'Adding…' : 'Add category'}
            </button>
          </form>
          {categories.loading && <Loading label="Loading categories…" />}
          <ErrorNotice message={categories.error} onRetry={categories.reload} />
          {categories.data?.length === 0 && (
            <EmptyState title="Your own categories" description="Add your first category above." />
          )}
          {categories.data?.map((c) => (
            <div className="category-row" key={c.id}>
              <span>{c.name}</span>
              <button
                className="text-button danger"
                disabled={Boolean(busy)}
                aria-label={`Delete ${c.name} category`}
                onClick={() => {
                  setDeleting(c);
                  setError('');
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      </div>
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          description="Transactions in this category will become uncategorized. Budgets for this category will also be removed."
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            save(
              'delete',
              async () => {
                await api.deleteCategory(deleting.id);
                setDeleting(null);
                categories.reload();
              },
              'Category deleted.',
            )
          }
          busy={Boolean(busy)}
          error={error}
        />
      )}
    </div>
  );
}
