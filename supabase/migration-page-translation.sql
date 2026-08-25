-- Built-in English translation for uploaded HTML landing pages.
-- The English render lives as a sibling storage object (X.en.html) served at
-- ?lang=en; these columns track it. en_stale flips true when the Hebrew
-- source is edited after translation (re-translate is manual, on demand).
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS en_file_path TEXT;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS en_translated_at TIMESTAMPTZ;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS en_stale BOOLEAN NOT NULL DEFAULT false;
