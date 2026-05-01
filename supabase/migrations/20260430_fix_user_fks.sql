-- 20260430_fix_user_fks.sql
-- Several columns reference auth.users(id) instead of public.users(id), which
-- prevents PostgREST from embedding the related profile via "user:users(...)".
-- Since public.users.id IS auth.users.id (1:1), retargeting is safe — data
-- integrity flows through the chain public.users -> auth.users.
--
-- Affected columns:
--   communication_log.recipient_id
--   programs.instructor_id
--   events.instructor_id

-- communication_log.recipient_id
ALTER TABLE communication_log DROP CONSTRAINT IF EXISTS communication_log_recipient_id_fkey;
ALTER TABLE communication_log
  ADD CONSTRAINT communication_log_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- programs.instructor_id
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_instructor_id_fkey;
ALTER TABLE programs
  ADD CONSTRAINT programs_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- events.instructor_id
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_instructor_id_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Tell PostgREST to reload its schema cache so the new FKs are visible to the API.
NOTIFY pgrst, 'reload schema';
