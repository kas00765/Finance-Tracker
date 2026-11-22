import { useRef, useState } from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import Modal from './Modal.jsx';
import { ErrorNotice } from './Feedback.jsx';
import { SUPPORTED_CURRENCIES, formatMoney } from '../utils/currency.js';
import {
  MAX_FILE_BYTES,
  parseImportFile,
  guessMapping,
  mapImportRows,
} from '../utils/csvImport.js';

const FIELDS = [
  ['date', 'Date'],
  ['amount', 'Amount'],
  ['type', 'Type'],
  ['currency', 'Currency'],
  ['category', 'Category'],
  ['note', 'Note'],
];
const PAGE_SIZE = 20;

export default function CsvImport({ homeCurrency, onClose, onImported }) {
  const [file, setFile] = useState(null),
    [filename, setFilename] = useState('');
  const [mapping, setMapping] = useState({}),
    [dateFormat, setDateFormat] = useState('iso');
  const [amountFormat, setAmountFormat] = useState('dot'),
    [defaultCurrency, setDefaultCurrency] = useState(homeCurrency);
  const [preview, setPreview] = useState(null),
    [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [result, setResult] = useState(null),
    [page, setPage] = useState(1);
  const pending = useRef(false);
  const heading = useRef(null);

  async function chooseFile(event) {
    const uploaded = event.target.files?.[0];
    if (!uploaded) return;
    setError('');
    setFile(null);
    setPreview(null);
    setFilename('');
    setBusy('file');
    try {
      if (!/\.(csv|tsv)$/i.test(uploaded.name)) throw new Error('Choose a CSV or TSV file.');
      if (uploaded.size > MAX_FILE_BYTES)
        throw new Error('File is too large. Choose a file smaller than 1 MB.');
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(await uploaded.arrayBuffer());
      } catch {
        throw new Error('Could not read this file as UTF-8. Save it as UTF-8 CSV and try again.');
      }
      const parsed = parseImportFile(text);
      setFile(parsed);
      setFilename(uploaded.name);
      setMapping(guessMapping(parsed.headers));
      setDateFormat('iso');
      setAmountFormat('dot');
      setSelected(new Set());
      setPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function review(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy('preview');
    setError('');
    try {
      const mapped = mapImportRows(file, mapping, { dateFormat, amountFormat, defaultCurrency });
      const valid = mapped.filter((row) => row.source);
      const response = valid.length
        ? await api.previewImport(valid.map((row) => row.source))
        : { rows: [] };
      let index = 0;
      const rows = mapped.map((row) => (row.source ? { ...row, ...response.rows[index++] } : row));
      setPreview(rows);
      setSelected(new Set(rows.filter((row) => row.status === 'ready').map((row) => row.record)));
      setPage(1);
      heading.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  async function save() {
    if (pending.current || !selected.size) return;
    pending.current = true;
    setBusy('save');
    setError('');
    try {
      const rows = preview
        .filter((row) => row.status === 'ready' && selected.has(row.record))
        .map((row) => row.source);
      const response = await api.importTransactions(rows);
      setResult(response);
      onImported();
      heading.current?.focus();
    } catch (err) {
      setError(
        err.status
          ? err.message
          : 'Import could not be confirmed. You can retry safely: matching transactions will be skipped.',
      );
    } finally {
      pending.current = false;
      setBusy('');
    }
  }

  function toggle(record) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(record)) next.delete(record);
      else next.add(record);
      return next;
    });
  }
  const ready = preview?.filter((row) => row.status === 'ready') || [];
  const pages = preview ? Math.ceil(preview.length / PAGE_SIZE) : 1;

  return (
    <Modal
      title="Import transactions"
      onClose={onClose}
      busy={Boolean(busy)}
      className="import-modal"
    >
      <div ref={heading} tabIndex={-1} className="import-step" role="status">
        {result
          ? 'Import complete'
          : preview
            ? 'Step 3 of 3 · Review and import'
            : file
              ? 'Step 2 of 3 · Match your columns'
              : 'Step 1 of 3 · Choose a file'}
      </div>
      {result ? (
        <div className="import-result">
          <CheckCircle2 size={36} />
          <h3>
            {result.imported} {result.imported === 1 ? 'transaction' : 'transactions'} imported
          </h3>
          <p>
            {result.skipped
              ? `${result.skipped} matching transactions were skipped.`
              : 'Your selected transactions have been saved.'}
          </p>
          <p className="muted">
            Records outside your current date range may not appear in the overview. Choose “All
            time” to see your full history.
          </p>
          <button onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          {!preview && (
            <>
              <label className="import-upload">
                <span>
                  <Upload size={18} />
                  {file ? 'Choose a different file' : 'Select CSV or TSV'}
                </span>
                <input
                  type="file"
                  aria-label="CSV file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  disabled={Boolean(busy)}
                  onChange={chooseFile}
                />
              </label>
              <p className="muted small">
                UTF-8 · Up to 1 MB and 500 records · First row must contain column headings. Commas,
                semicolons, and tabs are supported.
              </p>
            </>
          )}
          {file && !preview && (
            <form onSubmit={review}>
              <p className="import-file">
                <strong>{filename}</strong>
                <span className="muted">{file.rows.length} records found</span>
              </p>
              <fieldset disabled={Boolean(busy)} className="import-mapping">
                {FIELDS.map(([field, label]) => (
                  <label key={field}>
                    {label} column
                    <select
                      aria-label={`${label} column`}
                      required={['date', 'amount'].includes(field)}
                      value={mapping[field]}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    >
                      {field === 'type' ? (
                        <>
                          <option value="__signed">
                            From sign: positive = income, negative = expense
                          </option>
                          <option value="__expense">Treat every row as an expense</option>
                          <option value="__income">Treat every row as income</option>
                        </>
                      ) : (
                        <option value="">
                          {field === 'currency'
                            ? 'Use default currency'
                            : ['date', 'amount'].includes(field)
                              ? 'Choose a column'
                              : `Ignore ${field}`}
                        </option>
                      )}
                      {file.headers.map((header, index) => (
                        <option key={index} value={index}>
                          {header || 'Unnamed'} (column {index + 1})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label>
                  Date format
                  <select
                    aria-label="Date format"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                  >
                    <option value="iso">YYYY-MM-DD</option>
                    <option value="dmy">DD/MM/YYYY</option>
                    <option value="mdy">MM/DD/YYYY</option>
                  </select>
                </label>
                <label>
                  Amount format
                  <select
                    aria-label="Amount format"
                    value={amountFormat}
                    onChange={(e) => setAmountFormat(e.target.value)}
                  >
                    <option value="dot">1,234.56 · decimal point</option>
                    <option value="comma">1.234,56 · decimal comma</option>
                  </select>
                </label>
                <label>
                  Default currency
                  <select
                    aria-label="Default currency"
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
              <p className="muted small">
                Default currency fills empty or unmapped currency values. Categories must already
                exist in Settings; ignoring the category column imports rows as uncategorized.
              </p>
              <details className="import-sample">
                <summary>View first 3 source records</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {file.headers.map((header, index) => (
                          <th key={index}>{header || `Column ${index + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {file.rows.slice(0, 3).map((row, index) => (
                        <tr key={index}>
                          {row.map((value, column) => (
                            <td key={column}>{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <ErrorNotice message={error} />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={Boolean(busy)}
                >
                  Cancel
                </button>
                <button disabled={Boolean(busy)}>
                  {busy === 'preview' ? 'Checking records…' : 'Preview import'}
                </button>
              </div>
            </form>
          )}
          {preview && (
            <>
              <div className="import-counts">
                <span className="badge positive">{ready.length} ready</span>
                <span className="badge warning">
                  {preview.filter((r) => r.status === 'duplicate').length} duplicate(s)
                </span>
                <span className="badge danger">
                  {preview.filter((r) => r.status === 'invalid').length} invalid
                </span>
              </div>
              <p className="muted small">
                Only checked records will be imported. Duplicates match date, amount, currency,
                type, category, and note exactly. Identical legitimate transactions can be added
                manually.
              </p>
              <label className="import-select-all">
                <input
                  type="checkbox"
                  checked={ready.length > 0 && selected.size === ready.length}
                  disabled={Boolean(busy) || !ready.length}
                  onChange={(e) =>
                    setSelected(new Set(e.target.checked ? ready.map((r) => r.record) : []))
                  }
                />
                Select all ready records ({selected.size} selected)
              </label>
              <div className="import-preview-list">
                {preview.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => (
                  <div key={row.record} className="import-preview-row">
                    <input
                      type="checkbox"
                      aria-label={`Import record ${row.record}`}
                      disabled={Boolean(busy) || row.status !== 'ready'}
                      checked={selected.has(row.record)}
                      onChange={() => toggle(row.record)}
                    />
                    <div>
                      <div className="row between">
                        <strong>Record {row.record}</strong>
                        <span
                          className={`badge ${row.status === 'ready' ? 'positive' : row.status === 'duplicate' ? 'warning' : 'danger'}`}
                        >
                          {row.status === 'ready'
                            ? 'Ready'
                            : row.status === 'duplicate'
                              ? 'Duplicate'
                              : 'Invalid'}
                        </span>
                      </div>
                      {row.source && (
                        <p className="import-record-detail">
                          {row.source.date} · {row.source.type} ·{' '}
                          {formatMoney(Number(row.source.amount), row.source.currency)} ·{' '}
                          {row.transaction?.categoryName || row.source.category || 'Uncategorized'}
                        </p>
                      )}
                      {row.source?.note && (
                        <p className="muted small import-note">{row.source.note}</p>
                      )}
                      {row.error && (
                        <p className={row.status === 'invalid' ? 'error' : 'muted small'}>
                          {row.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {pages > 1 && (
                <div className="pagination">
                  <span>
                    Page {page} of {pages}
                  </span>
                  <div className="row">
                    <button
                      className="btn-secondary btn-small"
                      disabled={page === 1 || Boolean(busy)}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous records
                    </button>
                    <button
                      className="btn-secondary btn-small"
                      disabled={page === pages || Boolean(busy)}
                      onClick={() => setPage(page + 1)}
                    >
                      Next records
                    </button>
                  </div>
                </div>
              )}
              <ErrorNotice message={error} />
              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setPreview(null);
                    setError('');
                  }}
                >
                  Back to mapping
                </button>
                <button disabled={Boolean(busy) || selected.size === 0} onClick={save}>
                  {busy === 'save' ? 'Importing…' : `Import ${selected.size} selected`}
                </button>
              </div>
            </>
          )}
          {!file && <ErrorNotice message={error} />}
        </>
      )}
    </Modal>
  );
}
