-- 20260430_terms_and_conditions.sql
-- Club Terms & Conditions: clubs upload a PDF, players must accept it before
-- joining, and re-accept whenever the club replaces it. Full audit trail per
-- acceptance with IP + user-agent capture.

-- 1. Club columns
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS terms_url TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS terms_filename TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS terms_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS terms_updated_at TIMESTAMPTZ;

-- 2. Audit table — one row per (user, club, version)
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  terms_version INTEGER NOT NULL,
  terms_url TEXT, -- snapshot of the URL accepted, in case club replaces later
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  UNIQUE (user_id, club_id, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON terms_acceptances(user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_club ON terms_acceptances(club_id, accepted_at DESC);

ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own acceptances" ON terms_acceptances;
CREATE POLICY "Users see own acceptances" ON terms_acceptances FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins see club acceptances" ON terms_acceptances;
CREATE POLICY "Admins see club acceptances" ON terms_acceptances FOR SELECT
  USING (club_id IN (
    SELECT club_id FROM users
    WHERE id = auth.uid()
      AND role IN ('admin', 'owner', 'club_admin', 'manager')
  ));

DROP POLICY IF EXISTS "Platform admins see all acceptances" ON terms_acceptances;
CREATE POLICY "Platform admins see all acceptances" ON terms_acceptances FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- 3. Helper: has the user accepted the CURRENT version of this club's terms?
--    Returns TRUE if club has no terms (nothing to accept).
CREATE OR REPLACE FUNCTION public.has_accepted_current_terms(p_user_id uuid, p_club_id uuid)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clubs c
    LEFT JOIN terms_acceptances ta
      ON ta.club_id = c.id
      AND ta.user_id = p_user_id
      AND ta.terms_version = c.terms_version
    WHERE c.id = p_club_id
      AND (
        c.terms_url IS NULL
        OR ta.id IS NOT NULL
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_accepted_current_terms(uuid, uuid) TO authenticated;

-- 4. RPC: record an acceptance. Captures IP from request headers + UA from caller.
CREATE OR REPLACE FUNCTION public.accept_terms(p_club_id uuid, p_user_agent TEXT DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_version INT;
  v_url TEXT;
  v_ip INET;
  v_id uuid;
  v_xff TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT terms_version, terms_url INTO v_version, v_url
  FROM clubs WHERE id = p_club_id;

  IF v_url IS NULL THEN
    RAISE EXCEPTION 'Club has no terms to accept';
  END IF;

  -- Try to extract IP from PostgREST request headers (best-effort).
  BEGIN
    v_xff := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      -- XFF can be comma-separated chain; take first
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO terms_acceptances (user_id, club_id, terms_version, terms_url, accepted_at, ip_address, user_agent)
  VALUES (v_uid, p_club_id, v_version, v_url, now(), v_ip, p_user_agent)
  ON CONFLICT (user_id, club_id, terms_version) DO UPDATE
    SET accepted_at = now(),
        ip_address = COALESCE(EXCLUDED.ip_address, terms_acceptances.ip_address),
        user_agent = COALESCE(EXCLUDED.user_agent, terms_acceptances.user_agent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_terms(uuid, TEXT) TO authenticated;

-- 5. RPC: list user's outdated club memberships (used by mobile launch check).
--    Returns clubs where user is an active member but has not accepted the
--    current terms version.
CREATE OR REPLACE FUNCTION public.list_outdated_terms_clubs(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  club_id uuid,
  club_name TEXT,
  terms_url TEXT,
  terms_version INTEGER,
  terms_updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id,
    c.name,
    c.terms_url,
    c.terms_version,
    c.terms_updated_at
  FROM memberships m
  JOIN clubs c ON c.id = m.club_id
  LEFT JOIN terms_acceptances ta
    ON ta.club_id = c.id
    AND ta.user_id = m.user_id
    AND ta.terms_version = c.terms_version
  WHERE m.user_id = COALESCE(p_user_id, auth.uid())
    AND m.is_active = true
    AND c.terms_url IS NOT NULL
    AND ta.id IS NULL
    AND c.platform_status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.list_outdated_terms_clubs(uuid) TO authenticated;

-- 6. Storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-terms', 'club-terms', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf'];

-- Storage RLS — files live at club-terms/<club_id>/<filename>.pdf
DROP POLICY IF EXISTS "Public can read club terms" ON storage.objects;
CREATE POLICY "Public can read club terms" ON storage.objects FOR SELECT
  USING (bucket_id = 'club-terms');

DROP POLICY IF EXISTS "Admins manage own club terms" ON storage.objects;
CREATE POLICY "Admins manage own club terms" ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'club-terms'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner', 'club_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'club-terms'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner', 'club_admin')
    )
  );

DROP POLICY IF EXISTS "Platform admins manage all club terms" ON storage.objects;
CREATE POLICY "Platform admins manage all club terms" ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'club-terms' AND public.is_platform_admin())
  WITH CHECK (bucket_id = 'club-terms' AND public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
