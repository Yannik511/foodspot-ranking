-- =============================================
-- MIGRATION 005: CREATE TRIGGERS
-- =============================================
-- Erstellt Trigger für automatische updated_at Aktualisierung
-- =============================================

-- Funktion für updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für lists Tabelle
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Trigger für foodspots Tabelle
CREATE TRIGGER set_updated_at_foodspots
  BEFORE UPDATE ON foodspots
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- =============================================
-- SUCCESS: Triggers Created
-- =============================================






