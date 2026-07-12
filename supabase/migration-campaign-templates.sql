-- Campaign templates (Batch 4)
-- A template is a reusable campaign skeleton: excluded from the normal list and
-- never served publicly. New campaigns are spun up by duplicating a template.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_campaigns_is_template ON campaigns (is_template) WHERE is_template = true;
