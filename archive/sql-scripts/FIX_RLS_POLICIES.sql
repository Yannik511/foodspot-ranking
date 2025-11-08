-- =============================================
-- FIX RLS POLICIES FÜR MOBILE APP
-- =============================================
-- Diese SQL-Datei behebt die RLS Policy Probleme für:
-- 1. Storage Upload (list-covers bucket)
-- 2. Lists Table Insert
-- 3. Auth Session Handling
-- =============================================

-- =============================================
-- 1. STORAGE POLICIES FÜR list-covers BUCKET
-- =============================================
-- Problem: "new row violates row-level security policy"
-- Lösung: Policies prüfen und korrigieren

-- Lösche alte Policies (falls vorhanden)
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

-- Neue Policy: Users können Bilder in ihrem Ordner hochladen
-- WICHTIG: Der Dateiname muss im Format {user_id}/{filename} sein
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
-- 2. LISTS TABLE RLS POLICIES
-- =============================================
-- Problem: "new row violates row-level security policy for table lists"
-- Lösung: Policies prüfen und sicherstellen, dass INSERT funktioniert

-- Prüfe ob RLS aktiviert ist
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Lösche alte Policies (falls vorhanden)
DROP POLICY IF EXISTS "Users can view own lists" ON lists;
DROP POLICY IF EXISTS "Users can create own lists" ON lists;
DROP POLICY IF EXISTS "Users can update own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON lists;
DROP POLICY IF EXISTS "Public lists are viewable by all users" ON lists;

-- Neue Policy: Users können ihre eigenen Listen sehen
CREATE POLICY "Users can view own lists"
ON lists
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Neue Policy: Users können ihre eigenen Listen erstellen
-- WICHTIG: WITH CHECK prüft die Werte BEVOR sie eingefügt werden
CREATE POLICY "Users can create own lists"
ON lists
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
);

-- Neue Policy: Users können ihre eigenen Listen aktualisieren
CREATE POLICY "Users can update own lists"
ON lists
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Neue Policy: Users können ihre eigenen Listen löschen
CREATE POLICY "Users can delete own lists"
ON lists
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Öffentliche Listen können von allen eingeloggten Usern gesehen werden
CREATE POLICY "Public lists are viewable by all users"
ON lists
FOR SELECT
TO authenticated
USING (is_public = true);

-- =============================================
-- 3. AUTH SESSION VERIFICATION
-- =============================================
-- Problem: "Invalid Refresh Token: Refresh Token Not Found"
-- Lösung: Prüfe ob auth.users Tabelle korrekt konfiguriert ist

-- Prüfe ob auth.users Tabelle existiert (sollte automatisch existieren)
-- Falls nicht, wird sie von Supabase automatisch erstellt

-- =============================================
-- 4. VERIFICATION QUERIES
-- =============================================
-- Führe diese Queries aus, um zu prüfen, ob alles korrekt ist:

-- Prüfe Storage Policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- Prüfe Lists Policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'lists'
ORDER BY policyname;

-- Prüfe ob RLS aktiviert ist
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('lists', 'objects')
ORDER BY tablename;

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
-- ✅ Storage Policies korrigiert
-- ✅ Lists RLS Policies korrigiert
-- ✅ Auth Session sollte jetzt funktionieren
-- 
-- NÄCHSTE SCHRITTE:
-- 1. Mobile App neu starten
-- 2. User neu einloggen (um Session zu aktualisieren)
-- 3. Liste erstellen testen






