-- Phase 1 Comprehensive Schema Migration
-- Adds: pending_payment status, recurring reservations, court closures,
--        credit transactions, push campaigns, extended waitlist/open_spots,
--        booking_rules RLS, club stripe_account_status, and various indexes.

BEGIN;

-- ============================================================
-- 1. Add pending_payment to reservation status
-- ============================================================
-- If there is a check constraint on reservations.status, update it.
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
    ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
      CHECK (status IN ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show'));
  END IF;
END $$;

ALTER TABLE reservations ALTER COLUMN status SET DEFAULT 'pending_payment';

-- ============================================================
-- 2. Extend reservations table
-- ============================================================
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS recurring_group_id uuid;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_reservations_recurring_group ON reservations(recurring_group_id) WHERE recurring_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_club_start ON reservations(club_id, start_time);

-- ============================================================
-- 3. New court_closures table
-- ============================================================
CREATE TABLE IF NOT EXISTS court_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT 'maintenance',
  closed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_closures_court_time ON court_closures(court_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_court_closures_club ON court_closures(club_id);

ALTER TABLE court_closures ENABLE ROW LEVEL SECURITY;

-- Admin can manage closures for their club
CREATE POLICY "Admins manage club closures" ON court_closures FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Club members can view closures
CREATE POLICY "Club members view closures" ON court_closures FOR SELECT
  USING (club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));

-- ============================================================
-- 4. New credit_transactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  club_id uuid NOT NULL REFERENCES clubs(id),
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_club ON credit_transactions(user_id, club_id);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON credit_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage club transactions" ON credit_transactions FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 5. New push_campaigns table
-- ============================================================
CREATE TABLE IF NOT EXISTS push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'no_show', 'lapsed', 'tier')),
  audience_tier_id uuid REFERENCES membership_tiers(id),
  sent_count integer DEFAULT 0,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaigns" ON push_campaigns FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 6. Extend event_registrations table
-- ============================================================
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS stripe_payment_id text;

-- ============================================================
-- 7. Unique constraint on event_registrations
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_event_user_unique'
  ) THEN
    ALTER TABLE event_registrations ADD CONSTRAINT event_registrations_event_user_unique UNIQUE (event_id, user_id);
  END IF;
END $$;

-- ============================================================
-- 8. Create waitlist table (was only a type, never created)
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  club_id uuid REFERENCES clubs(id),
  court_id uuid REFERENCES courts(id),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  notified_at timestamptz,
  expires_at timestamptz,
  desired_start timestamptz,
  desired_end timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_reservation_position ON waitlist(reservation_id, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_court_time ON waitlist(court_id, desired_start, desired_end);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own waitlist entries
CREATE POLICY "Users manage own waitlist" ON waitlist FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view waitlist for their club
CREATE POLICY "Admins view club waitlist" ON waitlist FOR SELECT
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Service role full access
CREATE POLICY "Service role full access waitlist" ON waitlist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 9. Extend open_spots table
-- ============================================================
ALTER TABLE open_spots ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_open_spots_club_active ON open_spots(club_id, is_active) WHERE is_active = true;

-- ============================================================
-- 10. Add missing indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_feed_events_club_created ON feed_events(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memberships_user_club_active ON memberships(user_id, club_id, is_active);

-- ============================================================
-- 11. Add RLS for booking_rules
-- ============================================================
ALTER TABLE booking_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins manage booking rules" ON booking_rules;
  DROP POLICY IF EXISTS "Club members view booking rules" ON booking_rules;
END $$;

CREATE POLICY "Admins manage booking rules" ON booking_rules FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Club members view booking rules" ON booking_rules FOR SELECT
  USING (club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));

-- ============================================================
-- 12. Extend clubs table
-- ============================================================
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_account_status text DEFAULT 'not_started' CHECK (stripe_account_status IN ('not_started', 'pending', 'active'));

-- Migrate existing data
UPDATE clubs SET stripe_account_status = 'active' WHERE stripe_onboarding_complete = true AND stripe_account_status = 'not_started';
UPDATE clubs SET stripe_account_status = 'pending' WHERE stripe_account_id IS NOT NULL AND stripe_onboarding_complete IS NOT TRUE AND stripe_account_status = 'not_started';

COMMIT;
