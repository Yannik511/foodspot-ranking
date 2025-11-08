-- =============================================
-- AVATAR STORAGE POLICIES
-- =============================================
-- Diese Policies ermöglichen, dass User nur ihre eigenen Avatare hochladen/löschen können
-- Verwendet string_to_array für den Pfad: {userId}/avatar.jpg

-- Lösche alte Policies (falls vorhanden)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;

-- Policy: User können ihre eigenen Avatare hochladen
-- Verwendet string_to_array für den Pfad: {userId}/avatar.jpg
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: User können ihre eigenen Avatare lesen
CREATE POLICY "Users can read their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-avatars' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: User können ihre eigenen Avatare aktualisieren
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-avatars' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: User können ihre eigenen Avatare löschen
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: Öffentlicher Zugriff zum Anzeigen (wichtig für private buckets!)
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');

