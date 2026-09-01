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
Run both migrations against your existing database (safe to run even with existing data):
```bash
psql -d finance_tracker -f backend/db/migration_currency.sql
psql -d finance_tracker -f backend/db/migration_budgets.sql
```
No other setup changes — same `npm install` / `npm run dev` steps as before. If you're only picking up the dashboard-card update from before (not budgets/dark-mode/edit-in-place), just the currency migration is enough.

## Not built yet (your next steps)
- Deployment (Vercel for frontend, Render/Railway for backend + DB)
- CSV export, recurring transactions (stretch goals)

## A note on getting it running
This was scaffolded without the ability to run `npm install` or start a live server, so you'll want to run it locally and work through any first-run errors (missing dependency versions, Postgres connection issues, etc.) — that debugging is normal and a good learning step. If you hit an error, paste it back to me and I'll help you fix it.
