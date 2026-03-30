-- Add club_id to notifications for club context display
ALTER TABLE notifications ADD COLUMN club_id uuid REFERENCES clubs(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_club ON notifications(club_id);
