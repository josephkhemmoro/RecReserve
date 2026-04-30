-- Editable benefits list for membership tiers.
ALTER TABLE membership_tiers
  ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';
