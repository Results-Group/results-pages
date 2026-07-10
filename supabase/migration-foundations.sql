-- Migration: Foundations — soft-delete (recycle bin) for pages & campaigns
-- Adds deleted_at so deletes become reversible; physical purge is a separate action.

ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE campaigns     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Fast filtering of live vs trashed rows
CREATE INDEX IF NOT EXISTS idx_landing_pages_deleted_at ON landing_pages (deleted_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at     ON campaigns (deleted_at);
