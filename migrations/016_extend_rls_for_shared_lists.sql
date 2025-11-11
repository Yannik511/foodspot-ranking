-- =============================================
-- MIGRATION 016: EXTEND RLS FOR SHARED LISTS
-- =============================================
-- Erweitert RLS Policies für lists und foodspots,
-- damit Mitglieder geteilter Listen auch Zugriff haben
-- =============================================

-- =============================================
-- EXTEND LISTS RLS POLICIES
-- =============================================

-- WICHTIG: Diese Policy wird ZUSÄTZLICH zur bestehenden "Users can view own lists" Policy erstellt
-- PostgreSQL kombiniert SELECT Policies mit OR, also sollten beide funktionieren
-- Die ursprüngliche Policy "Users can view own lists" bleibt erhalten und funktioniert weiterhin

-- Neue Policy: Mitglieder können geteilte Listen sehen
-- Diese Policy erweitert die Sichtbarkeit für Mitglieder geteilter Listen
-- Owner können ihre Listen weiterhin über "Users can view own lists" sehen
CREATE POLICY "List members can view shared lists"
ON lists FOR SELECT TO authenticated
USING (
  -- User ist Mitglied der Liste (aber nicht Owner, da Owner bereits durch andere Policy abgedeckt)
  EXISTS (
    SELECT 1 FROM list_members
    WHERE list_members.list_id = lists.id
    AND list_members.user_id = auth.uid()
    -- Sicherstellen, dass User nicht Owner ist (Owner wird bereits durch andere Policy abgedeckt)
    AND NOT (
      EXISTS (
        SELECT 1 FROM lists l2
        WHERE l2.id = list_members.list_id
        AND l2.user_id = auth.uid()
      )
    )
  )
);

-- WICHTIG: Diese Policy wird ZUSÄTZLICH zur bestehenden "Users can update own lists" Policy erstellt
-- Die ursprüngliche Policy "Users can update own lists" bleibt erhalten für Owner

-- Neue Policy: Editor-Mitglieder können geteilte Listen aktualisieren
-- Diese Policy erweitert die Update-Berechtigung für Editor-Mitglieder
-- Owner können ihre Listen weiterhin über "Users can update own lists" aktualisieren
CREATE POLICY "List editors can update shared lists"
ON lists FOR UPDATE TO authenticated
USING (
  -- User ist Editor-Mitglied (aber nicht Owner, da Owner bereits durch andere Policy abgedeckt)
  EXISTS (
    SELECT 1 FROM list_members
    WHERE list_members.list_id = lists.id
    AND list_members.user_id = auth.uid()
    AND list_members.role = 'editor'
    -- Sicherstellen, dass User nicht Owner ist
    AND NOT (
      EXISTS (
        SELECT 1 FROM lists l2
        WHERE l2.id = list_members.list_id
        AND l2.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  -- User ist Editor-Mitglied (aber nicht Owner)
  EXISTS (
    SELECT 1 FROM list_members
    WHERE list_members.list_id = lists.id
    AND list_members.user_id = auth.uid()
    AND list_members.role = 'editor'
    -- Sicherstellen, dass User nicht Owner ist
    AND NOT (
      EXISTS (
        SELECT 1 FROM lists l2
        WHERE l2.id = list_members.list_id
        AND l2.user_id = auth.uid()
      )
    )
  )
);

-- =============================================
-- EXTEND FOODSPOTS RLS POLICIES
-- =============================================

-- Neue Policy: Mitglieder können Foodspots in geteilten Listen sehen
CREATE POLICY "List members can view foodspots in shared lists"
ON foodspots FOR SELECT TO authenticated
USING (
  -- User ist Owner der Liste
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = foodspots.list_id
    AND lists.user_id = auth.uid()
  )
  -- Oder User ist Mitglied der Liste
  OR EXISTS (
    SELECT 1 FROM list_members
    WHERE list_members.list_id = foodspots.list_id
    AND list_members.user_id = auth.uid()
  )
);

-- Neue Policy: Editor-Mitglieder können Foodspots in geteilten Listen erstellen
CREATE POLICY "List editors can create foodspots in shared lists"
ON foodspots FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- User ist Owner der Liste
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = foodspots.list_id
      AND lists.user_id = auth.uid()
    )
    -- Oder User ist Editor-Mitglied
    OR EXISTS (
      SELECT 1 FROM list_members
      WHERE list_members.list_id = foodspots.list_id
      AND list_members.user_id = auth.uid()
      AND list_members.role = 'editor'
    )
  )
);

-- Neue Policy: Editor-Mitglieder können Foodspots in geteilten Listen aktualisieren
CREATE POLICY "List editors can update foodspots in shared lists"
ON foodspots FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    -- User ist Owner der Liste
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = foodspots.list_id
      AND lists.user_id = auth.uid()
    )
    -- Oder User ist Editor-Mitglied
    OR EXISTS (
      SELECT 1 FROM list_members
      WHERE list_members.list_id = foodspots.list_id
      AND list_members.user_id = auth.uid()
      AND list_members.role = 'editor'
    )
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- User ist Owner der Liste
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = foodspots.list_id
      AND lists.user_id = auth.uid()
    )
    -- Oder User ist Editor-Mitglied
    OR EXISTS (
      SELECT 1 FROM list_members
      WHERE list_members.list_id = foodspots.list_id
      AND list_members.user_id = auth.uid()
      AND list_members.role = 'editor'
    )
  )
);

-- Neue Policy: Editor-Mitglieder können Foodspots in geteilten Listen löschen
CREATE POLICY "List editors can delete foodspots in shared lists"
ON foodspots FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    -- User ist Owner der Liste
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = foodspots.list_id
      AND lists.user_id = auth.uid()
    )
    -- Oder User ist Editor-Mitglied
    OR EXISTS (
      SELECT 1 FROM list_members
      WHERE list_members.list_id = foodspots.list_id
      AND list_members.user_id = auth.uid()
      AND list_members.role = 'editor'
    )
  )
);

-- =============================================
-- SUCCESS: RLS Extended for Shared Lists
-- =============================================

