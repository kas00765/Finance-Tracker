# Product Requirements Document (PRD)
## Finance Tracker — Personal Finance & Multi-Currency Budgeting Platform

**Problem statement** — Individuals who earn, spend, or travel across more than one currency have no lightweight tool that lets them log transactions in whatever currency they were actually charged in, while still seeing a single, accurate picture of their spending, budgets, and savings in one home currency.

| Field | Detail |
|---|---|
| Version | 1.0.0 |
| Status | In Development |
| Created | 2026-09-02 |
| Last Updated | 2026-09-02 |
| Document Type | Product Requirements Document |
| Project | Finance Tracker |
| Tech Stack | React (Vite) · Node.js · Express · PostgreSQL · JWT · Recharts · Frankfurter FX API |

## Table of Contents
1. Executive Summary
2. Business Problem
3. User Personas
4. User Pain Points
5. Project Goals
6. Dataset & Data Source Documentation
7. Success Metrics
8. Functional Requirements
9. Non-Functional Requirements
10. User Stories
11. MVP Scope
12. Future Scope
13. Risks and Assumptions
14. Acceptance Criteria

---

## 1. Executive Summary

Finance Tracker is a full-stack personal finance application that lets a user log income and expenses in any currency, automatically converts everything into a single "home currency" using live exchange rates, and surfaces that data through a dashboard, category budgets, and filterable reports.

The platform answers three questions every budget-conscious individual asks:

**Where is my money going? Am I within budget? Am I saving or overspending?**

Built as a React + Express + PostgreSQL data product, Finance Tracker delivers:
- Transaction logging with per-entry currency tagging
- Automatic conversion into a user-selected home currency via a live FX API
- Category-level monthly budgets with spend-vs-limit progress tracking
- A dashboard with income/expense/balance/savings-rate KPIs and trend charts
- A dedicated reports view with date and category filtering

This document defines the requirements, user stories, MVP boundaries, and acceptance criteria used to build and evaluate Finance Tracker.

## 2. Business Problem

### 2.1 Context
People increasingly spend across currencies — a subscription billed in USD, groceries in the local currency, a freelance payment in EUR. Most budgeting tools assume a single currency and either ignore foreign transactions or force manual conversion, which is error-prone and rarely kept up to date since exchange rates move daily.

### 2.2 The Core Gap
There is no lightweight, self-hosted tool that connects:

| Data Source | What it tells us |
|---|---|
| Transaction records | What was spent or earned, and in what currency |
| Category assignment | What the money was spent on |
| Live exchange rates | What that amount is actually worth today |
| Budget limits | Whether spending in a category is on track |

Without connecting these, a user either tracks currencies separately (losing a unified view) or converts manually (losing accuracy as rates change).

### 2.3 Business Impact
- Users lose track of true spending when transactions span currencies
- Manual conversion introduces stale-rate errors
- Without category budgets, overspending is discovered only after the fact
- Without a savings-rate view, users cannot tell if they're financially on track

### 2.4 Opportunity
A lightweight personal tool that automates currency conversion and budget tracking removes the single biggest friction point (manual math) that causes people to abandon budgeting apps within the first month.

## 3. User Personas

### 3.1 Persona 1 — The Multi-Currency Earner
**Name:** Rohan Iyer | **Role:** Freelance developer paid in USD and INR

| Attribute | Detail |
|---|---|
| Primary Goal | See total monthly income/expenses in one currency despite being paid and spending in two |
| Frustration | Spreadsheets require manually looking up exchange rates for every entry |
| Tool Comfort | Medium — comfortable with simple web apps, not spreadsheet formulas |
| Success | Opens the dashboard and immediately sees accurate totals in INR |

### 3.2 Persona 2 — The Budget-Conscious Student
**Name:** Ananya Desai | **Role:** Student managing a fixed monthly allowance

| Attribute | Detail |
|---|---|
| Primary Goal | Stay within a spending limit per category (food, transport, entertainment) |
| Frustration | Doesn't realize she's overspent in a category until the money is already gone |
| Tool Comfort | High — uses apps daily, low patience for complex tools |
| Success | Gets a visual warning before/when a category budget is exceeded |

### 3.3 Persona 3 — The Occasional Traveler
**Name:** Marcus Webb | **Role:** Consultant who travels internationally several times a year

| Attribute | Detail |
|---|---|
| Primary Goal | Log expenses in the local currency at time of purchase, review everything at home later |
| Frustration | Apps that force a single currency make foreign trips hard to track accurately |
| Tool Comfort | Medium | 
| Success | Can tag a transaction in EUR or GBP and see it correctly reflected in his USD dashboard |

## 4. User Pain Points

| # | Persona | Pain Point | Severity |
|---|---|---|---|
| P1 | Multi-Currency Earner | No unified total when income/expenses span currencies | 🔴 Critical |
| P2 | Budget-Conscious Student | Learns about overspending only after checking manually | 🔴 Critical |
| P3 | Occasional Traveler | Forced single-currency entry loses accuracy on trips | 🟠 High |
| P4 | All Personas | No visual breakdown of where money goes by category | 🟠 High |
| P5 | All Personas | No sense of whether they're saving or just breaking even | 🟠 High |
| P6 | Multi-Currency Earner | Manually converting each transaction is slow and error-prone | 🔴 Critical |
| P7 | Budget-Conscious Student | Hard to compare spending month over month | 🟡 Medium |

## 5. Project Goals

### 5.1 Primary Goals
| Goal | Description |
|---|---|
| G1 — Unified Financial View | Show total income, expenses, and balance in one home currency regardless of transaction currency |
| G2 — Accurate Currency Conversion | Convert every transaction using live, up-to-date exchange rates |
| G3 — Category Budgeting | Let users set a monthly spending limit per category and track progress against it |
| G4 — Spending Insight | Surface top spending category, biggest single expense, and average monthly spend |
| G5 — Secure Personal Data | Ensure each user's financial data is private and protected behind authentication |

### 5.2 Secondary Goals
| Goal | Description |
|---|---|
| G6 — Filterable Reporting | Let users slice historical data by date range and category |
| G7 — Usability | Keep the interface simple enough to use without a tutorial |
| G8 — Extensibility | Structure the codebase so budgets, currencies, and categories can be extended later |

## 6. Dataset & Data Source Documentation

| Data Source | Owner | Key Fields | Data Quality / Validation | Refresh Rate |
|---|---|---|---|---|
| User Transactions | End user (self-reported via UI) | `amount`, `type`, `currency`, `category_id`, `transaction_date`, `note` | Amount and type validated server-side before insert; type constrained to `income`/`expense` | Real-time, on user entry |
| Categories | End user + system defaults | `name`, `is_default` | Seeded with 6 defaults on signup; custom categories validated for non-empty name | Real-time, on user entry |
| Budgets | End user | `category_id`, `month`, `amount` | Unique constraint per user+category+month; upserted on save | Real-time, on user entry |
| Exchange Rates | Frankfurter public FX API (frankfurter.dev) | `base`, `rates` (per currency code) | Fetched live per request; client-side cached for 10 minutes to limit calls | On demand, cached |

### Data Validation Requirements
- All transaction amounts must be numeric and positive; type must be `income` or `expense`.
- Currency codes are constrained to a supported list of 10 major currencies.
- Budget amounts are upserted (one budget per category per month) to prevent duplicates.
- Foreign key constraints ensure transactions and budgets cannot reference another user's categories.

## 7. Success Metrics

### 7.1 Product Metrics (KPIs)
| Metric | Target | Measurement Method |
|---|---|---|
| Currency Conversion Accuracy | Within the FX API's published rate, no stale data > 10 minutes | Compare displayed totals to live rate lookups |
| Dashboard Load Time | < 2 seconds on a standard laptop | Manual performance check |
| Budget Overrun Visibility | 100% of over-budget categories visually flagged | UI review against seeded test data |
| Transaction CRUD Success Rate | 100% of create/edit/delete actions persist correctly | Manual + functional testing |

### 7.2 Technical Metrics
| Metric | Target |
|---|---|
| API error responses include actionable messages | 100% of 4xx/5xx routes |
| Auth-protected routes reject unauthenticated requests | 100% |
| Currency conversion cache hit rate | Reduces FX API calls by reusing rates within a 10-minute window |

## 8. Functional Requirements

### 8.1 Authentication Module
| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The system SHALL allow a user to sign up with email and password | Must Have |
| FR-02 | The system SHALL hash passwords before storage (bcrypt) | Must Have |
| FR-03 | The system SHALL issue a JWT on successful login, valid for 7 days | Must Have |
| FR-04 | The system SHALL reject requests to protected routes without a valid token | Must Have |
| FR-05 | The system SHALL seed six default categories for every new user on signup | Should Have |

### 8.2 Transaction Module
| ID | Requirement | Priority |
|---|---|---|
| FR-06 | The system SHALL allow creating a transaction with amount, type, currency, category, note, and date | Must Have |
| FR-07 | The system SHALL allow editing an existing transaction in place | Must Have |
| FR-08 | The system SHALL allow deleting a transaction | Must Have |
| FR-09 | The system SHALL allow filtering transactions by category and date range | Must Have |
| FR-10 | The system SHALL allow searching transactions by note or category text | Should Have |
| FR-11 | The system SHALL allow sorting transactions by date or amount | Should Have |

### 8.3 Currency Conversion Module
| ID | Requirement | Priority |
|---|---|---|
| FR-12 | The system SHALL let a user select a home currency in Settings | Must Have |
| FR-13 | The system SHALL fetch live exchange rates from a public FX API | Must Have |
| FR-14 | The system SHALL convert every transaction's amount into the home currency for all totals and charts | Must Have |
| FR-15 | The system SHALL cache fetched rates for a short period to reduce redundant API calls | Should Have |

### 8.4 Budgeting Module
| ID | Requirement | Priority |
|---|---|---|
| FR-16 | The system SHALL allow setting a monthly spending limit per category | Must Have |
| FR-17 | The system SHALL compute actual spend per category for a selected month | Must Have |
| FR-18 | The system SHALL display a progress bar comparing spend to the budget limit | Must Have |
| FR-19 | The system SHALL visually flag categories that exceed their budget | Must Have |
| FR-20 | The system SHALL allow deleting a budget | Should Have |

### 8.5 Dashboard & Reporting Module
| ID | Requirement | Priority |
|---|---|---|
| FR-21 | The dashboard SHALL display total income, total expenses, and balance | Must Have |
| FR-22 | The dashboard SHALL display average monthly spending, biggest single expense, top spending category, and savings rate | Should Have |
| FR-23 | The dashboard SHALL render a spending-by-category chart | Must Have |
| FR-24 | The dashboard SHALL render an income-vs-expense chart by month | Must Have |
| FR-25 | The Reports page SHALL support filtering by category and date range independent of the dashboard | Must Have |
| FR-26 | The Reports page SHALL display a running balance over time | Should Have |

### 8.6 Category Management Module
| ID | Requirement | Priority |
|---|---|---|
| FR-27 | The system SHALL allow creating custom categories | Must Have |
| FR-28 | The system SHALL allow deleting a category | Should Have |

## 9. Non-Functional Requirements

### 9.1 Performance
| ID | Requirement |
|---|---|
| NFR-01 | Dashboard must load within 2 seconds on a standard laptop with typical data volume |
| NFR-02 | Exchange rate lookups must be cached client-side for at least 10 minutes to avoid redundant calls |

### 9.2 Reliability
| ID | Requirement |
|---|---|
| NFR-03 | The API must return descriptive error messages on failure, logged server-side |
| NFR-04 | The system must handle FX API failures gracefully without crashing the dashboard |

### 9.3 Maintainability
| ID | Requirement |
|---|---|
| NFR-05 | Backend routes must be organized by resource (auth, transactions, categories, budgets, users) |
| NFR-06 | Frontend components must be organized by page and shared utility (currency, API client) |

### 9.4 Security
| ID | Requirement |
|---|---|
| NFR-07 | Passwords must never be stored in plain text |
| NFR-08 | JWT secret and database credentials must be stored in environment variables, excluded from version control |
| NFR-09 | All transaction, category, and budget routes must be scoped to the authenticated user's own data |

### 9.5 Usability
| ID | Requirement |
|---|---|
| NFR-10 | The interface must be usable without a tutorial by a non-technical user |
| NFR-11 | The interface must support both dark and light themes |
| NFR-12 | All charts must include labels and tooltips showing the home currency |

## 10. User Stories

### Epic 1 — Account & Access
**US-101**
As a new user, I want to sign up with my email and password, so that I have a private account for my financial data.
*Acceptance Criteria:* Signup requires a valid email and a password of at least 6 characters; a duplicate email is rejected; default categories are created automatically.

**US-102**
As a returning user, I want to log in and stay logged in, so that I don't have to re-authenticate every visit.
*Acceptance Criteria:* Login issues a JWT valid for 7 days; the token is stored client-side and sent on every API request.

### Epic 2 — Transaction Management
**US-201**
As a user, I want to add a transaction with an amount, currency, type, category, and note, so that I can log exactly what I earned or spent.
*Acceptance Criteria:* All required fields are validated; the transaction appears immediately in the list and in dashboard totals.

**US-202**
As a user, I want to edit a transaction in place, so that I can fix mistakes without deleting and re-entering it.
*Acceptance Criteria:* Clicking Edit turns the row into an editable form; Save persists changes; Cancel discards them.

**US-203**
As a user, I want to search and sort my transaction list, so that I can find specific entries quickly.
*Acceptance Criteria:* Search matches note or category text; sort options include newest/oldest and amount high/low.

### Epic 3 — Multi-Currency Support
**US-301**
As a user who spends in multiple currencies, I want to tag each transaction with its actual currency, so that I don't have to convert amounts manually before entering them.
*Acceptance Criteria:* A currency selector is available on the add-transaction form with at least 10 supported currencies.

**US-302**
As a user, I want to choose a home currency, so that all my totals and charts show a single, consistent number.
*Acceptance Criteria:* Settings page allows selecting a home currency; the dashboard and reports immediately reflect the change using live rates.

### Epic 4 — Budgeting
**US-401**
As a user, I want to set a monthly spending limit for a category, so that I can control discretionary spending.
*Acceptance Criteria:* Budgets page allows entering an amount per category per month; saving upserts the value.

**US-402**
As a user, I want to see a progress bar for each category's spend vs. its budget, so that I know at a glance if I'm on track.
*Acceptance Criteria:* Progress bar fills proportionally to spend/limit; turns red and shows an "Over budget" label when exceeded.

### Epic 5 — Insights & Reporting
**US-501**
As a user, I want to see my top spending category and biggest single expense, so that I know where to cut back.
*Acceptance Criteria:* Dashboard displays both, computed from the currently loaded transaction set, converted to home currency.

**US-502**
As a user, I want to filter my transaction history by date range and category on a dedicated Reports page, so that I can analyze a specific period.
*Acceptance Criteria:* Filters apply independently of the Dashboard's data; a running balance chart updates accordingly.

## 11. MVP Scope

The MVP focuses on validating the core value proposition: log transactions in any currency, see one accurate picture in a home currency, and stay within category budgets.

### ✅ Included in MVP
| Feature | Rationale |
|---|---|
| Email/password auth with JWT | Required for private, per-user data |
| Transaction CRUD with per-entry currency | Core value — accurate multi-currency logging |
| Live FX conversion to a home currency | Core value — unified view |
| Category management (default + custom) | Required for budgeting and breakdowns |
| Monthly budgets with progress tracking | Core value — proactive spend control |
| Dashboard KPIs and charts | Primary delivery surface |
| Reports page with filters | Core value — historical analysis |
| Dark/light theme | Baseline usability expectation |

### ❌ Explicitly Excluded from MVP
| Feature | Reason for Deferral |
|---|---|
| Recurring transactions | Adds scheduling complexity; not needed to validate core value |
| CSV import/export | Nice-to-have; not core to the value proposition |
| Multi-user shared budgets/households | Significant permissions complexity |
| Push/email notifications for budget overruns | Requires notification infrastructure |
| Bank account integration (Plaid, etc.) | Requires third-party financial data agreements |
| Mobile native app | Web app is sufficient to validate MVP |

## 12. Future Scope

### Phase 2 — Automation
| Feature | Description |
|---|---|
| Recurring Transactions | Auto-create transactions on a schedule (e.g., monthly rent) |
| CSV Import/Export | Bulk import bank statements; export reports |
| Budget Alerts | Email/push notification when a category nears its limit |

### Phase 3 — Collaboration
| Feature | Description |
|---|---|
| Shared/Household Budgets | Multiple users contributing to one shared budget |
| Role-Based Sharing | View-only access for a partner or accountant |

### Phase 4 — Intelligence
| Feature | Description |
|---|---|
| Spend Forecasting | Predict end-of-month spend based on current pace |
| Smart Categorization | Auto-suggest a category based on transaction note |

## 13. Risks and Assumptions

### 13.1 Risks
| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Third-party FX API becomes unavailable or changes its interface | Medium | High | Cache last-known rates client-side; design conversion utility as a swappable module |
| R2 | Currency conversion introduces rounding errors over many transactions | Low | Medium | Use consistent decimal precision (2 places) at display time only, never in stored amounts |
| R3 | Users enter budgets for categories with no transactions yet, causing confusing 0% progress bars | Medium | Low | Show "no spending yet" state clearly rather than an empty bar |
| R4 | Scope creep beyond MVP (e.g., adding notifications early) | Medium | Medium | Strict adherence to MVP scope; defer Phase 2+ features |

### 13.2 Assumptions
| # | Assumption |
|---|---|
| A1 | Users have reliable internet access for live exchange rate lookups |
| A2 | A single home currency per user is sufficient (no per-transaction reporting currency needed) |
| A3 | PostgreSQL is available and reachable from the backend environment |
| A4 | The Frankfurter API's free tier rate limits are sufficient for a single-user personal tool |

## 14. Acceptance Criteria

The following criteria define the minimum bar for the Finance Tracker MVP to be considered complete.

**AC-1 — Authentication**
- A user can sign up, log in, and access only their own data
- Passwords are hashed; JWT is required on all protected routes

**AC-2 — Transactions**
- Create, edit, delete, search, and sort all function correctly against the database
- Each transaction stores its own currency code

**AC-3 — Currency Conversion**
- Dashboard and Reports totals reflect the selected home currency
- Rates are fetched from a live source, not hardcoded

**AC-4 — Budgets**
- A budget can be set per category per month
- Progress bar accurately reflects spend vs. limit and flags overruns

**AC-5 — Dashboard & Reports**
- All KPI cards and charts render without errors given seeded test data
- Reports filters (date range, category) correctly narrow the displayed data

**AC-6 — Code Quality**
- Backend routes are organized by resource with consistent error handling
- Environment secrets (DB credentials, JWT secret) are excluded from version control via `.gitignore`

**AC-7 — Documentation**
- PRD, HLD, and LLD are complete and version-controlled in the repository
- README includes setup instructions for both backend and frontend

---

## Appendix A — Glossary

| Term | Definition |
|---|---|
| Home Currency | The single currency a user chooses for all totals, charts, and budgets to be displayed in |
| FX Rate | Foreign exchange rate — the value of one currency expressed in another |
| Upsert | An insert that updates the existing row instead of failing if a matching row already exists |
| JWT | JSON Web Token — a signed token used to authenticate API requests |
| Category | A user-defined or default label (e.g., Food, Rent) used to classify transactions |
| Budget | A user-set spending limit for a category within a specific month |

## Appendix B — Data Schema Contracts

**Users**
```
id            : SERIAL PRIMARY KEY
email         : VARCHAR(255) UNIQUE NOT NULL
password_hash : VARCHAR(255) NOT NULL
home_currency : VARCHAR(3) NOT NULL DEFAULT 'USD'
created_at    : TIMESTAMP
```

**Categories**
```
id         : SERIAL PRIMARY KEY
user_id    : INTEGER REFERENCES users(id)
name       : VARCHAR(100) NOT NULL
is_default : BOOLEAN DEFAULT FALSE
```

**Transactions**
```
id                : SERIAL PRIMARY KEY
user_id           : INTEGER REFERENCES users(id)
category_id       : INTEGER REFERENCES categories(id)
amount            : NUMERIC(12,2) NOT NULL
type              : VARCHAR(10) NOT NULL CHECK (type IN ('income','expense'))
currency          : VARCHAR(3) NOT NULL DEFAULT 'USD'
note              : TEXT
transaction_date  : DATE NOT NULL DEFAULT CURRENT_DATE
created_at        : TIMESTAMP
```

**Budgets**
```
id          : SERIAL PRIMARY KEY
user_id     : INTEGER REFERENCES users(id)
category_id : INTEGER REFERENCES categories(id)
month       : VARCHAR(7) NOT NULL  -- 'YYYY-MM'
amount      : NUMERIC(12,2) NOT NULL
UNIQUE(user_id, category_id, month)
```
