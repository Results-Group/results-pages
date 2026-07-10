-- Performance reports table
CREATE TABLE IF NOT EXISTS performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  report_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  period_label TEXT,
  tabs JSONB NOT NULL DEFAULT '[]',
  tabs_en JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  publish_at TIMESTAMPTZ,
  password TEXT,
  logo_path TEXT,
  brand_color TEXT,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  created_by UUID REFERENCES admin_users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_slug ON performance_reports(slug);
CREATE INDEX IF NOT EXISTS idx_reports_workspace ON performance_reports(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_client ON performance_reports(client_id) WHERE deleted_at IS NULL;

-- RLS (service-role bypasses; matches campaigns pattern)
ALTER TABLE performance_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'performance_reports' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON performance_reports FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Allow audit_log to reference 'report' entity type
DO $$ BEGIN
  ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
    CHECK (entity_type IN ('campaign', 'page', 'client', 'user', 'workspace', 'report'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
