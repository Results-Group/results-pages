-- Migration: Client approval loop — per-slide feedback
-- One row per (campaign, slide) holding the current status + latest comment.

CREATE TABLE IF NOT EXISTS slide_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  slide_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'rejected', 'pending')),
  comment TEXT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, slide_key)
);

ALTER TABLE slide_feedback ENABLE ROW LEVEL SECURITY;
-- Scoped to service_role only; anon/authenticated get no direct table access.
-- DROP + CREATE keeps this migration safe to re-run.
DROP POLICY IF EXISTS "Service role full access on slide_feedback" ON slide_feedback;
CREATE POLICY "Service role full access on slide_feedback" ON slide_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_slide_feedback_campaign ON slide_feedback (campaign_id);
