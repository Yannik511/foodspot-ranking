-- =============================================
-- COMPLETE DATABASE SETUP - ALL IN ONE
-- =============================================
-- Führt alle Migrationen in der richtigen Reihenfolge aus
-- ACHTUNG: Alle existierenden Daten werden gelöscht!
-- =============================================

-- =============================================
-- SCHRITT 1: RESET (001)
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
DROP INDEX IF EXISTS idx_foodspots_tier;
DROP INDEX IF EXISTS idx_foodspots_category;

-- Lösche alle Tabellen
DROP TABLE IF EXISTS foodspots CASCADE;
DROP TABLE IF EXISTS lists CASCADE;

-- =============================================
-- SCHRITT 2: CREATE TABLES (002, 003)
-- =============================================

-- Lists Table
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  accent_color VARCHAR(20) NOT NULL DEFAULT '#FF784F',
  cover_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, list_name)
);

-- Foodspots Table
CREATE TABLE foodspots (
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

-- =============================================
-- SCHRITT 3: CREATE INDEXES (004)
-- =============================================

CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_is_public ON lists(is_public);
CREATE INDEX idx_lists_created_at ON lists(created_at DESC);
CREATE INDEX idx_lists_category ON lists(category);
CREATE INDEX idx_foodspots_list_id ON foodspots(list_id);
CREATE INDEX idx_foodspots_user_id ON foodspots(user_id);
CREATE INDEX idx_foodspots_tier ON foodspots(tier);
CREATE INDEX idx_foodspots_category ON foodspots(category);

-- =============================================
-- SCHRITT 4: CREATE TRIGGERS (005)
-- =============================================

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

CREATE TRIGGER set_updated_at_foodspots
  BEFORE UPDATE ON foodspots
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- =============================================
-- SCHRITT 5: CREATE RLS POLICIES (008)
-- =============================================

-- Lists RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lists"
ON lists FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lists"
ON lists FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own lists"
ON lists FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
ON lists FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Public lists are viewable by all users"
ON lists FOR SELECT TO authenticated
USING (is_public = true);

-- Foodspots RLS
ALTER TABLE foodspots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view foodspots in own lists"
ON foodspots FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lists 
    WHERE lists.id = foodspots.list_id 
    AND lists.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create foodspots in own lists"
ON foodspots FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM lists 
    WHERE lists.id = foodspots.list_id 
    AND lists.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own foodspots"
ON foodspots FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own foodspots"
ON foodspots FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- SUCCESS: Complete Database Setup Finished!
-- =============================================
-- Nächste Schritte:
-- 1. Erstelle Storage Buckets manuell (siehe 006_create_storage_buckets.sql)
-- 2. Führe 007_create_storage_policies.sql aus
-- =============================================
















