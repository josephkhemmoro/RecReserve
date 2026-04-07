-- Fix validate_booking function: use make_interval instead of string concat for interval math
-- Also make membership lookup more lenient (allow NULL status for backward compat)

CREATE OR REPLACE FUNCTION validate_booking(
  p_user_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_guest_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_membership record;
  v_tier_id uuid;
  v_duration_mins integer;
  v_rules record;
  v_policy record;
  v_active_count integer;
  v_daily_count integer;
  v_conflict_count integer;
  v_closure_count integer;
  v_errors text[] := '{}';
  v_warnings text[] := '{}';
BEGIN
  -- Calculate duration
  v_duration_mins := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;

  -- Get user membership (allow NULL status for backward compat)
  SELECT m.id AS membership_id, m.user_id, m.club_id, m.tier_id, m.is_active, m.status,
         m.guest_allowance, mt.discount_percent, mt.can_book_free
  INTO v_membership
  FROM memberships m
  LEFT JOIN membership_tiers mt ON mt.id = m.tier_id
  WHERE m.user_id = p_user_id
    AND m.club_id = p_club_id
    AND m.is_active = true
    AND (m.status IS NULL OR m.status IN ('active', 'trial'))
  LIMIT 1;

  IF v_membership IS NULL THEN
    v_errors := array_append(v_errors, 'NO_ACTIVE_MEMBERSHIP: You must have an active membership to book.');
    RETURN jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors), 'warnings', to_jsonb(v_warnings));
  END IF;

  v_tier_id := v_membership.tier_id;

  -- Get club default rules
  SELECT * INTO v_rules
  FROM booking_rules
  WHERE club_id = p_club_id
  LIMIT 1;

  -- Check advance booking window
  IF v_rules IS NOT NULL AND v_rules.advance_booking_days IS NOT NULL THEN
    IF p_start_time > (now() + make_interval(days => v_rules.advance_booking_days)) THEN
      v_errors := array_append(v_errors,
        format('ADVANCE_LIMIT: Cannot book more than %s days in advance.', v_rules.advance_booking_days));
    END IF;
  END IF;

  -- Check booking is in the future
  IF p_start_time <= now() THEN
    v_errors := array_append(v_errors, 'PAST_TIME: Cannot book a time that has already passed.');
  END IF;

  -- Check duration limits
  IF v_rules IS NOT NULL AND v_rules.max_booking_duration_mins IS NOT NULL THEN
    IF v_duration_mins > v_rules.max_booking_duration_mins THEN
      v_errors := array_append(v_errors,
        format('DURATION_EXCEEDED: Maximum booking duration is %s minutes.', v_rules.max_booking_duration_mins));
    END IF;
  END IF;

  -- Check max active reservations
  IF v_rules IS NOT NULL AND v_rules.max_active_bookings_per_user IS NOT NULL THEN
    SELECT count(*) INTO v_active_count
    FROM reservations
    WHERE user_id = p_user_id
      AND club_id = p_club_id
      AND status = 'confirmed'
      AND start_time > now();

    IF v_active_count >= v_rules.max_active_bookings_per_user THEN
      v_errors := array_append(v_errors,
        format('MAX_ACTIVE: You already have %s active reservations (limit: %s).', v_active_count, v_rules.max_active_bookings_per_user));
    END IF;
  END IF;

  -- Check court conflicts (double booking)
  SELECT count(*) INTO v_conflict_count
  FROM reservations
  WHERE court_id = p_court_id
    AND status IN ('confirmed', 'pending_payment')
    AND start_time < p_end_time
    AND end_time > p_start_time;

  IF v_conflict_count > 0 THEN
    v_errors := array_append(v_errors, 'CONFLICT: This time slot is already booked.');
  END IF;

  -- Check court closures
  SELECT count(*) INTO v_closure_count
  FROM court_closures
  WHERE court_id = p_court_id
    AND starts_at < p_end_time
    AND ends_at > p_start_time;

  IF v_closure_count > 0 THEN
    v_errors := array_append(v_errors, 'COURT_CLOSED: This court is closed during the requested time.');
  END IF;

  -- Check guest allowance from membership
  IF v_membership.guest_allowance IS NOT NULL AND p_guest_count > v_membership.guest_allowance THEN
    v_errors := array_append(v_errors,
      format('GUEST_LIMIT: Your membership allows up to %s guests per booking.', v_membership.guest_allowance));
  END IF;

  -- Check tier-specific policies (higher priority overrides)
  FOR v_policy IN
    SELECT * FROM booking_policies
    WHERE club_id = p_club_id
      AND is_active = true
      AND (tier_id IS NULL OR tier_id = v_tier_id)
      AND (court_id IS NULL OR court_id = p_court_id)
      AND (blackout_start IS NULL OR NOT (CURRENT_DATE BETWEEN blackout_start AND blackout_end))
    ORDER BY priority DESC
  LOOP
    -- Check policy-specific advance booking
    IF v_policy.advance_booking_days IS NOT NULL THEN
      IF p_start_time > (now() + make_interval(days => v_policy.advance_booking_days)) THEN
        v_errors := array_append(v_errors,
          format('POLICY_%s: Cannot book more than %s days in advance.', v_policy.name, v_policy.advance_booking_days));
      END IF;
    END IF;

    -- Check policy-specific max duration
    IF v_policy.max_booking_duration_mins IS NOT NULL AND v_duration_mins > v_policy.max_booking_duration_mins THEN
      v_errors := array_append(v_errors,
        format('POLICY_%s: Maximum booking duration is %s minutes.', v_policy.name, v_policy.max_booking_duration_mins));
    END IF;

    -- Check policy-specific guest count
    IF v_policy.max_guest_count IS NOT NULL AND p_guest_count > v_policy.max_guest_count THEN
      v_errors := array_append(v_errors,
        format('POLICY_%s: Maximum %s guests allowed.', v_policy.name, v_policy.max_guest_count));
    END IF;

    -- Check blackout dates
    IF v_policy.blackout_start IS NOT NULL
      AND p_start_time::date BETWEEN v_policy.blackout_start AND v_policy.blackout_end THEN
      v_errors := array_append(v_errors,
        format('BLACKOUT: %s', COALESCE(v_policy.blackout_reason, 'This date is blocked for bookings.')));
    END IF;

    -- Check max active from policy
    IF v_policy.max_active_reservations IS NOT NULL THEN
      SELECT count(*) INTO v_active_count
      FROM reservations
      WHERE user_id = p_user_id
        AND club_id = p_club_id
        AND status = 'confirmed'
        AND start_time > now();

      IF v_active_count >= v_policy.max_active_reservations THEN
        v_errors := array_append(v_errors,
          format('POLICY_%s: Maximum %s active reservations.', v_policy.name, v_policy.max_active_reservations));
      END IF;
    END IF;
  END LOOP;

  -- Build result
  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors), 'warnings', to_jsonb(v_warnings));
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'errors', to_jsonb(v_errors),
    'warnings', to_jsonb(v_warnings),
    'membership_id', v_membership.membership_id,
    'tier_id', v_tier_id,
    'discount_percent', COALESCE(v_membership.discount_percent, 0),
    'can_book_free', COALESCE(v_membership.can_book_free, false)
  );
END;
$$;
