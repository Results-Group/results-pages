-- Add monday_item_id to clients for robust deduplication across renames
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monday_item_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_monday_item_id
  ON clients(monday_item_id)
  WHERE monday_item_id IS NOT NULL;
