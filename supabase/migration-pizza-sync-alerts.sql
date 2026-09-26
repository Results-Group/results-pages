-- Pizza House — "a branch's till sent nothing for a normal trading day"
--
-- Mevaseret recorded nothing for 10, 14 and 15 September 2026 — ordinary
-- working days, Giv'at Ze'ev open — and nobody noticed for a week. The POS
-- purges after ~5 weeks, so a gap not chased while the till still holds the
-- day is lost for good. The nightly pizza-ledger cron now checks the last 35
-- days of pizza_daily_stats and records every quiet branch-day here.
--
-- One row per (branch, day): the primary key is also what stops the same gap
-- being emailed twice, however many times the cron runs.

CREATE TABLE IF NOT EXISTS pizza_sync_alerts (
  branch_id TEXT NOT NULL,
  day DATE NOT NULL,
  -- 'branch' = this branch quiet while another traded (emailed);
  -- 'all'    = every branch quiet that day, almost always a holiday (shown only).
  kind TEXT NOT NULL CHECK (kind IN ('branch', 'all')),
  orders INTEGER NOT NULL DEFAULT 0,
  usual_orders INTEGER NOT NULL DEFAULT 0,
  others JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  emailed_at TIMESTAMPTZ,
  PRIMARY KEY (branch_id, day)
);

ALTER TABLE pizza_sync_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on pizza_sync_alerts" ON pizza_sync_alerts;
CREATE POLICY "Service role full access on pizza_sync_alerts"
  ON pizza_sync_alerts FOR ALL USING (true) WITH CHECK (true);
