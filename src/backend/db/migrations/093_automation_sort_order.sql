-- Add sort order to automation rules for drag-and-drop reordering
ALTER TABLE automation_rules ADD COLUMN sort_order INTEGER DEFAULT 0;
