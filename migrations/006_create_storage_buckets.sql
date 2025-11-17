-- =============================================
-- MIGRATION 006: CREATE STORAGE BUCKETS
-- =============================================
-- Erstellt die Storage Buckets für Bilder
-- WICHTIG: Diese Migration muss manuell im Supabase Dashboard ausgeführt werden!
-- =============================================

-- =============================================
-- MANUELLE SCHRITTE:
-- =============================================
-- 1. Gehe zu Supabase Dashboard → Storage
-- 2. Klicke auf "New Bucket"
-- 3. Erstelle folgende Buckets:
--
--    Bucket 1: "list-covers"
--    - Name: list-covers
--    - Public bucket: ✅ ENABLED
--    - File size limit: 5 MB (optional)
--    - Allowed MIME types: image/* (optional)
--
--    Bucket 2: "profile-avatars"
--    - Name: profile-avatars
--    - Public bucket: ✅ ENABLED
--    - File size limit: 2 MB (optional)
--    - Allowed MIME types: image/* (optional)
--
-- 4. Klicke auf "Create Bucket" für beide
-- =============================================

-- Diese SQL-Datei kann nicht automatisch Buckets erstellen,
-- da Supabase Storage Buckets über die API oder das Dashboard erstellt werden müssen.

-- =============================================
-- VERIFICATION:
-- =============================================
-- Nach dem Erstellen der Buckets, führe diese Query aus, um zu prüfen:
-- SELECT name, public FROM storage.buckets WHERE name IN ('list-covers', 'profile-avatars');
-- =============================================















