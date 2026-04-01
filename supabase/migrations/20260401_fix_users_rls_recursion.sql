-- Fix recursive users RLS policies by moving the admin lookup into
-- SECURITY DEFINER helpers that bypass RLS safely.

DROP POLICY IF EXISTS "Admins can view users in their club" ON users;

CREATE OR REPLACE FUNCTION public.current_user_club_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view users in their club"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND club_id = public.current_user_club_id()
  );
