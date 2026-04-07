-- Programs, Organized Play, Front Desk, and Reporting Extensions
-- Adds: programs, instructor assignments, attendance tracking,
--        leagues, matches, standings, front desk check-ins

BEGIN;

-- ============================================================
-- 1. Extend events table for programs and instructors
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES auth.users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS program_id uuid; -- FK added after programs table created
ALTER TABLE events ADD COLUMN IF NOT EXISTS skill_level text CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'all'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS min_participants integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurring_rule text; -- e.g., 'weekly', 'biweekly'
ALTER TABLE events ADD COLUMN IF NOT EXISTS series_id uuid; -- groups recurring instances
ALTER TABLE events ADD COLUMN IF NOT EXISTS member_price numeric; -- discounted price for members
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled'));

-- Extend event_type to include more program types
-- Drop old check if exists and add new one
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
  WHERE con.conrelid = 'events'::regclass
    AND att.attname = 'event_type'
    AND con.contype = 'c';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE events DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE events ADD CONSTRAINT events_event_type_check
  CHECK (event_type IN ('open_play', 'clinic', 'tournament', 'lesson', 'camp', 'league_match', 'round_robin', 'drop_in', 'private_lesson', 'group_lesson'));

CREATE INDEX IF NOT EXISTS idx_events_instructor ON events(instructor_id) WHERE instructor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_program ON events(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_series ON events(series_id) WHERE series_id IS NOT NULL;

-- ============================================================
-- 2. Programs table
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  program_type text NOT NULL CHECK (program_type IN ('lesson_series', 'clinic_series', 'camp', 'academy', 'drop_in_series')),

  -- Schedule
  start_date date NOT NULL,
  end_date date,
  day_of_week integer[], -- 0=Sun..6=Sat for recurring
  start_time time,
  end_time time,

  -- Capacity
  max_participants integer,
  min_participants integer,

  -- Pricing
  price numeric NOT NULL DEFAULT 0,
  member_price numeric, -- discounted price for members
  drop_in_price numeric, -- per-session drop-in price

  -- Instructor
  instructor_id uuid REFERENCES auth.users(id),

  -- Court
  court_id uuid REFERENCES courts(id),

  -- Skill
  skill_level text CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'all')),

  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'registration_open', 'in_progress', 'completed', 'cancelled')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add FK from events to programs now that programs table exists
ALTER TABLE events ADD CONSTRAINT events_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programs_club ON programs(club_id, status);
CREATE INDEX IF NOT EXISTS idx_programs_instructor ON programs(instructor_id) WHERE instructor_id IS NOT NULL;

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage programs" ON programs FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'coach')))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'coach')));

CREATE POLICY "Members view published programs" ON programs FOR SELECT
  USING (status != 'draft' AND club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));

-- ============================================================
-- 3. Program registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS program_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlisted', 'cancelled', 'completed', 'dropped')),
  stripe_payment_id text,
  amount_paid numeric DEFAULT 0,
  registered_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (program_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_program_reg_program ON program_registrations(program_id, status);
CREATE INDEX IF NOT EXISTS idx_program_reg_user ON program_registrations(user_id);

ALTER TABLE program_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own program registrations" ON program_registrations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view club program registrations" ON program_registrations FOR SELECT
  USING (program_id IN (SELECT id FROM programs WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'coach')
  )));

CREATE POLICY "Service role full access program registrations" ON program_registrations FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. Event attendance / check-in tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'no_show', 'late', 'excused')),
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES auth.users(id), -- staff who checked them in
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event ON event_attendance(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user ON event_attendance(user_id);

ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attendance" ON event_attendance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff manage attendance" ON event_attendance FOR ALL
  USING (event_id IN (SELECT id FROM events WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk', 'coach')
  )))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk', 'coach')
  )));

-- ============================================================
-- 5. Leagues / Organized Play
-- ============================================================
CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  format text NOT NULL CHECK (format IN ('ladder', 'round_robin', 'league', 'knockout')),
  sport text, -- optional sport filter
  skill_level text CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'open')),

  -- Schedule
  start_date date NOT NULL,
  end_date date,
  match_duration_mins integer DEFAULT 60,

  -- Roster
  max_players integer,
  min_players integer,

  -- Pricing
  entry_fee numeric DEFAULT 0,
  member_entry_fee numeric, -- discounted for members

  -- Scoring
  points_for_win integer DEFAULT 3,
  points_for_draw integer DEFAULT 1,
  points_for_loss integer DEFAULT 0,

  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration_open', 'in_progress', 'completed', 'cancelled')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leagues_club ON leagues(club_id, status);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leagues" ON leagues FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')));

CREATE POLICY "Members view active leagues" ON leagues FOR SELECT
  USING (status != 'draft' AND club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));

-- ============================================================
-- 6. League players / roster
-- ============================================================
CREATE TABLE IF NOT EXISTS league_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'substitute', 'withdrawn')),
  seed integer, -- initial ranking/seed
  stripe_payment_id text,
  amount_paid numeric DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_players_league ON league_players(league_id, status);

ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own league participation" ON league_players FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage league players" ON league_players FOR ALL
  USING (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  )))
  WITH CHECK (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  )));

CREATE POLICY "Members view league rosters" ON league_players FOR SELECT
  USING (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true
  )));

-- ============================================================
-- 7. League matches
-- ============================================================
CREATE TABLE IF NOT EXISTS league_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round integer, -- round number

  -- Players (or team names if doubles)
  player1_id uuid REFERENCES auth.users(id),
  player2_id uuid REFERENCES auth.users(id),

  -- Court and time
  court_id uuid REFERENCES courts(id),
  reservation_id uuid REFERENCES reservations(id), -- linked booking
  scheduled_at timestamptz,

  -- Score
  player1_score text, -- flexible: "6-4, 7-5" or "21-15"
  player2_score text,
  winner_id uuid REFERENCES auth.users(id),

  -- Status
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'forfeit', 'postponed')),

  -- Substitutes
  player1_substitute_id uuid REFERENCES auth.users(id),
  player2_substitute_id uuid REFERENCES auth.users(id),

  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_matches_league ON league_matches(league_id, round, status);
CREATE INDEX IF NOT EXISTS idx_league_matches_players ON league_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_player2 ON league_matches(player2_id);

ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view league matches" ON league_matches FOR SELECT
  USING (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true
  )));

CREATE POLICY "Players update own match scores" ON league_matches FOR UPDATE
  USING (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "Admins manage matches" ON league_matches FOR ALL
  USING (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  )))
  WITH CHECK (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  )));

-- ============================================================
-- 8. League standings (materialized view approach — table updated by triggers/functions)
-- ============================================================
CREATE TABLE IF NOT EXISTS league_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rank integer,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  draws integer DEFAULT 0,
  points integer DEFAULT 0,
  matches_played integer DEFAULT 0,
  sets_won integer DEFAULT 0,
  sets_lost integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_standings_league ON league_standings(league_id, rank);

ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view standings" ON league_standings FOR SELECT
  USING (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true
  )));

CREATE POLICY "Admins manage standings" ON league_standings FOR ALL
  USING (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  )))
  WITH CHECK (league_id IN (SELECT id FROM leagues WHERE club_id IN (
    SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')
  )));

CREATE POLICY "Service role manages standings" ON league_standings FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 9. Front desk check-ins for reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  checked_in_at timestamptz DEFAULT now(),
  checked_in_by uuid REFERENCES auth.users(id), -- front desk staff
  method text DEFAULT 'manual' CHECK (method IN ('manual', 'qr_code', 'auto')),
  notes text,
  UNIQUE (reservation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_checkins_date ON reservation_checkins(checked_in_at);

ALTER TABLE reservation_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage check-ins" ON reservation_checkins FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk')
  ));

CREATE POLICY "Users view own check-ins" ON reservation_checkins FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 10. Walk-in bookings tracking
-- ============================================================
-- Walk-in bookings are regular reservations created by front desk staff.
-- We add a column to track who created the booking (if different from the player).
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'mobile' CHECK (booking_source IN ('mobile', 'admin', 'front_desk', 'walk_in', 'system'));

COMMIT;
