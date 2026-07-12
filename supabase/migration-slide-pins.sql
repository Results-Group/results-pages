-- Migration: Figma-style pin comments on campaign creatives (Batch 3)
-- Multiple pins per (campaign, slide, asset); x/y are relative coords (0..1) on the image.

CREATE TABLE IF NOT EXISTS slide_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  slide_key TEXT NOT NULL,
  asset_id TEXT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  comment TEXT,
  author TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE slide_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on slide_pins" ON slide_pins;
CREATE POLICY "Service role full access on slide_pins" ON slide_pins FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_slide_pins_campaign ON slide_pins (campaign_id);
