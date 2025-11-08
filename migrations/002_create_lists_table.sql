-- =============================================
-- MIGRATION 002: CREATE LISTS TABLE
-- =============================================
-- Erstellt die `lists` Tabelle mit allen notwendigen Spalten
-- =============================================

CREATE TABLE IF NOT EXISTS lists (
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
  
  -- Unique constraint: User kann keine zwei Listen mit gleichem Namen haben
  UNIQUE(user_id, list_name)
);

-- Kommentare für bessere Dokumentation
COMMENT ON TABLE lists IS 'Speichert alle User-Listen (z.B. "Beste Burger Münchens")';
COMMENT ON COLUMN lists.category IS 'Kategorie der Liste (z.B. "Döner", "Pizza", "Burger") oder NULL für "Alle Kategorien"';
COMMENT ON COLUMN lists.accent_color IS 'Akzentfarbe für die Liste (Hex-Code)';
COMMENT ON COLUMN lists.is_public IS 'Ob die Liste öffentlich sichtbar ist';

-- =============================================
-- SUCCESS: Lists Table Created
-- =============================================






