-- Run this against your existing finance_tracker database to add budget support.
-- In psql: \c finance_tracker  then  \i C:/path/to/backend/db/migration_budgets.sql

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  amount NUMERIC(12, 2) NOT NULL,
  UNIQUE(user_id, category_id, month)
);
