-- Migration for results-pages admin panel
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)

-- ── Tables ──

CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client, slug)
);

CREATE TABLE IF NOT EXISTS landing_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES landing_pages(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  ip TEXT,
  user_agent TEXT
);

-- ── RLS ──

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on landing_pages"
  ON landing_pages FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on landing_page_views"
  ON landing_page_views FOR ALL USING (true) WITH CHECK (true);

-- ── Helper RPC for batch view counting ──

CREATE OR REPLACE FUNCTION count_landing_page_views(page_ids UUID[])
RETURNS TABLE(page_id UUID, count BIGINT) AS $$
  SELECT page_id, COUNT(*) as count
  FROM landing_page_views
  WHERE page_id = ANY(page_ids)
  GROUP BY page_id;
$$ LANGUAGE sql STABLE;

-- ── Version history ──

CREATE TABLE IF NOT EXISTS landing_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  label TEXT
);

ALTER TABLE landing_page_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on landing_page_versions"
  ON landing_page_versions FOR ALL USING (true) WITH CHECK (true);

-- ── Password protection ──
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS password TEXT DEFAULT NULL;

-- ── Short URLs ──
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS short_url TEXT UNIQUE DEFAULT NULL;

-- ── Storage bucket ──
-- Create a storage bucket called "landing-pages" via the Supabase dashboard:
--   Storage > New Bucket > Name: "landing-pages" > Public: OFF
-- Or run:
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-pages', 'landing-pages', false)
ON CONFLICT (id) DO NOTHING;
