-- Enable RLS on events if not already enabled
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Admins can manage events for their club
CREATE POLICY "Club admins can manage events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.club_id = events.club_id
      AND m.user_id = auth.uid()
      AND u.role = 'admin'
      AND m.is_active = true
    )
  );

-- Club members can view events
CREATE POLICY "Club members can view events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.club_id = events.club_id
      AND memberships.user_id = auth.uid()
      AND memberships.is_active = true
    )
  );

-- Enable RLS on event_registrations if not already enabled
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations"
  ON event_registrations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can register for events
CREATE POLICY "Users can register for events"
  ON event_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all registrations for their club's events
CREATE POLICY "Admins can view event registrations"
  ON event_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN memberships m ON m.club_id = e.club_id
      JOIN users u ON u.id = m.user_id
      WHERE e.id = event_registrations.event_id
      AND m.user_id = auth.uid()
      AND u.role = 'admin'
      AND m.is_active = true
    )
  );
