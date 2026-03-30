-- Index for efficient no-show and status-based queries
CREATE INDEX IF NOT EXISTS idx_reservations_status_club ON reservations(club_id, status, start_time);
