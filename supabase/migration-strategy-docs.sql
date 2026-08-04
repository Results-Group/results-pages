-- Strategy documents (מסמכי אסטרטגיה).
--
-- One row per document, with the slides in `sections` JSONB — the same shape as
-- campaigns, because the same editor pattern rides on it. The first (and today
-- only) doc_type is the brand-positioning deck; a second type is a one-line
-- CHECK change rather than a new table.
--
-- Deliberately absent, per the product decision: password, publish_at,
-- expires_at. These links stay open. `status` remains so a half-built document
-- is not served at its public URL.

CREATE TABLE IF NOT EXISTS strategy_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL DEFAULT 'brand_positioning'
    CHECK (doc_type IN ('brand_positioning')),
  -- Denormalised display name plus the real link, exactly as campaigns and
  -- reports do: the name is what the deck prints, the id is what branding and
  -- permissions resolve through.
  client TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  doc_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  -- Overrides the client record's logo when set; NULL inherits it.
  logo_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  created_by UUID REFERENCES admin_users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index rather than a UNIQUE column: a soft-deleted document
-- sitting in the recycle bin must not hold its slug hostage. Same reasoning as
-- migration-partial-unique.sql for pages and campaigns.
CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_slug_live
  ON strategy_docs (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_strategy_workspace
  ON strategy_docs (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_strategy_client
  ON strategy_docs (client_id) WHERE deleted_at IS NULL;

ALTER TABLE strategy_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on strategy_docs" ON strategy_docs;
CREATE POLICY "Service role full access on strategy_docs"
  ON strategy_docs FOR ALL USING (true) WITH CHECK (true);

-- The audit log's entity_type is a CHECK constraint, so a new entity type has
-- to be added here as well as in AuditEntity — otherwise every logAudit call
-- for this product fails silently and the trail simply has a hole in it.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('campaign', 'page', 'client', 'user', 'workspace', 'report', 'strategy_doc'));
