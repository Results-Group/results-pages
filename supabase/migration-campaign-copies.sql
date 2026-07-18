-- Campaign copy versions (copy-switcher feature)
-- The editor stores an array of ad-copy variants per campaign (meta.copies) and
-- each slide can opt into showing them (section.useCopies). The column was used
-- by the app before it existed in the DB, which made every campaign save fail —
-- this adds it. jsonb array of strings, matching how `sections` is stored.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS copies JSONB NOT NULL DEFAULT '[]'::jsonb;
