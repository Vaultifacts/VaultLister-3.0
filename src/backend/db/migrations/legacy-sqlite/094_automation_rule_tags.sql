-- Add tags to automation rules
ALTER TABLE automation_rules ADD COLUMN tags TEXT DEFAULT '[]';

-- DOWN: ALTER TABLE automation_rules DROP COLUMN IF EXISTS tags;
