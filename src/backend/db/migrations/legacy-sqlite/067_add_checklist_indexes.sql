-- Add missing index on checklists(user_id) for query performance
-- The checklists table queries always filter by user_id but had no index
CREATE INDEX IF NOT EXISTS idx_checklists_user ON checklists(user_id);

-- Compound index for common checklist_items queries filtering by user + completion status
CREATE INDEX IF NOT EXISTS idx_checklist_items_user_completed ON checklist_items(user_id, completed);

-- DOWN: DROP INDEX IF EXISTS idx_checklists_user;
-- DOWN: DROP INDEX IF EXISTS idx_checklist_items_user_completed;
