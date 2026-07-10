-- Patch for existing clients table that has a different schema.
-- Adds the columns our app expects without destroying existing data.

-- Add missing columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_path TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#40e1d3';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contacts JSONB NOT NULL DEFAULT '[]';

-- Ensure RLS policy exists
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on clients" ON clients;
CREATE POLICY "Service role full access on clients" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_global_name ON clients(name) WHERE workspace_id IS NULL;

-- FK columns on landing_pages and campaigns
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE campaigns     ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Backfill: one client row per distinct (workspace_id, client_name) from existing pages/campaigns
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

-- Link existing rows
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
