-- =============================================
-- MIGRATION 045: ROLLBACK PROFILE_VISIBILITY
-- =============================================
-- Macht Migration 044 rückgängig und stellt den
-- ursprünglichen Zustand der user_profiles Tabelle wieder her
-- =============================================

-- 1. Prüfe ob user_profiles Tabelle existiert
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    
    -- Entferne profile_visibility Spalte falls vorhanden
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_profiles' 
      AND column_name = 'profile_visibility'
    ) THEN
      ALTER TABLE user_profiles DROP COLUMN profile_visibility;
      RAISE NOTICE 'profile_visibility column dropped';
    END IF;
    
    -- Entferne bio Spalte falls vorhanden (wurde in 044 hinzugefügt)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_profiles' 
      AND column_name = 'bio'
    ) THEN
      ALTER TABLE user_profiles DROP COLUMN bio;
      RAISE NOTICE 'bio column dropped';
    END IF;
    
    -- Entferne Index falls vorhanden
    DROP INDEX IF EXISTS idx_user_profiles_visibility;
    
    RAISE NOTICE 'user_profiles table rolled back successfully';
    
  ELSE
    RAISE NOTICE 'user_profiles table does not exist - nothing to rollback';
  END IF;
END $$;

-- 2. Stelle sicher, dass die Original-Spalten existieren
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Stelle sicher, dass die Indexe existieren
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- 4. Trigger für updated_at
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

-- 5. Stelle RLS Policies wieder her
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view all profiles"
ON user_profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 6. Synchronisiere user_profiles mit auth.users
-- (Falls Einträge fehlen)
INSERT INTO user_profiles (id, email, username)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'username', email)
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  username = COALESCE(user_profiles.username, EXCLUDED.username);

-- =============================================
-- ERFOLG: Rollback abgeschlossen!
-- =============================================
-- user_profiles Tabelle ist jetzt wieder im Originalzustand:
-- - Keine profile_visibility Spalte
-- - Keine bio Spalte
-- - Nur: id, username, profile_image_url, email, created_at, updated_at
-- 
-- Die Freundeslogik verwendet NUR auth.users.user_metadata.profile_visibility
-- und NICHT die user_profiles Tabelle!
-- =============================================

