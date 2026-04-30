-- 20260430_platform_admin.sql
-- Adds super-admin (platform owner) capabilities to RecReserve.
--
-- What this does:
--   1. users.is_platform_admin flag — only YOU should have this set true
--   2. clubs.platform_status — active | suspended | archived (lifecycle)
--   3. is_platform_admin() SECURITY DEFINER fn — used in RLS policies, no recursion risk
--   4. Permissive RLS policies on relevant tables that allow platform admins to read/write everything
--
-- AFTER applying this migration:
--   UPDATE users SET is_platform_admin = true WHERE email = 'YOUR@EMAIL.com';

-- 1. Platform admin flag on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Club lifecycle status
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS platform_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_platform_status_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_platform_status_check
  CHECK (platform_status IN ('active', 'suspended', 'archived'));
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS platform_status_changed_at TIMESTAMPTZ;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS platform_status_reason TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_clubs_platform_status ON clubs(platform_status);

-- 3. Helper function to check platform admin (avoids RLS recursion since users
--    table itself has RLS — calling SECURITY DEFINER fn bypasses it for the lookup).
CREATE OR REPLACE FUNCTION public.is_platform_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT u.is_platform_admin FROM users u WHERE u.id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

-- 4. Permissive policies — platform admin can read/write everything on these tables.
--    These are ADDITIVE: existing club-scoped policies still apply for club admins.

DROP POLICY IF EXISTS platform_admin_all_clubs ON clubs;
CREATE POLICY platform_admin_all_clubs ON clubs FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_users ON users;
CREATE POLICY platform_admin_all_users ON users FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_memberships ON memberships;
CREATE POLICY platform_admin_all_memberships ON memberships FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_reservations ON reservations;
CREATE POLICY platform_admin_all_reservations ON reservations FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_payment_records ON payment_records;
CREATE POLICY platform_admin_all_payment_records ON payment_records FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_audit_logs ON audit_logs;
CREATE POLICY platform_admin_all_audit_logs ON audit_logs FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_courts ON courts;
CREATE POLICY platform_admin_all_courts ON courts FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admin_all_membership_tiers ON membership_tiers;
CREATE POLICY platform_admin_all_membership_tiers ON membership_tiers FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 5. Block bookings + memberships at suspended/archived clubs (server-side enforcement).
--    This is a CHECK that adds to existing constraints — won't conflict with RLS.
--    Note: this only blocks NEW rows; existing rows are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_club_active_for_writes() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  status TEXT;
BEGIN
  SELECT platform_status INTO status FROM clubs WHERE id = NEW.club_id;
  IF status IN ('suspended', 'archived') THEN
    RAISE EXCEPTION 'This club is %. New bookings and memberships are paused.', status
      USING HINT = 'Contact platform support if this is unexpected.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_block_inactive_club ON reservations;
CREATE TRIGGER trg_reservations_block_inactive_club
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_active_for_writes();

DROP TRIGGER IF EXISTS trg_memberships_block_inactive_club ON memberships;
CREATE TRIGGER trg_memberships_block_inactive_club
  BEFORE INSERT ON memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_active_for_writes();
