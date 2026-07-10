-- Migration: Client entity system
-- Promotes free-text "client" into a managed entity (logo, brand color, contacts).
-- Keeps landing_pages.client / campaigns.client TEXT for display + back-compat;
-- adds nullable client_id FK and backfills from distinct (workspace_id, client).

-- ── Clients table ──
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  logo_path TEXT,
  brand_color TEXT DEFAULT '#40e1d3',
  contacts JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, name)
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on clients" ON clients FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients (workspace_id);

-- UNIQUE(workspace_id, name) treats NULLs as distinct, so global (workspace-less)
-- clients need their own partial unique index to prevent duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_global_name ON clients(name) WHERE workspace_id IS NULL;

-- ── client_id FKs ──
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE campaigns     ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- ── Backfill: one client per distinct (workspace_id, client) ──
-- NOT EXISTS guard keeps the insert idempotent for NULL-workspace rows too
-- (ON CONFLICT (workspace_id, name) never fires for NULLs); the targetless
-- ON CONFLICT DO NOTHING covers races against either unique constraint.
INSERT INTO clients (workspace_id, name)
SELECT DISTINCT src.workspace_id, src.client
FROM (
  SELECT workspace_id, client FROM landing_pages WHERE client IS NOT NULL AND client <> ''
  UNION
  SELECT workspace_id, client FROM campaigns WHERE client IS NOT NULL AND client <> ''
) src
WHERE NOT EXISTS (
  SELECT 1 FROM clients c
  WHERE c.name = src.client
    AND (c.workspace_id IS NOT DISTINCT FROM src.workspace_id)
)
ON CONFLICT DO NOTHING;

-- Link existing rows to the backfilled client entities
UPDATE landing_pages lp
SET client_id = c.id
FROM clients c
WHERE lp.client_id IS NULL
  AND c.name = lp.client
  AND (c.workspace_id IS NOT DISTINCT FROM lp.workspace_id);

UPDATE campaigns cm
SET client_id = c.id
FROM clients c
WHERE cm.client_id IS NULL
  AND c.name = cm.client
  AND (c.workspace_id IS NOT DISTINCT FROM cm.workspace_id);

CREATE INDEX IF NOT EXISTS idx_landing_pages_client_id ON landing_pages (client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns (client_id);
