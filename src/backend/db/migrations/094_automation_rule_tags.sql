-- Add tags to automation rules
ALTER TABLE automation_rules ADD COLUMN tags TEXT DEFAULT '[]';
