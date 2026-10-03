-- Campaign URLs that follow the campaign's name.
--
-- A new campaign takes its URL from its name, but a duplicate took its
-- source's address and kept it after being renamed ("Billboards" lived at
-- rosh-hashana-2026-…). slug_auto marks a URL nobody typed by hand: while the
-- campaign is a draft, renaming it moves the URL too. Typing a URL or
-- publishing clears it. Existing campaigns read false, so no live link moves.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS slug_auto BOOLEAN NOT NULL DEFAULT false;
