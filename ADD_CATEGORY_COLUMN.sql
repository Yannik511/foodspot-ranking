-- =============================================
-- ADD CATEGORY COLUMN TO LISTS TABLE
-- =============================================
-- Fügt die 'category' Spalte zur 'lists' Tabelle hinzu, falls sie nicht existiert

-- Prüfe ob Spalte existiert und füge sie hinzu falls nicht
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lists' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE lists 
        ADD COLUMN category VARCHAR(50) NULL;
        
        -- Optional: Kommentar hinzufügen
        COMMENT ON COLUMN lists.category IS 'Kategorie der Liste (null = alle Kategorien, sonst spezifische Kategorie wie Döner, Burger, etc.)';
    END IF;
END $$;

-- Index für schnelle Abfragen nach Kategorie (optional, aber empfohlen)
CREATE INDEX IF NOT EXISTS idx_lists_category ON lists(category) WHERE category IS NOT NULL;

-- Zeige Bestätigung
SELECT 'Category column added successfully (or already exists)' AS status;



