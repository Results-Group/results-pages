-- Backup bookkeeping
--
-- A backup that fails silently is worse than none, because it buys confidence
-- without cover. Every run records what it captured so a gap is visible.

CREATE TABLE IF NOT EXISTS backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ok BOOLEAN NOT NULL DEFAULT false,
  -- Rows written to the database snapshot
  table_rows INTEGER NOT NULL DEFAULT 0,
  -- Files present in storage at snapshot time, and how many were newly copied
  files_total INTEGER NOT NULL DEFAULT 0,
  files_copied INTEGER NOT NULL DEFAULT 0,
  bytes_copied BIGINT NOT NULL DEFAULT 0,
  snapshot_path TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_runs_started_idx ON backup_runs (started_at DESC);

ALTER TABLE backup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on backup_runs" ON backup_runs;
CREATE POLICY "Service role full access on backup_runs"
  ON backup_runs FOR ALL USING (true) WITH CHECK (true);

-- Which storage objects have already been copied, so a nightly run moves only
-- what changed. 353 MB of assets re-copied every night would be pure waste.
CREATE TABLE IF NOT EXISTS backup_file_manifest (
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  -- Source object's last-modified, as reported by storage
  source_updated_at TEXT,
  copied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, path)
);

ALTER TABLE backup_file_manifest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on backup_file_manifest" ON backup_file_manifest;
CREATE POLICY "Service role full access on backup_file_manifest"
  ON backup_file_manifest FOR ALL USING (true) WITH CHECK (true);

-- Private bucket for the snapshots themselves.
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;
