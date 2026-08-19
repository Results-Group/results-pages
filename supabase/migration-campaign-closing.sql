-- Editable closing-slide title.
--
-- The deck always ends with a closing slide; its title was hardcoded
-- 'בהצלחה!' in the slide builder. NULL means "use the default" — existing
-- campaigns don't change.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS closing_title TEXT;
