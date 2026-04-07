-- Communications System
-- Adds: message templates, communication history, closure notification automation

BEGIN;

-- ============================================================
-- 1. Message templates
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN (
    'booking_reminder', 'booking_confirmation', 'cancellation',
    'event_reminder', 'weather_closure', 'membership_welcome',
    'membership_expiring', 'no_show_warning', 'payment_receipt',
    'general', 'custom'
  )),
  -- Merge fields available: {{member_name}}, {{club_name}}, {{court_name}}, {{date}}, {{time}}, {{amount}}, {{event_name}}, {{program_name}}
  variables text[] DEFAULT '{}', -- list of merge fields this template uses
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_club ON message_templates(club_id, category, is_active);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates" ON message_templates FOR ALL
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')))
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')));

-- ============================================================
-- 2. Communication history (log of all messages sent)
-- ============================================================
CREATE TABLE IF NOT EXISTS communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id),
  recipient_id uuid REFERENCES auth.users(id), -- NULL for broadcast
  recipient_email text,

  -- Message content
  channel text NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'email', 'sms', 'in_app')),
  subject text,
  body text NOT NULL,

  -- Source tracking
  template_id uuid REFERENCES message_templates(id),
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN (
    'manual', 'automated', 'scheduled', 'system'
  )),
  trigger_source text, -- e.g., 'booking_confirmation', 'weather_closure', 'push_campaign'

  -- Related entity
  entity_type text, -- 'reservation', 'event', 'program', 'membership', 'court_closure'
  entity_id uuid,

  -- Delivery status
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  failure_reason text,

  sent_by uuid REFERENCES auth.users(id), -- staff who triggered it, NULL for automated
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_log_club ON communication_log(club_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_log_recipient ON communication_log(recipient_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_log_entity ON communication_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_trigger ON communication_log(trigger_source, sent_at DESC);

ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own communications" ON communication_log FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Admins view club communications" ON communication_log FOR SELECT
  USING (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager')));

CREATE POLICY "Service role manages comm log" ON communication_log FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Allow staff to insert communication logs
CREATE POLICY "Staff insert comm log" ON communication_log FOR INSERT
  WITH CHECK (club_id IN (SELECT club_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'owner', 'club_admin', 'manager', 'front_desk')));

-- ============================================================
-- 3. Seed default templates for each club
-- ============================================================
-- These are created per-club. We'll create a function that clubs can call.
CREATE OR REPLACE FUNCTION seed_default_templates(p_club_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO message_templates (club_id, name, subject, body, category, variables, created_by)
  VALUES
    (p_club_id, 'Booking Confirmation', 'Booking Confirmed', 'Hi {{member_name}}, your booking at {{court_name}} on {{date}} at {{time}} is confirmed. See you there!', 'booking_confirmation', ARRAY['member_name', 'court_name', 'date', 'time'], p_created_by),
    (p_club_id, 'Booking Reminder', 'Reminder: Court Booking Tomorrow', 'Hi {{member_name}}, just a reminder that you have a booking at {{court_name}} tomorrow at {{time}}. Don''t forget your gear!', 'booking_reminder', ARRAY['member_name', 'court_name', 'time'], p_created_by),
    (p_club_id, 'Cancellation Notice', 'Booking Cancelled', 'Hi {{member_name}}, your booking at {{court_name}} on {{date}} at {{time}} has been cancelled. {{amount}} will be refunded within 5-10 business days.', 'cancellation', ARRAY['member_name', 'court_name', 'date', 'time', 'amount'], p_created_by),
    (p_club_id, 'Weather Closure', 'Court Closure Notice', 'Hi {{member_name}}, due to {{reason}}, {{court_name}} is closed on {{date}}. Your booking has been cancelled and a refund is being processed. We apologize for the inconvenience.', 'weather_closure', ARRAY['member_name', 'court_name', 'date', 'reason'], p_created_by),
    (p_club_id, 'Event Reminder', 'Event Tomorrow: {{event_name}}', 'Hi {{member_name}}, reminder that {{event_name}} is happening tomorrow at {{time}}. We look forward to seeing you!', 'event_reminder', ARRAY['member_name', 'event_name', 'time'], p_created_by),
    (p_club_id, 'Welcome New Member', 'Welcome to {{club_name}}!', 'Hi {{member_name}}, welcome to {{club_name}}! You can now book courts, join events, and connect with other members. Download the RecReserve app to get started.', 'membership_welcome', ARRAY['member_name', 'club_name'], p_created_by),
    (p_club_id, 'Membership Expiring', 'Your Membership is Expiring', 'Hi {{member_name}}, your membership at {{club_name}} expires on {{date}}. Renew now to keep booking courts and accessing member benefits.', 'membership_expiring', ARRAY['member_name', 'club_name', 'date'], p_created_by),
    (p_club_id, 'No-Show Warning', 'Missed Booking', 'Hi {{member_name}}, you were marked as a no-show for your booking at {{court_name}} on {{date}}. Repeated no-shows may affect your booking privileges.', 'no_show_warning', ARRAY['member_name', 'court_name', 'date'], p_created_by)
  ON CONFLICT DO NOTHING;
END;
$$;

COMMIT;
