-- Streak milestone rewards: clubs define perks unlocked at 4/8/12/26/52-week streaks,
-- and a DB trigger auto-grants them to players when they cross the milestone.

-- ---------- milestone_rewards ----------
-- What the CLUB offers for each milestone. Templates.
CREATE TABLE IF NOT EXISTS milestone_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  milestone INTEGER NOT NULL CHECK (milestone > 0),
  reward_type TEXT NOT NULL CHECK (
    reward_type IN ('discount_percent', 'free_booking', 'bonus_credit')
  ),
  -- % for discount_percent (0-100), cents for bonus_credit, ignored for free_booking
  reward_value INTEGER NOT NULL DEFAULT 0 CHECK (reward_value >= 0),
  title TEXT NOT NULL,
  description TEXT,
  expires_days INTEGER CHECK (expires_days IS NULL OR expires_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_rewards_club_milestone_idx
  ON milestone_rewards (club_id, milestone) WHERE is_active = true;

ALTER TABLE milestone_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rewards for their club"
  ON milestone_rewards FOR ALL
  TO authenticated
  USING (
    club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Members view active rewards at their club"
  ON milestone_rewards FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND club_id IN (
      SELECT club_id FROM memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ---------- player_rewards ----------
-- Actual grants. One row per (player, reward earned).
CREATE TABLE IF NOT EXISTS player_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  milestone_reward_id UUID REFERENCES milestone_rewards(id) ON DELETE SET NULL,
  -- Snapshot fields so deleting the template doesn't wipe earned rewards
  reward_type TEXT NOT NULL CHECK (
    reward_type IN ('discount_percent', 'free_booking', 'bonus_credit')
  ),
  reward_value INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  milestone INTEGER NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS player_rewards_user_idx
  ON player_rewards (user_id, redeemed_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS player_rewards_available_idx
  ON player_rewards (user_id, club_id)
  WHERE redeemed_at IS NULL;

ALTER TABLE player_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rewards"
  ON player_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users mark own rewards redeemed"
  ON player_rewards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view rewards at their club"
  ON player_rewards FOR SELECT
  TO authenticated
  USING (
    club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role manages rewards"
  ON player_rewards FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---------- Trigger: auto-grant rewards on milestone insert ----------
CREATE OR REPLACE FUNCTION grant_milestone_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO player_rewards (
    user_id, club_id, milestone_reward_id,
    reward_type, reward_value, title, description, milestone,
    expires_at
  )
  SELECT
    NEW.user_id,
    NEW.club_id,
    mr.id,
    mr.reward_type,
    mr.reward_value,
    mr.title,
    mr.description,
    NEW.milestone,
    CASE
      WHEN mr.expires_days IS NULL THEN NULL
      ELSE now() + (mr.expires_days || ' days')::interval
    END
  FROM milestone_rewards mr
  WHERE mr.club_id = NEW.club_id
    AND mr.milestone = NEW.milestone
    AND mr.is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_milestone_rewards ON streak_milestones;
CREATE TRIGGER trg_grant_milestone_rewards
AFTER INSERT ON streak_milestones
FOR EACH ROW
EXECUTE FUNCTION grant_milestone_rewards();

-- ---------- Helper: atomic redeem RPC ----------
-- Called server-side when a reservation is created with a reward.
-- Returns the reward row if still valid, raises if not.
CREATE OR REPLACE FUNCTION redeem_player_reward(
  p_reward_id UUID,
  p_user_id UUID,
  p_reservation_id UUID
) RETURNS player_rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward player_rewards;
BEGIN
  SELECT * INTO reward FROM player_rewards
  WHERE id = p_reward_id
    AND user_id = p_user_id
    AND redeemed_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not available' USING ERRCODE = 'P0001';
  END IF;

  UPDATE player_rewards
  SET redeemed_at = now(),
      redeemed_reservation_id = p_reservation_id
  WHERE id = p_reward_id
  RETURNING * INTO reward;

  RETURN reward;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_player_reward(UUID, UUID, UUID) TO authenticated;
