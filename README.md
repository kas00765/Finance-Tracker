# Finance Guard

A full-stack app to log income/expenses, categorize them, and see spending trends.

**Stack:** React (Vite) · Node/Express · PostgreSQL · JWT auth

## Project structure
```
finance-tracker/
  backend/     Express API (auth, transactions, categories)
  frontend/    React app (Vite)
```

## Setup

### 1. Database
Create a Postgres database, then run the schema:
```bash
createdb finance_tracker
psql -d finance_tracker -f backend/db/schema.sql
psql -d finance_tracker -f backend/db/migration_integrity.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # then edit DATABASE_URL and JWT_SECRET
npm run dev
```
Runs on http://localhost:4000

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173 and proxies `/api` calls to the backend.

## What's built
- [x] Auth: signup/login with JWT, bcrypt password hashing
- [x] Transactions: labeled add/edit dialogs with currency selection, pending states, and confirmation before deletion
- [x] Categories: default categories seeded on signup, custom categories (add/delete on the Settings page)
- [x] Overview: net cash flow, income, expenses, savings rate, average monthly spending, largest expense, monthly cash-flow chart, and category breakdown
- [x] Transaction search, type/category filters, sorting by date or converted amount, and 10-row client-side pagination
- [x] CSV import with column mapping, validation preview, record selection, and duplicate detection
- [x] CSV exports of filtered transactions and reports, preserving original amounts/currencies and escaping spreadsheet formulas in notes/category names
- [x] Budgets: saved currencies, remaining amounts, near-limit/over-budget warnings, and spending outside budgeted categories
- [x] Reports: applied date/category filters, daily cumulative net cash flow, category totals, and CSV export
- [x] Settings page: choose your home currency; live rates fetched from the Frankfurter API
- [x] Responsive dark/light layouts, keyboard focus, accessible labels/dialogs, and loading/error/empty states
- [x] Lazy-loaded routes/charts, deduplicated exchange-rate requests with a five-minute cache, and protection against stale responses

Exchange-rate failures do not block original transactions or same-currency summaries. Mixed-currency combined totals are hidden until valid rates are available. Charts use the latest available rates, not historical transaction-date rates. Transaction dates are calendar strings (`YYYY-MM-DD`) on the API and use the local calendar for defaults.

Pagination currently limits rendered rows, not database queries; all records in the selected range are fetched. Large-scale server pagination remains future work.

## Importing transactions

Choose **Import CSV** on the Overview page. Select a UTF-8 CSV or TSV file (up to 1 MB and 500 records, with a header row), map its columns, then preview and select the records to save. Comma, semicolon, and tab delimiters are supported, including quoted and multiline notes. The original file stays in your browser; only mapped transaction fields are sent to the API.

- Date and amount columns are required. Choose `YYYY-MM-DD`, `DD/MM/YYYY`, or `MM/DD/YYYY` explicitly, and either decimal-point or decimal-comma amounts. Amounts allow two decimal places and optional thousands separators, but no currency symbols.
- Type can come from a column (`income`/`credit`/`deposit` or `expense`/`debit`/`withdrawal`), the amount sign, or one fixed type for the file. With sign-based mapping, positive means income and negative means expense. Negative income conflicts are rejected.
- Currency defaults to your home currency when unmapped or blank. Category names match your own existing categories, ignoring case and surrounding spaces. Add missing categories in Settings or ignore the category column to import as uncategorized. Ambiguous category names must be resolved first. Notes are limited to 2,000 characters.
- Preview does not save anything. Invalid records show a reason and cannot be selected. Exact matches on date, amount, type, currency, resolved category, and note are skipped both within the file and against saved transactions. Identical legitimate transactions can be added manually.
- Saving rechecks the selected records and duplicates against current data. The batch is atomic: any validation or database failure saves none of it. Repeated imports skip matching saved records; imports for the same account are serialized. Records outside the current Overview date range can be found using **All time**.

Finance Guard transaction exports can be imported with the default mappings. Formula-protection apostrophes in exported notes/category names are preserved as literal text, so those fields may require editing before reimporting. The importer does not alter existing transactions or create categories. No database migration is needed for this feature.

## If you already had the app running (upgrading)
Run these migrations in order against your existing database before starting the updated backend (safe to rerun):
```bash
psql -d finance_tracker -f backend/db/migration_currency.sql
psql -d finance_tracker -f backend/db/migration_budgets.sql
psql -d finance_tracker -f backend/db/migration_integrity.sql
```
The integrity migration records each budget's currency, adds category ownership constraints, and checks transaction amounts, budget amounts, and budget months. Existing budgets are assigned their owner's **current home currency** because the old schema did not save their original currency. Review those budgets if you changed your home currency previously; the original currency cannot be recovered automatically. New budgets retain their saved currency when home currency changes, and the Budgets page converts both limits and spending for comparison. Editing a budget displays its original amount and currency.

Existing rows are preserved. New check and ownership constraints are added as `NOT VALID`: they protect new writes without rejecting the migration for unrelated legacy data. Audit and correct legacy invalid amounts, months, or category links before validating those constraints. The migration does not apply exchange rates or rewrite historical amounts.

## Verification

Use Node.js 24 and run:
```bash
cd backend
npm ci
npm test
cd ../frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```
Backend tests run the Express routes against a temporary in-memory PostgreSQL engine (PGlite), including actual constraints, migrations, calendar dates, and signup rollback. They do not connect to your configured database. Frontend unit tests cover sessions, filters, summaries, CSV escaping, date boundaries, and budget/currency math.

Playwright runs desktop and mobile flows against the production build with mocked API and exchange-rate responses. It starts its own preview server on port 5173. Run `npm run build` again after source edits before browser tests. To use installed Edge on Windows, set `$env:PLAYWRIGHT_CHANNEL='msedge'` in PowerShell before running `npm run test:e2e`. Use `npm run format` after editing frontend files. GitHub Actions runs all checks on pushes and pull requests.

## Not built yet (your next steps)
- Deployment (Vercel for frontend, Render/Railway for backend + DB)
- Recurring transactions

## A note on getting it running
Running the app requires a PostgreSQL database, the schema/migrations above, and backend environment variables. Currency conversion uses the Frankfurter API. The regression tests use an isolated database and mocked network responses; they do not require your database or exchange-rate service.
