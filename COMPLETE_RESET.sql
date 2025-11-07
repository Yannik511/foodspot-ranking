-- =============================================
-- COMPLETE DATABASE RESET
-- =============================================
-- Führe dieses Script in Supabase SQL Editor aus, um die Datenbank komplett neu aufzubauen
-- ACHTUNG: Alle existierenden Listen und Foodspots werden gelöscht!

-- =============================================
-- SCHRITT 1: Alte Struktur löschen
-- =============================================

-- Lösche alte Policies
DROP POLICY IF EXISTS "Public lists are viewable by all users" ON lists;
DROP POLICY IF EXISTS "Users can view own lists" ON lists;
DROP POLICY IF EXISTS "Users can create own lists" ON lists;
DROP POLICY IF EXISTS "Users can update own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON lists;
DROP POLICY IF EXISTS "Users can view foodspots in own lists" ON foodspots;
DROP POLICY IF EXISTS "Users can create foodspots in own lists" ON foodspots;
DROP POLICY IF EXISTS "Users can update own foodspots" ON foodspots;
DROP POLICY IF EXISTS "Users can delete own foodspots" ON foodspots;

-- Lösche alte Trigger
DROP TRIGGER IF EXISTS set_updated_at ON lists;
DROP TRIGGER IF EXISTS set_updated_at_foodspots ON foodspots;

-- Lösche alte Funktionen
DROP FUNCTION IF EXISTS handle_updated_at();

-- Lösche alte Indizes
DROP INDEX IF EXISTS idx_lists_user_id;
DROP INDEX IF EXISTS idx_lists_is_public;
DROP INDEX IF EXISTS idx_lists_created_at;
DROP INDEX IF EXISTS idx_foodspots_list_id;
DROP INDEX IF EXISTS idx_foodspots_user_id;

-- Lösche alte Tabellen (Alle Daten gehen verloren!)
DROP TABLE IF EXISTS foodspots CASCADE;
DROP TABLE IF EXISTS lists CASCADE;

-- =============================================
-- SCHRITT 2: Neue Struktur erstellen
-- =============================================

-- =============================================
-- LISTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Unique constraint: User kann keine zwei Listen mit gleichem Namen haben
  UNIQUE(user_id, list_name)
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);

-- Row Level Security (RLS) aktivieren
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own lists"
  ON lists
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lists"
  ON lists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON lists
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON lists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger für updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- =============================================
-- FOODSPOTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS foodspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(50),
  website TEXT,
  category VARCHAR(50),
  ratings JSONB DEFAULT '{}'::jsonb,
  tier VARCHAR(1) CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'E')),
  rating DECIMAL(3, 2),
  notes TEXT,
  cover_photo_url TEXT,
  visited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Kommentar für ratings Spalte
COMMENT ON COLUMN foodspots.ratings IS 'JSON object storing individual criterion ratings (e.g., {"Brot": 5, "Fleisch": 4, "Soße": 5})';

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_foodspots_list_id ON foodspots(list_id);
CREATE INDEX IF NOT EXISTS idx_foodspots_user_id ON foodspots(user_id);

-- RLS aktivieren
ALTER TABLE foodspots ENABLE ROW LEVEL SECURITY;

-- RLS Policies für foodspots
CREATE POLICY "Users can view foodspots in own lists"
  ON foodspots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = foodspots.list_id 
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create foodspots in own lists"
  ON foodspots
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = foodspots.list_id 
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own foodspots"
  ON foodspots
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own foodspots"
  ON foodspots
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE TRIGGER set_updated_at_foodspots
  BEFORE UPDATE ON foodspots
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
-- Wenn du diese Zeile siehst: ALLES ERFOLGREICH! ✅




