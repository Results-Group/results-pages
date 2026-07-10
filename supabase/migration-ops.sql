-- Migration: Operations — audit log
-- Records who did what/when across create/edit/delete actions.

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,          -- create | update | delete | restore | publish | purge
  entity_type TEXT NOT NULL,     -- campaign | page | client | user | workspace
  entity_id TEXT,
  entity_label TEXT,
  workspace_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id);
