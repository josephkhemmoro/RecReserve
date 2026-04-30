-- Paid memberships: subscription support on tiers, Stripe linkage on memberships,
-- club-level requirement flag.

-- ---------- membership_tiers ----------
ALTER TABLE membership_tiers
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER NOT NULL DEFAULT 0
    CHECK (monthly_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Only one default tier per club, and a default tier cannot be paid.
CREATE UNIQUE INDEX IF NOT EXISTS membership_tiers_one_default_per_club
  ON membership_tiers (club_id) WHERE is_default = true;

ALTER TABLE membership_tiers
  DROP CONSTRAINT IF EXISTS membership_tiers_default_is_free;
ALTER TABLE membership_tiers
  ADD CONSTRAINT membership_tiers_default_is_free
  CHECK (NOT is_default OR NOT is_paid);

-- A paid tier must have a positive price.
ALTER TABLE membership_tiers
  DROP CONSTRAINT IF EXISTS membership_tiers_paid_has_price;
ALTER TABLE membership_tiers
  ADD CONSTRAINT membership_tiers_paid_has_price
  CHECK (NOT is_paid OR monthly_price_cents > 0);

-- ---------- memberships ----------
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_tier_id UUID REFERENCES membership_tiers(id);

CREATE INDEX IF NOT EXISTS memberships_stripe_subscription_idx
  ON memberships (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- ---------- clubs ----------
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS requires_paid_membership BOOLEAN NOT NULL DEFAULT false;

-- ---------- RLS: allow users to read tiers at clubs they can see (unchanged) ----------
-- Existing select policies remain; no changes needed.

-- ---------- RLS: do NOT allow players to directly UPDATE tier_id or status ----------
-- Tier changes go through edge functions (service role) only.
-- Existing self-service policy from 20260401_fix_membership_self_service.sql
-- already restricts UPDATE to is_active=false toggles — that behavior is preserved.

-- ---------- Backfill: default tier per club ----------
-- For each club with tiers, mark the lowest-priority free tier as default
-- if no default is set yet. Prefer tiers that are not paid and have lowest sort_order.
WITH candidate AS (
  SELECT DISTINCT ON (t.club_id)
    t.id, t.club_id
  FROM membership_tiers t
  LEFT JOIN membership_tiers d
    ON d.club_id = t.club_id AND d.is_default = true
  WHERE d.id IS NULL
    AND t.is_paid = false
  ORDER BY t.club_id, t.sort_order ASC, t.created_at ASC
)
UPDATE membership_tiers t
SET is_default = true
FROM candidate c
WHERE t.id = c.id;
