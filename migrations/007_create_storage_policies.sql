-- =============================================
-- MIGRATION 007: CREATE STORAGE POLICIES
-- =============================================
-- Erstellt RLS Policies für Storage Buckets
-- WICHTIG: Buckets müssen vorher erstellt werden (siehe 006_create_storage_buckets.sql)
-- =============================================

-- =============================================
-- STORAGE POLICIES FÜR list-covers BUCKET
-- =============================================

-- Users können Bilder in ihrem Ordner hochladen
-- Dateiname muss im Format {user_id}/{filename} sein
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'list-covers' 
  AND (
    -- Option 1: Datei ist im user_id Ordner
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Option 2: Dateiname beginnt direkt mit user_id/
    split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Jeder kann alle Bilder ansehen (Bucket ist public)
CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'list-covers');

-- Users können nur ihre eigenen Bilder löschen
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'list-covers' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    split_part(name, '/', 1) = auth.uid()::text
  )
);

-- =============================================
-- STORAGE POLICIES FÜR profile-avatars BUCKET
-- =============================================

-- Users können Profilbilder hochladen
CREATE POLICY "Users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Jeder kann Profilbilder ansehen (Bucket ist public)
CREATE POLICY "Users can view profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');

-- Users können nur ihre eigenen Profilbilder löschen
CREATE POLICY "Users can delete profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    split_part(name, '/', 1) = auth.uid()::text
  )
);

-- =============================================
-- SUCCESS: Storage Policies Created
-- =============================================


















