import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';

export default function Settings() {
  const { homeCurrency, setHomeCurrency } = useAuth();
  const [selectedCurrency, setSelectedCurrency] = useState(homeCurrency);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMsg, setCurrencyMsg] = useState('');
  const [error, setError] = useState('');

  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    setSelectedCurrency(homeCurrency);
  }, [homeCurrency]);

  async function loadCategories() {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleSaveCurrency(e) {
    e.preventDefault();
    setError('');
    setCurrencyMsg('');
    setSavingCurrency(true);
    try {
      await api.updateHomeCurrency(selectedCurrency);
      setHomeCurrency(selectedCurrency);
      setCurrencyMsg('Home currency updated. Dashboard and reports now convert into ' + selectedCurrency + '.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCurrency(false);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    setError('');
    if (!newCategory.trim()) return;
    try {
      await api.createCategory(newCategory.trim());
      setNewCategory('');
      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCategory(id) {
    try {
      await api.deleteCategory(id);
      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Home currency</h3>
        <p className="txn-meta">
          All totals and charts on your Dashboard and Reports pages are converted into this currency using live exchange rates.
        </p>
        <form onSubmit={handleSaveCurrency} className="row">
          <select value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
          <button type="submit" disabled={savingCurrency}>
            {savingCurrency ? 'Saving…' : 'Save'}
          </button>
        </form>
        {currencyMsg && <p className="success" style={{ marginTop: '0.6rem' }}>{currencyMsg}</p>}
      </div>

      <div className="card">
        <h3>Categories</h3>
        <form onSubmit={handleAddCategory} className="row" style={{ marginBottom: '0.75rem' }}>
          <input
            type="text" placeholder="New category name" value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
        {categories.map((c) => (
          <div key={c.id} className="txn-row">
            <span>{c.name}{c.is_default && <span className="txn-meta"> · default</span>}</span>
            <button onClick={() => handleDeleteCategory(c.id)} className="btn-danger">Delete</button>
          </div>
        ))}
        {error && <p className="error" style={{ marginTop: '0.6rem' }}>{error}</p>}
      </div>
    </div>
  );
}
