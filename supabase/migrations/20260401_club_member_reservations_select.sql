-- Allow active club members to read reservations in their club so
-- court availability and open spot joins work consistently for players.
CREATE POLICY "Club members can view club reservations"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.club_id = reservations.club_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );
