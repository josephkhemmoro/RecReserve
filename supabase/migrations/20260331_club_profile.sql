-- Club photo gallery
CREATE TABLE club_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view club photos"
  ON club_photos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Club admins can manage photos"
  ON club_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.club_id = club_photos.club_id
      AND m.user_id = auth.uid()
      AND u.role = 'admin'
      AND m.is_active = true
    )
  );

CREATE POLICY "Club admins can update photos"
  ON club_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.club_id = club_photos.club_id
      AND m.user_id = auth.uid()
      AND u.role = 'admin'
      AND m.is_active = true
    )
  );

CREATE POLICY "Club admins can delete photos"
  ON club_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.club_id = club_photos.club_id
      AND m.user_id = auth.uid()
      AND u.role = 'admin'
      AND m.is_active = true
    )
  );

CREATE INDEX idx_club_photos_club ON club_photos(club_id, sort_order);

-- Club announcements (master records)
CREATE TABLE club_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience text DEFAULT 'all',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view announcements"
  ON club_announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.club_id = club_announcements.club_id
      AND memberships.user_id = auth.uid()
      AND memberships.is_active = true
    )
  );

CREATE POLICY "Club admins can manage announcements"
  ON club_announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.club_id = club_announcements.club_id
      AND m.user_id = auth.uid()
      AND u.role = 'admin'
      AND m.is_active = true
    )
  );

CREATE INDEX idx_club_announcements_club ON club_announcements(club_id, created_at DESC);
