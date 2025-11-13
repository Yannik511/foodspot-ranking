-- =============================================
-- MIGRATION 044: ADD PROFILE_VISIBILITY COLUMN
-- =============================================
-- Fügt profile_visibility zu user_profiles hinzu
-- für den Discover-Tab (öffentliche Profile)
-- =============================================

-- Prüfe ob user_profiles eine View oder Tabelle ist
DO $$
BEGIN
  -- Wenn es eine View ist, lösche sie
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'user_profiles'
  ) THEN
    DROP VIEW IF EXISTS user_profiles CASCADE;
    
    -- Erstelle Tabelle neu
    CREATE TABLE user_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      username TEXT UNIQUE,
      profile_image_url TEXT,
      email TEXT,
      profile_visibility TEXT DEFAULT 'friends' CHECK (profile_visibility IN ('private', 'friends', 'public')),
      bio TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    
    -- Migriere Daten aus auth.users
    INSERT INTO user_profiles (id, email, username, profile_visibility)
    SELECT 
      id, 
      email,
      COALESCE(raw_user_meta_data->>'username', email),
      COALESCE(raw_user_meta_data->>'profile_visibility', 'friends')
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;
    
    -- RLS aktivieren
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    
    -- Policies
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
    
  ELSE
    -- Es ist eine Tabelle, füge Spalten hinzu
    ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'friends' 
    CHECK (profile_visibility IN ('private', 'friends', 'public'));
    
    ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS bio TEXT;
    
    -- Setze bestehende Profile auf 'friends' (wenn NULL oder nicht gesetzt)
    UPDATE user_profiles
    SET profile_visibility = 'friends'
    WHERE profile_visibility IS NULL;
  END IF;
END $$;

-- 2. Index für schnelle Abfragen nach öffentlichen Profilen
CREATE INDEX IF NOT EXISTS idx_user_profiles_visibility 
ON user_profiles(profile_visibility);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username 
ON user_profiles(username);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email 
ON user_profiles(email);

-- =============================================
-- ERFOLG: profile_visibility hinzugefügt!
-- =============================================
-- Mögliche Werte:
-- - 'private': Nur ich sehe mein Profil
-- - 'friends': Nur Freunde sehen mein Profil (Standard)
-- - 'public': Alle sehen mein Profil (Discover-Tab)
-- =============================================

