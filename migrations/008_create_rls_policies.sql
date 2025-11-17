-- =============================================
-- MIGRATION 008: CREATE RLS POLICIES
-- =============================================
-- Erstellt Row Level Security (RLS) Policies für Tabellen
-- =============================================

-- =============================================
-- RLS FÜR lists TABLE
-- =============================================

-- RLS aktivieren
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Users können ihre eigenen Listen sehen
CREATE POLICY "Users can view own lists"
ON lists
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users können ihre eigenen Listen erstellen
CREATE POLICY "Users can create own lists"
ON lists
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
);

-- Users können ihre eigenen Listen aktualisieren
CREATE POLICY "Users can update own lists"
ON lists
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users können ihre eigenen Listen löschen
CREATE POLICY "Users can delete own lists"
ON lists
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Öffentliche Listen können von allen eingeloggten Usern gesehen werden
CREATE POLICY "Public lists are viewable by all users"
ON lists
FOR SELECT
TO authenticated
USING (is_public = true);

-- =============================================
-- RLS FÜR foodspots TABLE
-- =============================================

-- RLS aktivieren
ALTER TABLE foodspots ENABLE ROW LEVEL SECURITY;

-- Users können Foodspots in ihren eigenen Listen sehen
CREATE POLICY "Users can view foodspots in own lists"
ON foodspots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lists 
    WHERE lists.id = foodspots.list_id 
    AND lists.user_id = auth.uid()
  )
);

-- Users können Foodspots in ihren eigenen Listen erstellen
CREATE POLICY "Users can create foodspots in own lists"
ON foodspots
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM lists 
    WHERE lists.id = foodspots.list_id 
    AND lists.user_id = auth.uid()
  )
);

-- Users können ihre eigenen Foodspots aktualisieren
CREATE POLICY "Users can update own foodspots"
ON foodspots
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users können ihre eigenen Foodspots löschen
CREATE POLICY "Users can delete own foodspots"
ON foodspots
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- SUCCESS: RLS Policies Created
-- =============================================















