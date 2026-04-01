-- Allow active club members to read user rows for other members in the same
-- club so player-facing joins (open spots, feed, kudos, etc.) can resolve
-- names and avatars consistently, without triggering RLS recursion.

DROP POLICY IF EXISTS "Club members can view users in their club" ON users;

CREATE OR REPLACE FUNCTION public.can_view_user_in_shared_club(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships viewer
    JOIN public.memberships target
      ON target.club_id = viewer.club_id
    WHERE viewer.user_id = auth.uid()
      AND viewer.is_active = true
      AND target.user_id = target_user_id
      AND target.is_active = true
  );
$$;

CREATE POLICY "Club members can view users in their club"
  ON users
  FOR SELECT
  TO authenticated
  USING (public.can_view_user_in_shared_club(id));
