-- =============================================
-- MIGRATION 001: COMPLETE DATABASE RESET
-- =============================================
-- Führt ein komplettes Reset der Datenbank durch
-- ACHTUNG: Alle existierenden Daten werden gelöscht!
-- =============================================

-- Lösche alle Storage Policies
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;

-- Lösche alle Table Policies
DROP POLICY IF EXISTS "Public lists are viewable by all users" ON lists;
DROP POLICY IF EXISTS "Users can view own lists" ON lists;
DROP POLICY IF EXISTS "Users can create own lists" ON lists;
DROP POLICY IF EXISTS "Users can update own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON lists;
DROP POLICY IF EXISTS "Users can view foodspots in own lists" ON foodspots;
DROP POLICY IF EXISTS "Users can create foodspots in own lists" ON foodspots;
DROP POLICY IF EXISTS "Users can update own foodspots" ON foodspots;
DROP POLICY IF EXISTS "Users can delete own foodspots" ON foodspots;

-- Lösche alle Trigger
DROP TRIGGER IF EXISTS set_updated_at ON lists;
DROP TRIGGER IF EXISTS set_updated_at_foodspots ON foodspots;

-- Lösche alle Funktionen
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;

-- Lösche alle Indizes
DROP INDEX IF EXISTS idx_lists_user_id;
DROP INDEX IF EXISTS idx_lists_is_public;
DROP INDEX IF EXISTS idx_lists_created_at;
DROP INDEX IF EXISTS idx_lists_category;
DROP INDEX IF EXISTS idx_foodspots_list_id;
DROP INDEX IF EXISTS idx_foodspots_user_id;

-- Lösche alle Tabellen (Alle Daten gehen verloren!)
DROP TABLE IF EXISTS foodspots CASCADE;
DROP TABLE IF EXISTS lists CASCADE;

-- =============================================
-- SUCCESS: Database Reset Complete
-- =============================================












