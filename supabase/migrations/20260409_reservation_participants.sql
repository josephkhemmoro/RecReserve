-- Reservation participants — tracks players who joined a reservation (via open spots, invites, etc.)
-- Separate from the reservation owner (user_id on reservations table)

CREATE TABLE IF NOT EXISTS reservation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'guest', 'substitute')),
  added_by uuid REFERENCES auth.users(id),
  source text DEFAULT 'open_spot' CHECK (source IN ('open_spot', 'invite', 'manual', 'group')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (reservation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_res_participants_reservation ON reservation_participants(reservation_id);
CREATE INDEX IF NOT EXISTS idx_res_participants_user ON reservation_participants(user_id);

ALTER TABLE reservation_participants ENABLE ROW LEVEL SECURITY;

-- Users can see reservations they're participating in
CREATE POLICY "Users view own participations" ON reservation_participants FOR SELECT
  USING (user_id = auth.uid());

-- Reservation owners can manage participants
CREATE POLICY "Reservation owners manage participants" ON reservation_participants FOR ALL
  USING (reservation_id IN (SELECT id FROM reservations WHERE user_id = auth.uid()))
  WITH CHECK (reservation_id IN (SELECT id FROM reservations WHERE user_id = auth.uid()));

-- Users can leave (delete their own participation)
CREATE POLICY "Users can leave reservations" ON reservation_participants
  FOR DELETE USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role manages participants" ON reservation_participants FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Update the guest reservation function to add a participant instead of creating a new reservation
CREATE OR REPLACE FUNCTION create_guest_reservation(
  p_court_id uuid,
  p_user_id uuid,
  p_club_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id uuid;
BEGIN
  -- Find the existing reservation on this court/time
  SELECT id INTO v_reservation_id
  FROM reservations
  WHERE court_id = p_court_id
    AND start_time = p_start_time
    AND end_time = p_end_time
    AND status = 'confirmed'
  LIMIT 1;

  IF v_reservation_id IS NULL THEN
    -- No existing reservation found — this shouldn't happen for open spots
    -- but handle it gracefully by creating one
    INSERT INTO reservations (court_id, user_id, club_id, start_time, end_time, status, amount_paid, notes, booking_source)
    VALUES (p_court_id, p_user_id, p_club_id, p_start_time, p_end_time, 'confirmed', 0, p_notes, 'system')
    RETURNING id INTO v_reservation_id;

    RETURN v_reservation_id;
  END IF;

  -- Add as participant to the existing reservation
  INSERT INTO reservation_participants (reservation_id, user_id, role, added_by, source)
  VALUES (v_reservation_id, p_user_id, 'player', auth.uid(), 'open_spot')
  ON CONFLICT (reservation_id, user_id) DO NOTHING;

  -- Increment guest count on the reservation
  UPDATE reservations
  SET guest_count = guest_count + 1
  WHERE id = v_reservation_id;

  RETURN v_reservation_id;
END;
$$;
