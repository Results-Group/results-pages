-- ── Scheduled publish (start date) ──
-- Adds an optional publish_at timestamp. When set to a future time, the page /
-- campaign is treated as not-yet-available on the public routes (in addition to
-- the existing expires_at / status gates).

ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_landing_pages_publish_at ON landing_pages(publish_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_publish_at ON campaigns(publish_at);
