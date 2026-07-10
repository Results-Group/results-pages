-- Migration: Workspaces + workspace_members + per-workspace permissions
-- Run in Supabase SQL Editor

-- ── Workspaces table ──
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#40e1d3',
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on workspaces" ON workspaces;
CREATE POLICY "Service role full access on workspaces" ON workspaces FOR ALL USING (true) WITH CHECK (true);

-- ── Workspace members (user ↔ workspace with role + permission overrides) ──
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on workspace_members" ON workspace_members;
CREATE POLICY "Service role full access on workspace_members" ON workspace_members FOR ALL USING (true) WITH CHECK (true);

-- ── Add is_owner flag to admin_users (global super-admin) ──
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;

-- ── Add workspace_id FK to landing_pages ──
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- ── Add workspace_id FK to campaigns ──
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- ── Seed default workspace and migrate existing data ──
INSERT INTO workspaces (id, name, slug, color, icon)
VALUES ('00000000-0000-0000-0000-000000000001', 'Results', 'results', '#40e1d3', 'building')
ON CONFLICT (slug) DO NOTHING;

-- Attach all existing pages and campaigns to the default workspace
UPDATE landing_pages SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE campaigns SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;

-- Make the first admin user an owner
UPDATE admin_users SET is_owner = true WHERE email = 'info@resultsdigital.org';

-- Add all existing users as members of the default workspace with their current role
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, role FROM admin_users
ON CONFLICT (workspace_id, user_id) DO NOTHING;
