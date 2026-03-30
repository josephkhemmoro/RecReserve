-- =============================================================
-- Migration: Allow admins to delete notifications for club members
-- Date: 2026-03-28
-- Enables: Admins deleting announcements from member inboxes
-- =============================================================

CREATE POLICY "Admins can delete notifications for club members"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.club_id IN (
        SELECT u2.club_id FROM users u2
        WHERE u2.id = auth.uid() AND u2.role = 'admin'
      )
    )
  );
