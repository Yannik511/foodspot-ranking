-- =============================================
-- MIGRATION 030: FIX USER_PROFILES TABLE
-- =============================================
-- Problem: Die Query versucht auf user_profiles.user_id zuzugreifen,
-- aber die Tabelle hat keine user_id Spalte - nur id.
--
-- Dies könnte passieren, wenn user_profiles eine VIEW ist,
-- die falsch konfiguriert wurde.
-- =============================================

-- Prüfen, ob user_profiles eine View ist und sie neu erstellen
DROP VIEW IF EXISTS user_profiles CASCADE;

-- user_profiles als eigene Tabelle erstellen (falls nicht existiert)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  profile_image_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Username-Suche
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- RLS aktivieren
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies für user_profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Policy 1: Alle authentifizierten User können Profile sehen
CREATE POLICY "Users can view all profiles"
ON user_profiles FOR SELECT TO authenticated
USING (true);

-- Policy 2: User können nur ihr eigenes Profil aktualisieren
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: User können nur ihr eigenes Profil erstellen
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION set_updated_at_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_user_profiles();

-- Bestehende Profile aus auth.users migrieren (falls noch nicht vorhanden)
INSERT INTO user_profiles (id, email, username)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'username', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SUCCESS: User Profiles Table Created
-- =============================================










