-- Allow players to join clubs from the mobile app by creating their own
-- membership rows. Admin CRUD is still handled by the existing admin policy.
CREATE POLICY "Players can join clubs for themselves"
  ON memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_active = true
  );

-- Allow players to leave a club by deactivating their own membership row.
CREATE POLICY "Players can leave their own membership"
  ON memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_active = false
  );
