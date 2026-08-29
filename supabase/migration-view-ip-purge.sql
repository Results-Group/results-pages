-- Viewer IPs were written on every public deck / landing-page view and never
-- read back: the only readers are getDeckViewRows (content_id, viewed_at) and
-- a head count. So the column held personal data that served no purpose, grew
-- without bound, and was copied into every nightly backup.
--
-- The application stopped writing it in the same change as this file. This
-- clears what was already collected. The column itself stays: dropping it
-- would break the restore path for backups taken before today, and a NULL
-- column costs nothing.
--
-- Idempotent — re-running finds nothing left to clear.
UPDATE deck_views SET ip = NULL WHERE ip IS NOT NULL;
UPDATE landing_page_views SET ip = NULL WHERE ip IS NOT NULL;
