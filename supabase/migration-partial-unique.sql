-- Partial unique indexes so soft-deleted (trashed) rows no longer occupy a
-- slug / short_url. Without this, deleting an item and recreating one with the
-- same slug is blocked by the DB constraint while the old row sits in Trash.
--
-- Safe to run once. If you have existing trashed rows that share a slug with a
-- live row, resolve those first (the CREATE UNIQUE INDEX will report the clash).

-- ── landing_pages: UNIQUE(client, slug) → partial ──
ALTER TABLE landing_pages DROP CONSTRAINT IF EXISTS landing_pages_client_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_pages_client_slug_active
  ON landing_pages (client, slug)
  WHERE deleted_at IS NULL;

-- ── landing_pages: short_url UNIQUE → partial ──
ALTER TABLE landing_pages DROP CONSTRAINT IF EXISTS landing_pages_short_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_pages_short_url_active
  ON landing_pages (short_url)
  WHERE deleted_at IS NULL AND short_url IS NOT NULL;

-- ── campaigns: slug UNIQUE → partial ──
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaigns_slug_active
  ON campaigns (slug)
  WHERE deleted_at IS NULL;

-- ── performance_reports: slug UNIQUE → partial ──
ALTER TABLE performance_reports DROP CONSTRAINT IF EXISTS performance_reports_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_performance_reports_slug_active
  ON performance_reports (slug)
  WHERE deleted_at IS NULL;

-- Helpful covering indexes for the most common filtered lookups
CREATE INDEX IF NOT EXISTS idx_landing_pages_workspace_active
  ON landing_pages (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_active
  ON campaigns (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_workspace_active
  ON performance_reports (workspace_id) WHERE deleted_at IS NULL;
