-- =============================================================
-- Migration: Add RLS policies for notifications table
-- Date: 2026-03-28
-- Fixes: Admins unable to insert announcement notifications
-- =============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admins: can insert notifications for users in their club
CREATE POLICY "Admins can insert notifications for club members"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.club_id IN (
        SELECT u2.club_id FROM users u2
        WHERE u2.id = auth.uid() AND u2.role = 'admin'
      )
    )
  );

-- Users: can read and update their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins: can delete notifications for users in their club
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
