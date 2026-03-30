-- Kudos table
CREATE TABLE kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- One kudos per sender per reservation (can't spam)
  UNIQUE(sender_id, reservation_id)
);

ALTER TABLE kudos ENABLE ROW LEVEL SECURITY;

-- Players can view kudos they sent or received
CREATE POLICY "Users can view own kudos"
  ON kudos FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Players can insert kudos they send
CREATE POLICY "Users can send kudos"
  ON kudos FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Indexes
CREATE INDEX idx_kudos_sender ON kudos(sender_id);
CREATE INDEX idx_kudos_receiver ON kudos(receiver_id);
CREATE INDEX idx_kudos_reservation ON kudos(reservation_id);
