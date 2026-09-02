# High-Level Design (HLD)
## Finance Tracker — Personal Finance & Multi-Currency Budgeting Platform

| Field | Detail |
|---|---|
| Version | 1.0.0 |
| Status | In Development |
| Created | 2026-09-02 |
| Document Type | High-Level Design |
| Related Document | PRD.md |

## Table of Contents
1. Introduction & Purpose
2. System Overview
3. Architecture Diagram
4. Technology Stack
5. System Components
6. Data Flow
7. Deployment Architecture
8. Security Architecture
9. Third-Party Integrations
10. Scalability & Performance Considerations
11. Assumptions & Constraints

---

## 1. Introduction & Purpose

This document describes the high-level architecture of Finance Tracker: how the frontend, backend, database, and external services fit together, and the major design decisions behind that structure. It is the bridge between the product requirements in `PRD.md` and the implementation detail in `LLD.md`.

## 2. System Overview

Finance Tracker is a three-tier web application:

- **Presentation tier** — a React single-page application (SPA) that renders the dashboard, reports, budgets, and settings, and talks to the backend over a REST API.
- **Application tier** — a Node.js/Express API that handles authentication, business logic (currency conversion orchestration, budget calculations), and data access.
- **Data tier** — a PostgreSQL relational database storing users, categories, transactions, and budgets.

A fourth, external component — the **Frankfurter FX rate API** — supplies live exchange rates consumed directly by the frontend.

## 3. Architecture Diagram

```
                         ┌─────────────────────────┐
                         │   Frankfurter FX API     │
                         │  (api.frankfurter.dev)   │
                         └───────────▲──────────────┘
                                     │ HTTPS (live rates)
                                     │
┌────────────────────────┐   REST/JSON   ┌───────────────────────────┐
│   React SPA (Vite)     │◄─────────────►│   Express API (Node.js)   │
│  - Dashboard            │   over HTTPS  │  - Auth (JWT)              │
│  - Reports               │              │  - Transactions             │
│  - Budgets                │             │  - Categories                │
│  - Settings                 │           │  - Budgets                    │
│  - Currency utility           │         │  - Users/Settings               │
└────────────────────────┘               └─────────────┬─────────────┘
     ▲  localStorage                                     │ SQL (pg driver)
     │  (JWT, theme, user)                                ▼
     │                                        ┌───────────────────────┐
     │                                        │     PostgreSQL          │
     │                                        │  users / categories      │
     │                                        │  transactions / budgets   │
     │                                        └───────────────────────┘
     │
     └── Browser (end user)
```

## 4. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | React 18 (Vite) | Fast dev server, component-based UI, large ecosystem |
| Routing | react-router-dom | Standard client-side routing for a multi-page SPA |
| Charts | Recharts | Declarative charting library that composes well with React |
| Icons | lucide-react | Consistent, lightweight icon set |
| Backend framework | Node.js + Express | Minimal, well-understood REST framework |
| Database | PostgreSQL | Relational integrity for financial data (foreign keys, constraints, transactions) |
| DB driver | `pg` (node-postgres) | Direct SQL access without an ORM, keeping queries transparent |
| Auth | JWT + bcrypt | Stateless auth suitable for a REST API; bcrypt for one-way password hashing |
| Live FX rates | Frankfurter API | Free, no-API-key exchange rate service |
| Styling | Plain CSS with custom properties | Theme (dark/light) switching via CSS variables, no build-time CSS framework dependency |

## 5. System Components

### 5.1 Frontend (React SPA)
- **Pages:** Login, Signup, Dashboard, Reports, Budgets, Settings
- **Shared components:** Navbar (navigation + theme toggle)
- **Utilities:** `api.js` (typed fetch wrapper with JWT header injection), `utils/currency.js` (FX rate fetching, caching, and conversion math)
- **State management:** React Context (`AuthContext`) for user session, home currency, and theme; local component state for page-specific data

### 5.2 Backend (Express API)
Organized by resource, each as an Express Router mounted under `/api`:
- `auth.js` — signup, login
- `transactions.js` — CRUD + summary aggregation
- `categories.js` — CRUD
- `budgets.js` — CRUD (upsert semantics)
- `users.js` — read/update home currency

A shared `middleware/auth.js` verifies the JWT on every protected route and attaches `req.userId`.

### 5.3 Database (PostgreSQL)
Four core tables — `users`, `categories`, `transactions`, `budgets` — connected by foreign keys with `ON DELETE CASCADE` so deleting a user cleans up their data automatically. See `LLD.md` for full column-level detail.

### 5.4 External Service (Frankfurter API)
A stateless, unauthenticated REST API queried directly from the browser to fetch current exchange rates relative to the user's home currency. Results are cached client-side for 10 minutes to limit calls.

## 6. Data Flow

**Example: adding a transaction and viewing converted totals**

1. User submits the "Add transaction" form (amount, currency, type, category, note) from the Dashboard.
2. Frontend calls `POST /api/transactions` with the JWT in the `Authorization` header.
3. Backend validates the payload, inserts a row into `transactions` scoped to `req.userId`, and returns the created record.
4. Frontend re-fetches the transaction list, category list, and current FX rates (cached if fetched within 10 minutes).
5. For each transaction, the frontend converts `amount` from its stored `currency` into the user's `home_currency` using the fetched rates (via USD as a pivot when needed).
6. Converted amounts feed the KPI cards, charts, and transaction list — the raw stored amount and currency are never altered, only the displayed/aggregated values are converted.

## 7. Deployment Architecture

For local development (current state): the React dev server (Vite) runs on `localhost:5173` and proxies `/api` requests to the Express server on `localhost:4000`, which connects to a local PostgreSQL instance.

For a production deployment (planned, not yet implemented):
- **Frontend:** static build deployed to Vercel (or similar static host)
- **Backend:** deployed to Render/Railway as a Node.js service
- **Database:** managed PostgreSQL instance (Render/Railway/Supabase)
- **Environment variables** (`DATABASE_URL`, `JWT_SECRET`) injected via the hosting platform's secret management, never committed to source control

## 8. Security Architecture

- **Password storage:** bcrypt hash, never plain text
- **Authentication:** stateless JWT, 7-day expiry, verified on every protected route via middleware
- **Authorization:** every query is scoped to `req.userId` extracted from the verified token — no endpoint trusts a client-supplied user ID
- **Secrets:** database connection string and JWT signing secret live in a `.env` file excluded from version control via `.gitignore`
- **Transport:** all API calls intended to run over HTTPS in production (local dev uses HTTP)

## 9. Third-Party Integrations

| Integration | Purpose | Failure Handling |
|---|---|---|
| Frankfurter FX API | Live exchange rates for currency conversion | Client-side cache (10 min) reduces dependency on live availability per request; a failed fetch surfaces a visible error rather than silently showing wrong totals |

## 10. Scalability & Performance Considerations

- Read-heavy endpoints (transaction list, summary) use indexed foreign keys (`user_id`) for efficient filtering.
- FX rate caching avoids redundant external calls on every page navigation.
- The current single-database design is appropriate for the MVP's expected load (single user or small user base); horizontal scaling (read replicas, caching layer) is out of scope until usage data justifies it.

## 11. Assumptions & Constraints

- A single PostgreSQL instance is sufficient for the MVP's data volume.
- The Frankfurter API's availability and rate limits are sufficient for personal, non-commercial use.
- The system assumes one home currency per user at a time (not per-transaction reporting currency).
- No real-time (WebSocket) updates are required; all data refreshes on explicit user action (page load, form submit).
