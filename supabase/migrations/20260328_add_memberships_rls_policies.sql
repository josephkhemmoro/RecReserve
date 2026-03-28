-- =============================================================
-- Migration: Add RLS policies for memberships table
-- Date: 2026-03-28
-- Fixes: Admins unable to assign/update memberships for club members
-- =============================================================

-- Ensure RLS is enabled
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD on memberships belonging to their club
CREATE POLICY "Admins can manage memberships for their club"
  ON memberships
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

-- Players: can read their own membership
CREATE POLICY "Players can view their own membership"
  ON memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
