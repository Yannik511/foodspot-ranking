-- =============================================
-- QUICK FIX: ratings Spalte hinzufügen (OHNE Daten zu löschen)
-- =============================================
-- Führe diesen Befehl aus, wenn du bereits Daten hast und nur die ratings Spalte hinzufügen willst
-- KEINE Daten gehen verloren!

ALTER TABLE foodspots 
ADD COLUMN IF NOT EXISTS ratings JSONB DEFAULT '{}'::jsonb;

-- Optional: Kommentar hinzufügen
COMMENT ON COLUMN foodspots.ratings IS 'JSON object storing individual criterion ratings (e.g., {"Brot": 5, "Fleisch": 4, "Soße": 5})';

-- ✅ Fertig! Der PGRST204 Fehler sollte jetzt behoben sein.








