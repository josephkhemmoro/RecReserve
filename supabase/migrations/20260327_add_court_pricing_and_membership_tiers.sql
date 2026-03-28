-- =============================================================
-- Migration: Court pricing + membership tiers
-- Date: 2026-03-27
-- =============================================================

-- 1. Add pricing columns to courts
ALTER TABLE courts
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;

-- 2. Create membership_tiers table
CREATE TABLE IF NOT EXISTS membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CONSTRAINT discount_percent_range CHECK (discount_percent >= 0 AND discount_percent <= 100),
  can_book_free BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add tier_id to memberships
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES membership_tiers(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_membership_tiers_club_id ON membership_tiers(club_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tier_id ON memberships(tier_id);

-- 5. Enable RLS
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD on tiers belonging to their club
CREATE POLICY "Admins can manage tiers for their club"
  ON membership_tiers
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT u.club_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT u.club_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Players: read-only access to tiers in their club
CREATE POLICY "Players can view tiers for their club"
  ON membership_tiers
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT m.club_id FROM memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = true
    )
  );
