# Low-Level Design (LLD)
## Finance Tracker — Personal Finance & Multi-Currency Budgeting Platform

| Field | Detail |
|---|---|
| Version | 1.0.0 |
| Status | In Development |
| Created | 2026-09-02 |
| Document Type | Low-Level Design |
| Related Documents | PRD.md, HLD.md |

## Table of Contents
1. Introduction
2. Module-Level Design
3. Database Schema
4. API Specification
5. Frontend Component Structure
6. Sequence Diagrams
7. Error Handling & Validation
8. Security Design

---

## 1. Introduction

This document details the implementation-level design of Finance Tracker: exact database schema, API contracts, module responsibilities, and key request/response flows. It implements the architecture described in `HLD.md` to satisfy the requirements in `PRD.md`.

## 2. Module-Level Design

### 2.1 Auth Module (`backend/routes/auth.js`, `backend/middleware/auth.js`)
**Responsibilities:** user signup, login, JWT issuance and verification, default category seeding.

| Function | Description |
|---|---|
| `POST /signup` | Validates email/password, hashes password with bcrypt (10 salt rounds), inserts user, seeds 6 default categories, returns JWT |
| `POST /login` | Verifies credentials with `bcrypt.compare`, returns JWT on success |
| `requireAuth(req, res, next)` | Middleware — extracts `Bearer` token, verifies with `jsonwebtoken`, attaches `req.userId`, or returns 401 |

### 2.2 Transactions Module (`backend/routes/transactions.js`)
**Responsibilities:** CRUD for transactions, optional filtering, aggregate summary.

| Function | Description |
|---|---|
| `GET /` | Lists transactions for `req.userId`, optional `category`/`from`/`to` query filters, joined with category name |
| `POST /` | Inserts a transaction with amount, type, currency, category, note, date |
| `PUT /:id` | Updates a transaction; uses `COALESCE` so omitted fields retain their existing value |
| `DELETE /:id` | Deletes a transaction scoped to the owning user |
| `GET /meta/summary` | Returns expense totals grouped by category and by month (legacy aggregate; primary aggregation now happens client-side after currency conversion) |

### 2.3 Categories Module (`backend/routes/categories.js`)
**Responsibilities:** CRUD for user-defined categories.

| Function | Description |
|---|---|
| `GET /` | Lists categories for `req.userId`, alphabetical |
| `POST /` | Inserts a category with a non-empty trimmed name |
| `DELETE /:id` | Deletes a category (transactions referencing it fall back to `category_id = NULL` via `ON DELETE SET NULL`) |

### 2.4 Budgets Module (`backend/routes/budgets.js`)
**Responsibilities:** set/view/remove monthly per-category budgets.

| Function | Description |
|---|---|
| `GET /?month=YYYY-MM` | Lists budgets for the user, optionally filtered to one month, joined with category name |
| `POST /` | Upserts a budget via `ON CONFLICT (user_id, category_id, month) DO UPDATE` |
| `DELETE /:id` | Removes a budget |

### 2.5 Users Module (`backend/routes/users.js`)
**Responsibilities:** read/update the authenticated user's home currency.

| Function | Description |
|---|---|
| `GET /me` | Returns `home_currency` for `req.userId` |
| `PUT /me` | Validates a 3-letter currency code, updates `home_currency` |

### 2.6 Currency Utility Module (`frontend/src/utils/currency.js`)
**Responsibilities:** fetch and cache live FX rates, expose conversion math, provide the supported currency list and money formatting.

| Function | Description |
|---|---|
| `fetchRates(homeCurrency)` | Calls the Frankfurter API with `base=homeCurrency`, returns `{ base, rates }` |
| `convertAmount(amount, fromCurrency, toCurrency, rates)` | Converts an amount between currencies using the fetched rate table |
| `formatMoney(amount, currencyCode)` | Formats a number as localized currency text (e.g., `₹1,234.00`) |
| `SUPPORTED_CURRENCIES` | Static list of the 10 currencies offered in dropdowns |

## 3. Database Schema

### Entity-Relationship Overview
```
users (1) ───< (many) categories
users (1) ───< (many) transactions
users (1) ───< (many) budgets
categories (1) ───< (many) transactions   [ON DELETE SET NULL]
categories (1) ───< (many) budgets        [ON DELETE CASCADE]
```

### `users`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| home_currency | VARCHAR(3) | NOT NULL, DEFAULT 'USD' |
| created_at | TIMESTAMP | DEFAULT NOW() |

### `categories`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE |
| name | VARCHAR(100) | NOT NULL |
| is_default | BOOLEAN | DEFAULT FALSE |

### `transactions`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE |
| category_id | INTEGER | REFERENCES categories(id) ON DELETE SET NULL |
| amount | NUMERIC(12,2) | NOT NULL |
| type | VARCHAR(10) | NOT NULL, CHECK (type IN ('income','expense')) |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'USD' |
| note | TEXT | nullable |
| transaction_date | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| created_at | TIMESTAMP | DEFAULT NOW() |

### `budgets`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE |
| category_id | INTEGER | REFERENCES categories(id) ON DELETE CASCADE |
| month | VARCHAR(7) | NOT NULL — format `YYYY-MM` |
| amount | NUMERIC(12,2) | NOT NULL |
| — | — | UNIQUE(user_id, category_id, month) |

## 4. API Specification

All endpoints below (except `/auth/*`) require `Authorization: Bearer <JWT>`. Base path: `/api`.

| Method | Path | Request Body | Response | Auth |
|---|---|---|---|---|
| POST | `/auth/signup` | `{ email, password }` | `201 { token, user }` | No |
| POST | `/auth/login` | `{ email, password }` | `200 { token, user }` | No |
| GET | `/transactions?category=&from=&to=` | — | `200 [transaction]` | Yes |
| POST | `/transactions` | `{ amount, type, categoryId, note, date, currency }` | `201 transaction` | Yes |
| PUT | `/transactions/:id` | any subset of the above fields | `200 transaction` | Yes |
| DELETE | `/transactions/:id` | — | `204` | Yes |
| GET | `/categories` | — | `200 [category]` | Yes |
| POST | `/categories` | `{ name }` | `201 category` | Yes |
| DELETE | `/categories/:id` | — | `204` | Yes |
| GET | `/budgets?month=YYYY-MM` | — | `200 [budget]` | Yes |
| POST | `/budgets` | `{ categoryId, month, amount }` | `201 budget` | Yes |
| DELETE | `/budgets/:id` | — | `204` | Yes |
| GET | `/users/me` | — | `200 { home_currency }` | Yes |
| PUT | `/users/me` | `{ homeCurrency }` | `200 { home_currency }` | Yes |

All error responses follow the shape `{ error: "human-readable message" }` with an appropriate 4xx/5xx status code.

## 5. Frontend Component Structure

```
App.jsx                  — routing, AuthContext (user, homeCurrency, theme)
├── Navbar.jsx            — nav links, theme toggle, logout
├── pages/Login.jsx        — auth form
├── pages/Signup.jsx        — auth form
├── pages/Dashboard.jsx      — KPI cards, insights, charts, add-transaction form,
│                              searchable/sortable/editable transaction list
├── pages/Reports.jsx         — filterable running-balance and category totals
├── pages/Budgets.jsx          — per-category monthly budget editor + progress bars
├── pages/Settings.jsx          — home currency selector, category management
├── api.js                       — fetch wrapper, injects JWT header
└── utils/currency.js              — FX rate fetch/cache, conversion, formatting
```

`AuthContext` is the single source of truth for the logged-in user, their home currency, and the active theme, consumed via the `useAuth()` hook throughout the page components.

## 6. Sequence Diagrams

### 6.1 Signup Flow
```
User → Frontend: submit signup form
Frontend → Backend: POST /auth/signup {email, password}
Backend → DB: check existing email
Backend → DB: insert user (bcrypt hash)
Backend → DB: insert 6 default categories
Backend → Frontend: 201 {token, user}
Frontend → localStorage: store token, user
Frontend → App state: set user, redirect to Dashboard
```

### 6.2 Add Transaction with Currency Conversion
```
User → Dashboard: submit amount, currency, type, category, note
Dashboard → Backend: POST /transactions {amount, currency, type, categoryId, note}
Backend → DB: insert row, scoped to req.userId
Backend → Dashboard: 201 transaction
Dashboard → Backend: GET /transactions, GET /categories (refresh)
Dashboard → Frankfurter API: fetch rates (base = home currency), or use 10-min cache
Dashboard → Dashboard: convert each transaction.amount into home currency
Dashboard → UI: render updated KPIs, charts, transaction list
```

### 6.3 Budget Progress Check
```
User → Budgets page: select month
Budgets → Backend: GET /categories, GET /budgets?month=X, GET /transactions?from=X-01&to=X-lastDay
Budgets → Frankfurter API: fetch rates
Budgets → Budgets: sum converted expense amounts per category_id
Budgets → UI: render progress bar per category (spent / limit), flag if over
```

## 7. Error Handling & Validation

- **Backend:** every route wraps its database call in `try/catch`; on failure, the real error is logged server-side via `console.error` and a generic, safe message is returned to the client (avoids leaking internals while preserving debuggability).
- **Validation:** required fields (amount, type, email, password, currency code length) are checked before any database call; invalid input returns `400` with a specific message.
- **Frontend:** the shared `api.js` wrapper throws on any non-2xx response using the server's `error` message, which page components catch and display inline near the relevant form or list.
- **Date edge cases:** month-range queries (e.g., Budgets page) compute the real last day of the month rather than assuming 31, avoiding invalid-date errors for months with fewer days.

## 8. Security Design

- **Password hashing:** bcrypt with 10 salt rounds; plain-text passwords are never persisted or logged.
- **JWT:** signed with a server-side secret (`JWT_SECRET` env var), 7-day expiry, verified on every protected route before any database access.
- **Per-user data isolation:** every SQL query touching transactions, categories, or budgets includes `WHERE user_id = $1` (or a join constrained the same way) using `req.userId` from the verified token — never a client-supplied ID.
- **Secrets management:** `DATABASE_URL` and `JWT_SECRET` are read from a `.env` file excluded from version control via `.gitignore`.
- **CORS:** enabled on the Express server to allow the Vite dev server origin during development; scoped to the actual frontend origin in production.
