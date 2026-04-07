-- Social Play Layer
-- Player profiles, availability, open games, play groups, social graph

BEGIN;

-- ============================================================
-- 1. Player profiles (extended identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Sports & preferences
  sports text[] DEFAULT '{}', -- e.g., ['tennis', 'pickleball']
  skill_levels jsonb DEFAULT '{}', -- e.g., { "tennis": "intermediate", "pickleball": "beginner" }
  preferred_formats text[] DEFAULT '{}', -- 'singles', 'doubles', 'mixed_doubles', 'social', 'competitive'
  play_style text CHECK (play_style IS NULL OR play_style IN ('casual', 'social', 'competitive', 'intense')),

  -- Bio
  bio text,
  years_playing integer,

  -- Availability preferences (general, not specific dates)
  preferred_days integer[] DEFAULT '{}', -- 0=Sun..6=Sat
  preferred_time_of_day text[] DEFAULT '{}', -- 'morning', 'afternoon', 'evening'

  -- Status / intent
  looking_for_game boolean DEFAULT false,
  open_to_sub boolean DEFAULT false,
  looking_for_partner boolean DEFAULT false,

  -- Privacy
  profile_visibility text DEFAULT 'club_members' CHECK (profile_visibility IN ('public', 'club_members', 'connections_only', 'private')),
  show_skill_level boolean DEFAULT true,
  show_availability boolean DEFAULT true,

  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_user ON player_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_player_profiles_looking ON player_profiles(looking_for_game) WHERE looking_for_game = true;
CREATE INDEX IF NOT EXISTS idx_player_profiles_sub ON player_profiles(open_to_sub) WHERE open_to_sub = true;

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON player_profiles FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Club members view profiles" ON player_profiles FOR SELECT
  USING (
    profile_visibility = 'public'
    OR (profile_visibility = 'club_members' AND EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.club_id = m2.club_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = player_profiles.user_id
      AND m1.is_active = true AND m2.is_active = true
    ))
    OR user_id = auth.uid()
  );

-- ============================================================
-- 2. Player availability (specific weekly slots)
-- ============================================================
CREATE TABLE IF NOT EXISTS player_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  sport text, -- NULL = any sport
  note text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, day_of_week, start_time, sport)
);

CREATE INDEX IF NOT EXISTS idx_player_avail_user ON player_availability(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_player_avail_day ON player_availability(day_of_week, start_time) WHERE is_active = true;

ALTER TABLE player_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own availability" ON player_availability FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Club members view availability" ON player_availability FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.club_id = m2.club_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = player_availability.user_id
    AND m1.is_active = true AND m2.is_active = true
  ));

-- ============================================================
-- 3. Open games (standalone game requests, not tied to a reservation)
-- ============================================================
CREATE TABLE IF NOT EXISTS open_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  -- Game details
  title text,
  sport text NOT NULL DEFAULT 'pickleball',
  format text NOT NULL DEFAULT 'doubles' CHECK (format IN ('singles', 'doubles', 'mixed_doubles', 'social', 'round_robin')),
  skill_level text DEFAULT 'all' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all')),

  -- Scheduling
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  court_id uuid REFERENCES courts(id),

  -- Capacity
  players_needed integer NOT NULL DEFAULT 1,
  max_players integer NOT NULL DEFAULT 4,

  -- Status
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'confirmed', 'cancelled', 'completed')),

  -- Booking integration
  reservation_id uuid REFERENCES reservations(id), -- linked once court is booked

  description text,
  is_invite_only boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_games_club ON open_games(club_id, date, status);
CREATE INDEX IF NOT EXISTS idx_open_games_creator ON open_games(creator_id);
CREATE INDEX IF NOT EXISTS idx_open_games_date ON open_games(date, start_time) WHERE status = 'open';

ALTER TABLE open_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator manages own games" ON open_games FOR ALL
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Club members view games" ON open_games FOR SELECT
  USING (club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Service role manages games" ON open_games FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. Game participants
-- ============================================================
CREATE TABLE IF NOT EXISTS game_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES open_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'invited', 'requested', 'declined', 'removed')),
  invited_by uuid REFERENCES auth.users(id),
  message text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_participants_game ON game_participants(game_id, status);
CREATE INDEX IF NOT EXISTS idx_game_participants_user ON game_participants(user_id);

ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own participation" ON game_participants FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Game creators manage participants" ON game_participants FOR ALL
  USING (game_id IN (SELECT id FROM open_games WHERE creator_id = auth.uid()))
  WITH CHECK (game_id IN (SELECT id FROM open_games WHERE creator_id = auth.uid()));

CREATE POLICY "Club members view participants" ON game_participants FOR SELECT
  USING (game_id IN (SELECT id FROM open_games WHERE club_id IN (
    SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true
  )));

-- ============================================================
-- 5. Play groups
-- ============================================================
CREATE TABLE IF NOT EXISTS play_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  sport text,
  skill_level text CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'mixed')),

  -- Recurring schedule
  recurring_day integer, -- 0=Sun..6=Sat
  recurring_time time,
  recurring_duration_mins integer DEFAULT 60,
  preferred_court_id uuid REFERENCES courts(id),

  -- Settings
  max_members integer DEFAULT 12,
  is_public boolean DEFAULT true, -- can anyone join or invite-only?
  is_active boolean DEFAULT true,

  -- Next scheduled session
  next_session_date date,
  next_reservation_id uuid REFERENCES reservations(id),

  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_play_groups_club ON play_groups(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_play_groups_creator ON play_groups(creator_id);

ALTER TABLE play_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator manages group" ON play_groups FOR ALL
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- NOTE: "Club members view public groups" policy is created AFTER play_group_members table (section 6)

CREATE POLICY "Service role manages groups" ON play_groups FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6. Play group members
-- ============================================================
CREATE TABLE IF NOT EXISTS play_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES play_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'requested', 'inactive', 'removed')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_play_group_members_group ON play_group_members(group_id, status);
CREATE INDEX IF NOT EXISTS idx_play_group_members_user ON play_group_members(user_id, status);

ALTER TABLE play_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own membership" ON play_group_members FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group admins manage members" ON play_group_members FOR ALL
  USING (group_id IN (
    SELECT group_id FROM play_group_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ) OR group_id IN (SELECT id FROM play_groups WHERE creator_id = auth.uid()))
  WITH CHECK (group_id IN (
    SELECT group_id FROM play_group_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ) OR group_id IN (SELECT id FROM play_groups WHERE creator_id = auth.uid()));

CREATE POLICY "Members view group roster" ON play_group_members FOR SELECT
  USING (group_id IN (SELECT group_id FROM play_group_members WHERE user_id = auth.uid() AND status = 'active')
    OR group_id IN (SELECT id FROM play_groups WHERE is_public = true AND club_id IN (
      SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true
    )));

-- Deferred policy from section 5 (needed play_group_members to exist first)
CREATE POLICY "Club members view public groups" ON play_groups FOR SELECT
  USING (
    (is_public = true AND club_id IN (SELECT club_id FROM memberships WHERE user_id = auth.uid() AND is_active = true))
    OR creator_id = auth.uid()
    OR id IN (SELECT group_id FROM play_group_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- 7. Play connections (social graph — who plays with whom)
-- ============================================================
CREATE TABLE IF NOT EXISTS play_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  partner_id uuid NOT NULL REFERENCES auth.users(id),
  club_id uuid NOT NULL REFERENCES clubs(id),

  -- Stats
  times_played integer DEFAULT 1,
  last_played_at timestamptz DEFAULT now(),

  -- Relationship
  is_favorite boolean DEFAULT false,
  is_blocked boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, partner_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_play_connections_user ON play_connections(user_id, club_id);
CREATE INDEX IF NOT EXISTS idx_play_connections_favorites ON play_connections(user_id, is_favorite) WHERE is_favorite = true;

ALTER TABLE play_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own connections" ON play_connections FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view connections where they appear" ON play_connections FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());

-- ============================================================
-- 8. Extend notification types for social
-- ============================================================
-- No schema change needed — notifications table already supports arbitrary types.
-- We'll use these new types in code:
-- 'game_invite', 'game_join', 'game_full', 'game_confirmed'
-- 'group_invite', 'group_session', 'group_booking'
-- 'partner_request', 'partner_match'

-- ============================================================
-- 9. Feed event type extension
-- ============================================================
-- feed_events.event_type is text, no constraint — we can add new types in code:
-- 'open_game_created', 'game_confirmed', 'group_session_booked'

-- ============================================================
-- 10. Auto-update play connections from shared reservations
-- ============================================================
CREATE OR REPLACE FUNCTION update_play_connections_from_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game record;
  v_participants uuid[];
  v_p1 uuid;
  v_p2 uuid;
BEGIN
  -- Only run when game status changes to 'completed' or 'confirmed'
  IF NEW.status NOT IN ('completed', 'confirmed') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Get all joined participants
  SELECT array_agg(user_id) INTO v_participants
  FROM game_participants
  WHERE game_id = NEW.id AND status = 'joined';

  IF v_participants IS NULL OR array_length(v_participants, 1) < 2 THEN RETURN NEW; END IF;

  -- Include creator
  IF NOT (NEW.creator_id = ANY(v_participants)) THEN
    v_participants := array_append(v_participants, NEW.creator_id);
  END IF;

  -- Create/update connections between all pairs
  FOR i IN 1..array_length(v_participants, 1) LOOP
    FOR j IN (i+1)..array_length(v_participants, 1) LOOP
      v_p1 := v_participants[i];
      v_p2 := v_participants[j];

      -- Direction 1
      INSERT INTO play_connections (user_id, partner_id, club_id, times_played, last_played_at)
      VALUES (v_p1, v_p2, NEW.club_id, 1, now())
      ON CONFLICT (user_id, partner_id, club_id)
      DO UPDATE SET times_played = play_connections.times_played + 1, last_played_at = now(), updated_at = now();

      -- Direction 2
      INSERT INTO play_connections (user_id, partner_id, club_id, times_played, last_played_at)
      VALUES (v_p2, v_p1, NEW.club_id, 1, now())
      ON CONFLICT (user_id, partner_id, club_id)
      DO UPDATE SET times_played = play_connections.times_played + 1, last_played_at = now(), updated_at = now();
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_play_connections ON open_games;
CREATE TRIGGER trg_update_play_connections
  AFTER UPDATE ON open_games
  FOR EACH ROW
  EXECUTE FUNCTION update_play_connections_from_game();

COMMIT;
