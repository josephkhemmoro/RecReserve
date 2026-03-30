-- Update booking feed trigger to remove sport from metadata
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
        'start_time', NEW.start_time::text
      )
    FROM courts c WHERE c.id = NEW.court_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
