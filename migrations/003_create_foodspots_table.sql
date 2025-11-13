-- =============================================
-- MIGRATION 003: CREATE FOODSPOTS TABLE
-- =============================================
-- Erstellt die `foodspots` Tabelle mit allen notwendigen Spalten
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

-- Kommentare für bessere Dokumentation
COMMENT ON TABLE foodspots IS 'Speichert einzelne Foodspots innerhalb einer Liste';
COMMENT ON COLUMN foodspots.ratings IS 'JSON object storing individual criterion ratings (e.g., {"Brot": 5, "Fleisch": 4, "Soße": 5})';
COMMENT ON COLUMN foodspots.tier IS 'Tier-Rating: S (beste), A, B, C, D, E (schlechteste)';
COMMENT ON COLUMN foodspots.rating IS 'Gesamt-Rating (0.00 - 5.00)';

-- =============================================
-- SUCCESS: Foodspots Table Created
-- =============================================












