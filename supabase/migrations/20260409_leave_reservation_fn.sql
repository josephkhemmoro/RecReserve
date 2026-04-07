-- Function to cleanly remove a participant from a reservation
-- Handles: participant deletion, guest count decrement, spot request cleanup, spot reactivation
-- SECURITY DEFINER bypasses RLS so any participant or the owner can trigger this

CREATE OR REPLACE FUNCTION leave_reservation(
  p_reservation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from participants
  DELETE FROM reservation_participants
  WHERE reservation_id = p_reservation_id AND user_id = p_user_id;

  -- Decrement guest count (floor at 0)
  UPDATE reservations
  SET guest_count = GREATEST(0, guest_count - 1)
  WHERE id = p_reservation_id;

  -- Clean up spot request for this user
  DELETE FROM spot_requests
  WHERE requester_id = p_user_id
    AND open_spot_id IN (
      SELECT id FROM open_spots WHERE reservation_id = p_reservation_id
    );

  -- Re-activate the open spot so others can join
  UPDATE open_spots
  SET is_active = true
  WHERE reservation_id = p_reservation_id;

  RETURN true;
END;
$$;
