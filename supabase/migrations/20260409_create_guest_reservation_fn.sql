-- Function to create a reservation for another user (used when accepting open spot requests)
-- SECURITY DEFINER bypasses RLS so the spot owner can create a booking for the accepted player

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
  INSERT INTO reservations (court_id, user_id, club_id, start_time, end_time, status, amount_paid, notes, booking_source)
  VALUES (p_court_id, p_user_id, p_club_id, p_start_time, p_end_time, 'confirmed', 0, p_notes, 'system')
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;
