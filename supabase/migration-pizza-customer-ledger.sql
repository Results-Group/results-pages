-- Pizza House customer ledger
--
-- The Aviv POS keeps daily Z-report summaries back to 2019 but PURGES the deal
-- and payment tables: on 2026-08-01 the oldest deal was 2026-06-25, five weeks
-- of history for a seven-year-old restaurant. That is why "returning customers"
-- reads ~5% — there is almost no past to compare against, and there never will
-- be while we read the POS directly.
--
-- This table is our own append-only memory. A nightly cron folds each day's
-- customer identities into it, so the history survives whatever the POS drops.
-- Once it has run for a few months, returning-customer rates become real.
--
-- Identities are stored HASHED (HMAC-SHA256 with SESSION_SECRET). We only ever
-- need to know "is this the same person as before", never who they are, so the
-- raw card identifier never lands in our database.

CREATE TABLE IF NOT EXISTS pizza_customer_ledger (
  branch_id TEXT NOT NULL,
  -- 'card' = credit-card fingerprint, 'meal_card' = Cibus/Ten-Bis card
  identity_type TEXT NOT NULL CHECK (identity_type IN ('card', 'meal_card')),
  identity_hash TEXT NOT NULL,
  first_seen DATE NOT NULL,
  last_seen DATE NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, identity_type, identity_hash)
);

-- "How many of the customers active in a range were first seen before it"
CREATE INDEX IF NOT EXISTS pizza_customer_ledger_seen_idx
  ON pizza_customer_ledger (branch_id, last_seen, first_seen);

ALTER TABLE pizza_customer_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on pizza_customer_ledger" ON pizza_customer_ledger;
CREATE POLICY "Service role full access on pizza_customer_ledger"
  ON pizza_customer_ledger FOR ALL USING (true) WITH CHECK (true);

-- Per-run bookkeeping, so a failed night is visible instead of silent.
CREATE TABLE IF NOT EXISTS pizza_ledger_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT NOT NULL,
  covered_date DATE NOT NULL,
  identities_seen INTEGER NOT NULL DEFAULT 0,
  new_identities INTEGER NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pizza_ledger_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on pizza_ledger_runs" ON pizza_ledger_runs;
CREATE POLICY "Service role full access on pizza_ledger_runs"
  ON pizza_ledger_runs FOR ALL USING (true) WITH CHECK (true);
