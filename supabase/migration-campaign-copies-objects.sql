-- Copies were originally stored as plain strings (["text A", "text B"]). The
-- targeting feature needs stable per-copy IDs and an optional label
-- ("לגברים", "לנשים"), so each entry becomes {id, label, body}. Runtime code
-- also tolerates the old shape, but this migration converts existing rows
-- once. Idempotent: rows already in object form are untouched.

UPDATE campaigns
SET copies = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem) = 'string' THEN
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'label', '',
            'body', elem
          )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(copies) AS elem
)
WHERE copies IS NOT NULL
  AND jsonb_typeof(copies) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(copies) AS e
    WHERE jsonb_typeof(e) = 'string'
  );
