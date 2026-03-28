-- Add settings fields to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS website text;
