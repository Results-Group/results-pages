-- Monday feedback board (Batch 5 revision)
-- Each campaign gets its own row (item) on the dedicated feedback board; client
-- approvals/rejections are posted as updates on that item. Store the item id so
-- subsequent feedback appends to the same row instead of creating new ones.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS monday_feedback_item_id TEXT;
