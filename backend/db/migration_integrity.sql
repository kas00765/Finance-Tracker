-- Run after schema.sql (and the older migrations for existing databases).
-- Existing budgets did not record their currency. The owner's current home
-- currency is the best available backfill; review it if they previously changed it.
BEGIN;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS currency VARCHAR(3);
UPDATE budgets b SET currency = u.home_currency
FROM users u WHERE b.user_id = u.id AND b.currency IS NULL;
ALTER TABLE budgets ALTER COLUMN currency SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_owner_id ON categories(user_id, id);
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_owner;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_owner
  FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id) NOT VALID;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_owner;
ALTER TABLE budgets ADD CONSTRAINT budgets_category_owner
  FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id) NOT VALID;

-- NOT VALID preserves legacy data but enforces these checks on new/updated rows.
-- Drop/add inside this transaction keeps the migration safe to rerun.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_positive_amount;
ALTER TABLE transactions ADD CONSTRAINT transactions_positive_amount
  CHECK (amount > 0 AND amount < 10000000000) NOT VALID;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_nonnegative_amount;
ALTER TABLE budgets ADD CONSTRAINT budgets_nonnegative_amount
  CHECK (amount >= 0 AND amount < 10000000000) NOT VALID;
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_valid_month;
ALTER TABLE budgets ADD CONSTRAINT budgets_valid_month
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND LEFT(month, 4) <> '0000') NOT VALID;
COMMIT;
