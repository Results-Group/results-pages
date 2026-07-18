-- Campaign end date + auto-archive
-- Every campaign gets an end date (enforced in the editor to be at least 4 weeks
-- out). A daily cron archives campaigns past their end date so stale creative
-- stops taking up active space. Nullable so existing rows aren't forced.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_campaigns_expires_at ON campaigns (expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
