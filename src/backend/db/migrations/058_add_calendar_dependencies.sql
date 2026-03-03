-- Add dependency tracking between calendar events
ALTER TABLE calendar_events ADD COLUMN depends_on TEXT DEFAULT NULL;
