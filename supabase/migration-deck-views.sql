-- Deck/report/strategy view tracking: until now staff had no way to know
-- whether a client ever opened a link (landing pages had views; decks didn't).
-- Raw rows, aggregated in JS — mirrors landing_page_views.
CREATE TABLE IF NOT EXISTS deck_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('campaign','report','strategy')),
  -- No FK: content_id spans three tables. Purge flows may best-effort delete.
  content_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS deck_views_content_idx ON deck_views (content_type, content_id);

ALTER TABLE deck_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on deck_views" ON deck_views;
CREATE POLICY "Service role full access on deck_views" ON deck_views
  FOR ALL USING (true) WITH CHECK (true);
