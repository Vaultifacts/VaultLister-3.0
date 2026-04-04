ALTER TABLE checklist_items ADD COLUMN notes TEXT DEFAULT '';
ALTER TABLE checklist_items ADD COLUMN attachments TEXT DEFAULT '[]';

-- DOWN: ALTER TABLE checklist_items DROP COLUMN IF EXISTS notes;
-- DOWN: ALTER TABLE checklist_items DROP COLUMN IF EXISTS attachments;
