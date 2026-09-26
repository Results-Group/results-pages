-- Pizza House — phone-linked orders
--
-- On 2026-09-24 the Aviv POS started carrying, per delivery customer, that
-- customer's LAST order: client_delivery.last_deal_id / _date / _sum
-- (Mevaseret first; Giv'at Ze'ev once Aviv repeats the change there). That is
-- the first per-person identity this POS has ever exposed — a phone survives
-- card renewals and multi-card households, which the card ledger cannot see.
--
-- One order per customer is not a history, and the POS still purges deals
-- after ~5 weeks. So the nightly cron (/api/cron/pizza-ledger) re-upserts the
-- whole client_delivery snapshot here every night, idempotent by
-- (branch, deal), and the history accumulates from the first run onward.
--
-- Phones are stored HMAC'd with PIZZAHOUSE_PHONE_KEY (not SESSION_SECRET: that
-- already keys the card ledger, and rotating it must not wipe this too). No
-- name, email or address is ever read from the POS for this table.

CREATE TABLE IF NOT EXISTS pizza_phone_orders (
  branch_id TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  deal_id BIGINT NOT NULL,
  -- Naive Israel local time, exactly as the POS stores it (no tz conversion).
  deal_date TIMESTAMP NOT NULL,
  deal_sum NUMERIC(12, 2) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, deal_id)
);

CREATE INDEX IF NOT EXISTS pizza_phone_orders_customer_idx
  ON pizza_phone_orders (branch_id, phone_hash, deal_date);
CREATE INDEX IF NOT EXISTS pizza_phone_orders_date_idx
  ON pizza_phone_orders (branch_id, deal_date);

ALTER TABLE pizza_phone_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on pizza_phone_orders" ON pizza_phone_orders;
CREATE POLICY "Service role full access on pizza_phone_orders"
  ON pizza_phone_orders FOR ALL USING (true) WITH CHECK (true);

-- Everything the dashboard needs, in one row of JSON. One function call
-- instead of paging thousands of per-customer rows through PostgREST's
-- 1,000-row cap, and COUNT(DISTINCT phone_hash) across several branches
-- counts a person who orders from both branches once.
--
-- p_from / p_to are naive Israel-time timestamps like deal_date; p_to is
-- exclusive. Recency buckets are measured from Israel "now" and partition
-- the whole base by each customer's LAST order.
CREATE OR REPLACE FUNCTION pizza_phone_customers(p_branches TEXT[], p_from TIMESTAMP, p_to TIMESTAMP)
RETURNS JSONB AS $$
  WITH il_now AS (
    SELECT (now() AT TIME ZONE 'Asia/Jerusalem') AS t
  ),
  per_customer AS (
    SELECT phone_hash,
           MAX(deal_date) AS last_order,
           COUNT(*) AS orders_total,
           COUNT(*) FILTER (WHERE deal_date >= p_from AND deal_date < p_to) AS orders_in_range,
           COALESCE(SUM(deal_sum) FILTER (WHERE deal_date >= p_from AND deal_date < p_to), 0) AS spend_in_range,
           BOOL_OR(deal_date < p_from) AS has_before
    FROM pizza_phone_orders
    WHERE branch_id = ANY(p_branches)
    GROUP BY phone_hash
  ),
  meta AS (
    SELECT MIN(captured_at) AS first_captured,
           MAX(captured_at) AS last_captured,
           ARRAY_AGG(DISTINCT branch_id) AS branches
    FROM pizza_phone_orders
    WHERE branch_id = ANY(p_branches)
  )
  SELECT jsonb_build_object(
    'base', COUNT(*),
    'recency', jsonb_build_object(
      'up_to_30d', COUNT(*) FILTER (WHERE last_order >= t - INTERVAL '30 days'),
      'd30_90',    COUNT(*) FILTER (WHERE last_order <  t - INTERVAL '30 days'  AND last_order >= t - INTERVAL '90 days'),
      'd90_180',   COUNT(*) FILTER (WHERE last_order <  t - INTERVAL '90 days'  AND last_order >= t - INTERVAL '180 days'),
      'd180_365',  COUNT(*) FILTER (WHERE last_order <  t - INTERVAL '180 days' AND last_order >= t - INTERVAL '365 days'),
      'over_365',  COUNT(*) FILTER (WHERE last_order <  t - INTERVAL '365 days')
    ),
    'in_range', jsonb_build_object(
      'customers', COUNT(*) FILTER (WHERE orders_in_range > 0),
      'orders',    COALESCE(SUM(orders_in_range), 0),
      'revenue',   COALESCE(SUM(spend_in_range), 0)
    ),
    'new_vs_returning', jsonb_build_object(
      'new',               COUNT(*) FILTER (WHERE orders_in_range > 0 AND NOT has_before),
      'returning',         COUNT(*) FILTER (WHERE orders_in_range > 0 AND has_before),
      'new_revenue',       COALESCE(SUM(spend_in_range) FILTER (WHERE orders_in_range > 0 AND NOT has_before), 0),
      'returning_revenue', COALESCE(SUM(spend_in_range) FILTER (WHERE orders_in_range > 0 AND has_before), 0)
    ),
    -- Same buckets as the card-based frequency chart, so the UI can swap them 1:1.
    'frequency', jsonb_build_object(
      '1',   COUNT(*) FILTER (WHERE orders_in_range > 0 AND orders_total = 1),
      '2',   COUNT(*) FILTER (WHERE orders_in_range > 0 AND orders_total = 2),
      '3-5', COUNT(*) FILTER (WHERE orders_in_range > 0 AND orders_total BETWEEN 3 AND 5),
      '6+',  COUNT(*) FILTER (WHERE orders_in_range > 0 AND orders_total >= 6)
    ),
    'collection_start',   (SELECT to_char(first_captured AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') FROM meta),
    'last_captured_at',   (SELECT last_captured FROM meta),
    'branches_with_data', (SELECT COALESCE(to_jsonb(branches), '[]'::jsonb) FROM meta)
  )
  FROM per_customer, il_now;
$$ LANGUAGE sql STABLE;
