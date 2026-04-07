-- Trust Foundation Migration
-- Adds: booking policies, payment records, audit logs, membership lifecycle,
--        granular roles, server-side validation support

BEGIN;

-- ============================================================
-- 1. Granular user roles
-- ============================================================
-- Expand the role system. Keep backward compat with existing 'admin'/'player'.
-- Drop existing check constraint on role if present, add new one.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
  WHERE con.conrelid = 'users'::regclass
    AND att.attname = 'role'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Include 'admin' for backward compat with existing rows
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk', 'coach', 'finance', 'readonly_staff', 'player'));

-- ============================================================
-- 2. Booking policies (replaces flat booking_rules for v2)
-- ============================================================
-- The existing booking_rules table stays as the "club default" policy.
-- booking_policies adds tier-specific, court-specific, and time-specific overrides.

CREATE TABLE IF NOT EXISTS booking_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  -- Scope: what does this policy apply to?
  -- NULL means "applies to all" for that dimension
  tier_id uuid REFERENCES membership_tiers(id) ON DELETE CASCADE,
  court_id uuid REFERENCES courts(id) ON DELETE CASCADE,

  -- Policy name for admin display
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0, -- higher = overrides lower
  is_active boolean NOT NULL DEFAULT true,

  -- Booking windows
  advance_booking_days integer,          -- how far in advance can book
  same_day_cutoff_minutes integer,       -- min minutes before slot to book same-day
  max_booking_duration_mins integer,     -- max length of a single booking
  min_booking_duration_mins integer,     -- min length

  -- Limits
  max_active_reservations integer,       -- concurrent confirmed bookings
  max_daily_reservations integer,        -- per day limit
  max_weekly_reservations integer,       -- per week limit
  max_guest_count integer,               -- guests per booking

  -- Cancellation
  cancellation_cutoff_hours numeric,     -- hours before start to cancel
  cancellation_fee_cents integer,        -- fee charged on late cancel (0 = free)
  no_show_fee_cents integer,             -- fee charged on no-show

  -- Recurring
  allow_recurring boolean DEFAULT true,
  max_recurring_weeks integer DEFAULT 8,

  -- Prime time restrictions
  prime_time_start time,                 -- e.g., '17:00'
  prime_time_end time,                   -- e.g., '21:00'
  prime_time_days integer[],             -- days of week (0=Sun..6=Sat)
  prime_time_surcharge_cents integer,    -- additional charge during prime time
  prime_time_tier_only boolean DEFAULT false, -- only this tier can book prime time

  -- Blackout
  blackout_start date,
  blackout_end date,
  blackout_reason text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_policies_club ON booking_policies(club_id, is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_booking_policies_tier ON booking_policies(tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_policies_court ON booking_policies(court_id) WHERE court_id IS NOT NULL;

ALTER TABLE booking_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage booking policies" ON booking_policies FOR ALL
  USING (club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  ))
  WITH CHECK (club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  ));

CREATE POLICY "Members view active booking policies" ON booking_policies FOR SELECT
  USING (
    is_active = true
    AND club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true)
  );

-- ============================================================
-- 3. Payment records table
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),

  -- What is this payment for?
  entity_type text NOT NULL CHECK (entity_type IN ('reservation', 'event_registration', 'membership', 'cancellation_fee', 'no_show_fee', 'credit_purchase')),
  entity_id uuid, -- FK to reservations.id, event_registrations.id, etc.

  -- Amounts (all in cents)
  amount_cents integer NOT NULL,
  platform_fee_cents integer DEFAULT 0,
  net_amount_cents integer DEFAULT 0, -- amount - platform_fee
  currency text NOT NULL DEFAULT 'usd',

  -- Stripe references
  stripe_payment_intent_id text,
  stripe_refund_id text,
  stripe_transfer_id text,
  idempotency_key text UNIQUE, -- prevents duplicate charges

  -- State machine
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- payment intent created
    'processing',     -- payment sheet presented
    'succeeded',      -- payment confirmed by Stripe
    'failed',         -- payment failed
    'refund_pending', -- refund initiated
    'refunded',       -- full refund completed
    'partially_refunded', -- partial refund
    'disputed',       -- chargeback
    'cancelled'       -- cancelled before completion
  )),

  refund_amount_cents integer DEFAULT 0,
  refund_reason text,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  failure_reason text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_user ON payment_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_club ON payment_records(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_entity ON payment_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_stripe ON payment_records(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_idempotency ON payment_records(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON payment_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins view club payments" ON payment_records FOR SELECT
  USING (club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'finance')
  ));

CREATE POLICY "Service role manages payments" ON payment_records FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. Audit logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES clubs(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  actor_role text,

  -- What happened
  action text NOT NULL, -- e.g., 'reservation.cancel', 'member.suspend', 'booking_rule.update'
  entity_type text NOT NULL, -- e.g., 'reservation', 'membership', 'booking_policy', 'payment'
  entity_id uuid, -- ID of the affected record

  -- Change details
  changes jsonb, -- { field: { old: x, new: y } }
  metadata jsonb DEFAULT '{}', -- extra context

  -- Context
  ip_address text,
  user_agent text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_club ON audit_logs(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins+ can view audit logs (append-only, no updates/deletes)
CREATE POLICY "Admins view club audit logs" ON audit_logs FOR SELECT
  USING (club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin')
  ));

CREATE POLICY "Service role inserts audit logs" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Also allow authenticated users to insert their own audit logs
CREATE POLICY "Users insert own audit logs" ON audit_logs FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- 5. Membership lifecycle expansion
-- ============================================================
-- Add status enum and lifecycle fields to memberships
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('trial', 'active', 'suspended', 'expired', 'cancelled'));

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS renewal_date date;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS trial_ends_at date;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS guest_allowance integer DEFAULT 4; -- max guests per booking
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS booking_credits integer; -- NULL = unlimited based on tier

-- Backfill: set status based on existing is_active
UPDATE memberships SET status = 'active' WHERE is_active = true AND status IS NULL;
UPDATE memberships SET status = 'suspended' WHERE is_active = false AND status IS NULL;

-- ============================================================
-- 6. Reservation state model hardening
-- ============================================================
-- Update the status check to include all valid states
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
  WHERE con.conrelid = 'reservations'::regclass
    AND att.attname = 'status'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE reservations DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('draft', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show', 'refunded'));

-- Add validation metadata
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS validated_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS validation_token uuid;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_record_id uuid REFERENCES payment_records(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_fee_cents integer DEFAULT 0;

-- ============================================================
-- 7. Reservation validation function (server-side)
-- ============================================================
-- This function checks all booking policies before allowing a reservation.
-- Called by the validate-booking edge function and can be called as an RPC.

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

  -- Get user membership
  SELECT m.*, mt.discount_percent, mt.can_book_free
  INTO v_membership
  FROM memberships m
  LEFT JOIN membership_tiers mt ON mt.id = m.tier_id
  WHERE m.user_id = p_user_id
    AND m.club_id = p_club_id
    AND m.is_active = true
    AND m.status IN ('active', 'trial')
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
    'membership_id', v_membership.id,
    'tier_id', v_tier_id,
    'discount_percent', COALESCE(v_membership.discount_percent, 0),
    'can_book_free', COALESCE(v_membership.can_book_free, false)
  );
END;
$$;

-- ============================================================
-- 8. Cancellation validation function
-- ============================================================
CREATE OR REPLACE FUNCTION validate_cancellation(
  p_reservation_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation record;
  v_rules record;
  v_hours_until numeric;
  v_cancellation_fee integer := 0;
  v_errors text[] := '{}';
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id;

  IF v_reservation IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'errors', to_jsonb(ARRAY['NOT_FOUND: Reservation not found.']));
  END IF;

  -- Check ownership or admin
  IF v_reservation.user_id != p_user_id THEN
    -- Check if user is admin for this club
    DECLARE v_is_admin boolean;
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = p_user_id
        AND club_id = v_reservation.club_id
        AND role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk')
      ) INTO v_is_admin;

      IF NOT v_is_admin THEN
        RETURN jsonb_build_object('valid', false, 'errors', to_jsonb(ARRAY['UNAUTHORIZED: You cannot cancel this reservation.']));
      END IF;
    END;
  END IF;

  -- Check status
  IF v_reservation.status NOT IN ('confirmed', 'pending_payment') THEN
    v_errors := array_append(v_errors,
      format('INVALID_STATUS: Cannot cancel a reservation with status "%s".', v_reservation.status));
    RETURN jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors));
  END IF;

  -- Check cutoff
  v_hours_until := EXTRACT(EPOCH FROM (v_reservation.start_time - now())) / 3600;

  SELECT * INTO v_rules
  FROM booking_rules
  WHERE club_id = v_reservation.club_id
  LIMIT 1;

  IF v_rules IS NOT NULL AND v_rules.cancellation_cutoff_hours IS NOT NULL THEN
    IF v_hours_until < v_rules.cancellation_cutoff_hours THEN
      v_errors := array_append(v_errors,
        format('CUTOFF: Cannot cancel within %s hours of the reservation. You have %.1f hours remaining.',
          v_rules.cancellation_cutoff_hours, v_hours_until));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', to_jsonb(v_errors),
    'cancellation_fee_cents', v_cancellation_fee,
    'hours_until_start', v_hours_until,
    'has_payment', v_reservation.stripe_payment_id IS NOT NULL,
    'amount_paid_cents', COALESCE(v_reservation.amount_paid * 100, 0)::integer
  );
END;
$$;

-- ============================================================
-- 9. Updated trigger for reservation status changes → audit log
-- ============================================================
CREATE OR REPLACE FUNCTION log_reservation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (club_id, actor_id, actor_role, action, entity_type, entity_id, changes)
    VALUES (
      NEW.club_id,
      COALESCE(NEW.cancelled_by, auth.uid(), NEW.user_id),
      (SELECT role FROM users WHERE id = COALESCE(NEW.cancelled_by, auth.uid(), NEW.user_id) LIMIT 1),
      'reservation.status_change',
      'reservation',
      NEW.id,
      jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_status_audit ON reservations;
CREATE TRIGGER trg_reservation_status_audit
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION log_reservation_status_change();

-- ============================================================
-- 10. Trigger for membership status changes → audit log
-- ============================================================
CREATE OR REPLACE FUNCTION log_membership_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    INSERT INTO audit_logs (club_id, actor_id, actor_role, action, entity_type, entity_id, changes)
    VALUES (
      NEW.club_id,
      COALESCE(auth.uid(), NEW.user_id),
      (SELECT role FROM users WHERE id = COALESCE(auth.uid(), NEW.user_id) LIMIT 1),
      'membership.status_change',
      'membership',
      NEW.id,
      jsonb_build_object(
        'status', jsonb_build_object('old', OLD.status, 'new', NEW.status),
        'is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_status_audit ON memberships;
CREATE TRIGGER trg_membership_status_audit
  AFTER UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION log_membership_status_change();

-- ============================================================
-- 11. Trigger for payment record changes → audit log
-- ============================================================
CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (club_id, actor_id, actor_role, action, entity_type, entity_id, changes)
    VALUES (
      NEW.club_id,
      COALESCE(auth.uid(), NEW.user_id),
      NULL,
      'payment.status_change',
      'payment',
      NEW.id,
      jsonb_build_object(
        'status', jsonb_build_object('old', OLD.status, 'new', NEW.status),
        'amount_cents', NEW.amount_cents,
        'refund_amount_cents', NEW.refund_amount_cents
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_status_audit ON payment_records;
CREATE TRIGGER trg_payment_status_audit
  AFTER UPDATE ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_status_change();

COMMIT;
