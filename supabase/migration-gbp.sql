-- Google Business Profile integration
--
-- Two tables: the OAuth connection (one row per Google account we were granted
-- access to) and a daily metrics cache.
--
-- Metrics are cached rather than fetched live because Google's quota is finite,
-- the numbers only change once a day, and a dashboard that calls Google on every
-- page load fails whenever Google is slow. Caching also means we accumulate our
-- own history, exactly like the customer ledger — Google's Performance API only
-- serves the last 18 months.

CREATE TABLE IF NOT EXISTS gbp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The Google account that granted access (for display; not an identity check)
  account_email TEXT NOT NULL,
  -- Encrypted with AES-256-GCM, key derived from SESSION_SECRET. A refresh
  -- token is a long-lived credential to a client's business listing; service-
  -- role RLS alone is not enough protection for it.
  refresh_token_enc TEXT NOT NULL,
  -- Google's resource name, e.g. "accounts/123456789"
  account_resource TEXT,
  scopes TEXT,
  connected_by UUID REFERENCES admin_users(id),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_email)
);

ALTER TABLE gbp_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on gbp_connections" ON gbp_connections;
CREATE POLICY "Service role full access on gbp_connections"
  ON gbp_connections FOR ALL USING (true) WITH CHECK (true);

-- Which Google location maps to which of our branches. Pizza House has two
-- (Givat Ze'ev, Mevaseret Zion), so this is a mapping table from day one
-- rather than a single hard-coded location.
CREATE TABLE IF NOT EXISTS gbp_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES gbp_connections(id) ON DELETE CASCADE,
  -- Google's resource name, e.g. "locations/1234567890"
  location_resource TEXT NOT NULL,
  title TEXT,
  address TEXT,
  -- Our own branch id from BRANCH_REGISTRY ('main', 'mevaseret'). NULL until
  -- someone maps it, so an unmapped listing is visible rather than silently
  -- dropped.
  branch_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_resource)
);

ALTER TABLE gbp_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on gbp_locations" ON gbp_locations;
CREATE POLICY "Service role full access on gbp_locations"
  ON gbp_locations FOR ALL USING (true) WITH CHECK (true);

-- One row per location per day per metric.
CREATE TABLE IF NOT EXISTS gbp_daily_metrics (
  location_resource TEXT NOT NULL,
  metric TEXT NOT NULL,
  day DATE NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_resource, metric, day)
);

CREATE INDEX IF NOT EXISTS gbp_daily_metrics_day_idx
  ON gbp_daily_metrics (location_resource, day);

ALTER TABLE gbp_daily_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on gbp_daily_metrics" ON gbp_daily_metrics;
CREATE POLICY "Service role full access on gbp_daily_metrics"
  ON gbp_daily_metrics FOR ALL USING (true) WITH CHECK (true);
