-- =============================================
-- STORAGE POLICIES FÜR list-covers BUCKET
-- =============================================
-- WICHTIG: Füge diese Policies NUR ein, NACHDEM du den Bucket erstellt hast!
-- Bucket erstellen: Storage → New Bucket → Name: "list-covers" (MIT Minuszeichen!) → Public: AN

-- Users können eigene Bilder in ihrem Ordner hochladen
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'list-covers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
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
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
-- Storage Policies erfolgreich erstellt! ✅

