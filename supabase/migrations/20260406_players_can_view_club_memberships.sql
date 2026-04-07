-- Allow active club members to see all memberships in their shared club.
-- This is required so players can search for other members when sending kudos,
-- viewing open spots, etc. Uses a SECURITY DEFINER helper to avoid RLS recursion
-- on the memberships table.

CREATE OR REPLACE FUNCTION public.current_user_active_club_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

CREATE POLICY "Players can view memberships in their club"
  ON memberships
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND club_id IN (SELECT public.current_user_active_club_ids())
  );
