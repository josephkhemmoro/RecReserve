-- Player streaks table
CREATE TABLE player_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  current_streak integer DEFAULT 0 NOT NULL,
  longest_streak integer DEFAULT 0 NOT NULL,
  last_play_week date, -- Monday of the last week they played
  streak_frozen_until date, -- If they used a streak freeze, immune until this date
  freezes_remaining integer DEFAULT 2 NOT NULL, -- 2 freezes per month
  freezes_reset_at timestamptz, -- When freezes were last reset
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, club_id)
);

ALTER TABLE player_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks"
  ON player_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON player_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage streaks"
  ON player_streaks FOR ALL
  USING (auth.role() = 'service_role');

-- Streak milestones table
CREATE TABLE streak_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  milestone integer NOT NULL, -- 4, 8, 12, 26, 52
  achieved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, club_id, milestone)
);

ALTER TABLE streak_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones"
  ON streak_milestones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage milestones"
  ON streak_milestones FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_player_streaks_user_club ON player_streaks(user_id, club_id);
CREATE INDEX idx_streak_milestones_user_club ON streak_milestones(user_id, club_id);
CREATE INDEX idx_reservations_user_status_endtime ON reservations(user_id, status, end_time);
