-- Add progress tracking to roadmap features
-- Frontend already reads feature.progress || 50 for in_progress items
ALTER TABLE roadmap_features ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);
