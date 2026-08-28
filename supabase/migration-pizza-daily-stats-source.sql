-- Two series per branch in pizza_daily_stats, never to be mixed in one chart:
--   'pos'    — the whole till, snapshotted nightly from the POS (from 22.7.2026)
--   'online' — the digital ordering channel, imported from its own exports
--              (history reaches Oct 2024 / Jul 2023, long before the POS mirror)
-- Mixing them across the 22.7 boundary would fake an 8x jump — the source
-- column is what keeps comparisons honest.
ALTER TABLE pizza_daily_stats ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pos';
ALTER TABLE pizza_daily_stats DROP CONSTRAINT IF EXISTS pizza_daily_stats_branch_id_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS pizza_daily_stats_branch_day_source_idx
  ON pizza_daily_stats (branch_id, day, source);
