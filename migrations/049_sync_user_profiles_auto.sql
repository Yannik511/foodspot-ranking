-- =============================================
-- MIGRATION 049: AUTO-SYNC USER_PROFILES
-- =============================================
-- Löst das Problem, dass neue User und Username-Änderungen
-- nicht automatisch in user_profiles synchronisiert werden.
-- 
-- 1. Synchronisiert ALLE bestehenden User aus auth.users
-- 2. Erstellt Trigger für automatische Synchronisation bei:
--    - Neuer User-Registrierung
--    - Username-Änderung in user_metadata
--    - Email-Änderung
-- =============================================

-- =============================================
-- SCHRITT 1: Synchronisiere ALLE bestehenden User
-- =============================================
-- Füllt user_profiles mit allen Usern aus auth.users
-- und aktualisiert bestehende Einträge

INSERT INTO user_profiles (id, email, username, profile_image_url)
SELECT 
  au.id, 
  au.email,
  -- Username: Aus user_metadata, falls vorhanden, sonst Email-Prefix
  COALESCE(
    au.raw_user_meta_data->>'username',
    SPLIT_PART(au.email, '@', 1)
  ) as username,
  -- Profile Image: Aus user_metadata
  au.raw_user_meta_data->>'profileImageUrl' as profile_image_url
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  -- Username: Aktualisieren wenn vorhanden in auth.users, sonst behalten
  username = CASE 
    WHEN EXCLUDED.username IS NOT NULL AND EXCLUDED.username != '' 
    THEN EXCLUDED.username
    ELSE COALESCE(NULLIF(user_profiles.username, ''), EXCLUDED.username)
  END,
  -- Profile Image: Nur aktualisieren, wenn er fehlt oder wenn ein neuer vorhanden ist
  profile_image_url = COALESCE(
    NULLIF(user_profiles.profile_image_url, ''),
    EXCLUDED.profile_image_url
  ),
  -- Update updated_at wenn sich etwas geändert hat
  updated_at = CASE 
    WHEN user_profiles.email IS DISTINCT FROM EXCLUDED.email
      OR user_profiles.username IS DISTINCT FROM EXCLUDED.username
      OR user_profiles.profile_image_url IS DISTINCT FROM EXCLUDED.profile_image_url
    THEN now()
    ELSE user_profiles.updated_at
  END;

-- =============================================
-- SCHRITT 2: Funktion für automatische Synchronisation
-- =============================================
-- Diese Funktion wird von Triggern aufgerufen, wenn sich
-- auth.users ändert

CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Synchronisiere oder aktualisiere user_profiles
  INSERT INTO user_profiles (id, email, username, profile_image_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    -- Username: Aus user_metadata, falls vorhanden, sonst Email-Prefix
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    -- Profile Image: Aus user_metadata
    NEW.raw_user_meta_data->>'profileImageUrl',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    -- Username immer aktualisieren (auch wenn sich user_metadata.username geändert hat)
    username = COALESCE(
      NULLIF(EXCLUDED.username, ''),
      user_profiles.username
    ),
    -- Profile Image: Aktualisieren wenn vorhanden, sonst behalten
    profile_image_url = COALESCE(
      NULLIF(EXCLUDED.profile_image_url, ''),
      user_profiles.profile_image_url
    ),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- =============================================
-- SCHRITT 3: Trigger für neue User (INSERT)
-- =============================================
-- Wird ausgelöst, wenn ein neuer User registriert wird

DROP TRIGGER IF EXISTS trigger_sync_user_profile_insert ON auth.users;

CREATE TRIGGER trigger_sync_user_profile_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_user_profile();

-- =============================================
-- SCHRITT 4: Trigger für User-Updates (UPDATE)
-- =============================================
-- Wird ausgelöst, wenn user_metadata (Username) oder Email geändert wird

DROP TRIGGER IF EXISTS trigger_sync_user_profile_update ON auth.users;

CREATE TRIGGER trigger_sync_user_profile_update
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (
  -- Nur auslösen, wenn sich relevante Felder geändert haben
  OLD.email IS DISTINCT FROM NEW.email
  OR OLD.raw_user_meta_data->>'username' IS DISTINCT FROM NEW.raw_user_meta_data->>'username'
  OR OLD.raw_user_meta_data->>'profileImageUrl' IS DISTINCT FROM NEW.raw_user_meta_data->>'profileImageUrl'
)
EXECUTE FUNCTION sync_user_profile();

-- =============================================
-- SCHRITT 5: Cleanup - Lösche Trigger falls Migration rückgängig gemacht wird
-- =============================================
-- (Optional: Falls du die Migration später rückgängig machen willst,
--  kannst du diese Funktionen aufrufen)

COMMENT ON FUNCTION sync_user_profile() IS 
  'Synchronisiert user_profiles automatisch bei Änderungen in auth.users. Wird von Triggern aufgerufen.';

-- =============================================
-- ERFOLG: Auto-Sync ist jetzt aktiv!
-- =============================================
-- ✅ Alle bestehenden User wurden synchronisiert
-- ✅ Neue User werden automatisch in user_profiles erstellt
-- ✅ Username-Änderungen werden automatisch synchronisiert
-- ✅ Email-Änderungen werden automatisch synchronisiert
-- 
-- Die Suche sollte jetzt für alle User funktionieren!
-- =============================================

