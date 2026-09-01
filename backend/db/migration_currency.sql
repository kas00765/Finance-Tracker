-- Run this against your existing finance_tracker database to add currency support.
-- In psql: \c finance_tracker  then  \i C:/path/to/backend/db/migration_currency.sql

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_currency VARCHAR(3) NOT NULL DEFAULT 'USD';
