-- ============================================
-- FEED EVENTS TABLE
-- ============================================

CREATE TABLE feed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view feed"
  ON feed_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.club_id = feed_events.club_id
      AND memberships.user_id = auth.uid()
      AND memberships.is_active = true
    )
  );

CREATE POLICY "Service role can manage feed"
  ON feed_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_feed_events_club_created ON feed_events(club_id, created_at DESC);

-- ============================================
-- FEED TRIGGERS
-- ============================================

-- Trigger 1: Booking feed event
CREATE OR REPLACE FUNCTION insert_booking_feed_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    INSERT INTO feed_events (club_id, actor_id, event_type, metadata)
    SELECT
      NEW.club_id,
      NEW.user_id,
      'booking',
      jsonb_build_object(
        'court_name', c.name,
        'sport', c.sport,
        'start_time', NEW.start_time::text
      )
    FROM courts c WHERE c.id = NEW.court_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_booking_feed
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION insert_booking_feed_event();

-- Trigger 2: Kudos feed event
CREATE OR REPLACE FUNCTION insert_kudos_feed_event()
RETURNS TRIGGER AS $$
DECLARE
  receiver_name text;
BEGIN
  SELECT full_name INTO receiver_name FROM users WHERE id = NEW.receiver_id;
  INSERT INTO feed_events (club_id, actor_id, event_type, metadata)
  VALUES (
    NEW.club_id,
    NEW.sender_id,
    'kudos',
    jsonb_build_object('receiver_name', COALESCE(receiver_name, 'a teammate'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_kudos_feed
  AFTER INSERT ON kudos
  FOR EACH ROW
  EXECUTE FUNCTION insert_kudos_feed_event();

-- Trigger 3: Member joined feed event
CREATE OR REPLACE FUNCTION insert_member_joined_feed_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    INSERT INTO feed_events (club_id, actor_id, event_type, metadata)
    VALUES (NEW.club_id, NEW.user_id, 'member_joined', '{}');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_member_joined_feed
  AFTER INSERT ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION insert_member_joined_feed_event();

-- Trigger 4: Event created feed event
CREATE OR REPLACE FUNCTION insert_event_created_feed_event()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT u.id INTO admin_user_id
  FROM users u
  JOIN memberships m ON m.user_id = u.id
  WHERE m.club_id = NEW.club_id AND u.role = 'admin' AND m.is_active = true
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    INSERT INTO feed_events (club_id, actor_id, event_type, metadata)
    VALUES (
      NEW.club_id,
      admin_user_id,
      'event_created',
      jsonb_build_object(
        'event_title', NEW.title,
        'event_type', NEW.event_type,
        'event_date', NEW.start_time::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_event_created_feed
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION insert_event_created_feed_event();

-- ============================================
-- OPEN SPOTS TABLE
-- ============================================

CREATE TABLE open_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  spots_needed integer NOT NULL DEFAULT 1,
  description text,
  skill_level text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(reservation_id)
);

ALTER TABLE open_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view open spots"
  ON open_spots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.club_id = open_spots.club_id
      AND memberships.user_id = auth.uid()
      AND memberships.is_active = true
    )
  );

CREATE POLICY "Users can create own open spots"
  ON open_spots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own open spots"
  ON open_spots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own open spots"
  ON open_spots FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SPOT REQUESTS TABLE
-- ============================================

CREATE TABLE spot_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_spot_id uuid REFERENCES open_spots(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(open_spot_id, requester_id)
);

ALTER TABLE spot_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON spot_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR EXISTS (
      SELECT 1 FROM open_spots
      WHERE open_spots.id = spot_requests.open_spot_id
      AND open_spots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create requests"
  ON spot_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Spot owners can manage requests"
  ON spot_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM open_spots
      WHERE open_spots.id = spot_requests.open_spot_id
      AND open_spots.user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_open_spots_club_active ON open_spots(club_id, is_active) WHERE is_active = true;
CREATE INDEX idx_open_spots_reservation ON open_spots(reservation_id);
CREATE INDEX idx_spot_requests_spot ON spot_requests(open_spot_id);
CREATE INDEX idx_spot_requests_requester ON spot_requests(requester_id);
