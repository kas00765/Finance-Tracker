# Personal Finance Tracker

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
- [x] Transactions: create, list, update (inline, in the UI), delete — each tagged with its own currency
- [x] Categories: default categories seeded on signup, custom categories (add/delete on the Settings page)
- [x] Dashboard: totals, avg monthly spending, biggest expense, top category, savings rate; pie/bar/line/donut charts — all converted into your home currency
- [x] Search and sort on the transaction list (by note/category, by date or amount)
- [x] Budgets page: set a monthly spending limit per category, with a progress bar vs. actual spending
- [x] Reports page: date/category filters, running balance over time, totals-by-category table
- [x] Settings page: choose your home currency; live rates fetched from the Frankfurter API
- [x] Dark/light theme toggle (dark navy by default), hover animations, smoother transitions throughout

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
```
Backend tests run the Express routes against a temporary in-memory PostgreSQL engine (PGlite), including actual constraints, migrations, and signup rollback. They do not connect to your configured database. Frontend tests cover expired sessions, request races, retryable failures, and budget currency conversion. GitHub Actions runs both suites and the frontend build on pushes and pull requests.

## Not built yet (your next steps)
- Deployment (Vercel for frontend, Render/Railway for backend + DB)
- CSV export, recurring transactions (stretch goals)

## A note on getting it running
Running the app requires a PostgreSQL database, the schema/migrations above, and backend environment variables. Currency conversion uses the Frankfurter API. The regression tests use an isolated database and mocked network responses; they do not require your database or exchange-rate service.
