-- Daily sales snapshots per Pizza House branch. The POS purges its deal
-- tables after ~5 weeks, so month-over-month comparisons in the dashboard
-- collapse as "last month" erodes day by day. The nightly cron re-upserts the
-- POS's whole remaining window here, so from now on history accumulates and
-- outlives the purge (same reasoning as pizza_customer_ledger, for sales).
CREATE TABLE IF NOT EXISTS pizza_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT NOT NULL,
  day DATE NOT NULL,
  orders INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_id, day)
);

ALTER TABLE pizza_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on pizza_daily_stats" ON pizza_daily_stats;
CREATE POLICY "Service role full access on pizza_daily_stats" ON pizza_daily_stats
  FOR ALL USING (true) WITH CHECK (true);
