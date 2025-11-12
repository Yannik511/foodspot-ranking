-- =============================================
-- MIGRATION 020: ADD ROLE TO LIST_INVITATIONS
-- =============================================
-- Fügt die fehlende 'role' Spalte zur list_invitations Tabelle hinzu
-- =============================================

-- Füge 'role' Spalte hinzu (wenn sie noch nicht existiert)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'list_invitations' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE list_invitations
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'editor' 
    CHECK (role IN ('viewer', 'editor'));
    
    COMMENT ON COLUMN list_invitations.role IS 'Rolle des eingeladenen Users: viewer oder editor';
  END IF;
END $$;

-- =============================================
-- SUCCESS: Role Column Added to list_invitations
-- =============================================





