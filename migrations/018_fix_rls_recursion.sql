-- =============================================
-- MIGRATION 018: FIX RLS RECURSION
-- =============================================
-- Behebt infinite recursion in RLS Policies durch Verwendung von
-- SECURITY DEFINER Funktionen, die RLS umgehen
-- =============================================

-- =============================================
-- SCHRITT 1: BACKUP DER AKTUELLEN POLICIES
-- =============================================
-- Alle Policies werden durch DROP/CREATE ersetzt
-- Die ursprünglichen Policies bleiben in den vorherigen Migrationen erhalten

-- =============================================
-- SCHRITT 2: SECURITY DEFINER FUNKTIONEN ERSTELLEN
-- =============================================
-- Diese Funktionen umgehen RLS und können in Policies verwendet werden

-- Funktion: Prüft ob User Owner einer Liste ist (ohne RLS)
CREATE OR REPLACE FUNCTION is_list_owner(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion: Prüft ob User Mitglied einer Liste ist (ohne RLS)
CREATE OR REPLACE FUNCTION is_list_member(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion: Prüft ob User Editor einer Liste ist (ohne RLS)
CREATE OR REPLACE FUNCTION is_list_editor(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
    AND user_id = p_user_id
    AND role = 'editor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SCHRITT 3: LIST_MEMBERS POLICIES NEU ERSTELLEN
-- =============================================
-- Entferne alle bestehenden Policies und erstelle sie neu ohne Rekursion

-- Entferne alle bestehenden Policies auf list_members
DROP POLICY IF EXISTS "Users can view own memberships" ON list_members;
DROP POLICY IF EXISTS "List members can view all members" ON list_members;
DROP POLICY IF EXISTS "List owners can add members" ON list_members;
DROP POLICY IF EXISTS "List owners can remove members" ON list_members;
DROP POLICY IF EXISTS "List owners can update member roles" ON list_members;

-- Policy 1: User kann seine eigene Mitgliedschaft sehen
CREATE POLICY "Users can view own memberships"
ON list_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: User kann Mitglieder sehen, wenn er selbst Mitglied ist ODER Owner
-- WICHTIG: Verwendet SECURITY DEFINER Funktion statt direkter JOIN
CREATE POLICY "List members can view all members"
ON list_members FOR SELECT TO authenticated
USING (
  -- User ist selbst Mitglied dieser Liste
  is_list_member(list_id, auth.uid())
  -- ODER User ist Owner dieser Liste
  OR is_list_owner(list_id, auth.uid())
);

-- Policy 3: Owner kann Mitglieder hinzufügen
CREATE POLICY "List owners can add members"
ON list_members FOR INSERT TO authenticated
WITH CHECK (
  is_list_owner(list_id, auth.uid())
);

-- Policy 4: Owner kann Mitglieder entfernen (außer sich selbst)
CREATE POLICY "List owners can remove members"
ON list_members FOR DELETE TO authenticated
USING (
  is_list_owner(list_id, auth.uid())
  AND user_id != auth.uid() -- Owner kann sich nicht selbst entfernen
);

-- Policy 5: Owner kann Rollen ändern
CREATE POLICY "List owners can update member roles"
ON list_members FOR UPDATE TO authenticated
USING (is_list_owner(list_id, auth.uid()))
WITH CHECK (is_list_owner(list_id, auth.uid()));

-- =============================================
-- SCHRITT 4: LISTS POLICIES NEU ERSTELLEN
-- =============================================
-- Entferne problematische Policies und erstelle sie neu

-- Entferne die rekursive Policy
DROP POLICY IF EXISTS "List members can view shared lists" ON lists;
DROP POLICY IF EXISTS "List editors can update shared lists" ON lists;

-- Policy 1: Mitglieder können geteilte Listen sehen (NICHT Owner, da bereits abgedeckt)
-- WICHTIG: Verwendet SECURITY DEFINER Funktion statt direkter JOIN
CREATE POLICY "List members can view shared lists"
ON lists FOR SELECT TO authenticated
USING (
  -- User ist Mitglied (aber NICHT Owner, da Owner bereits durch "Users can view own lists" abgedeckt)
  is_list_member(id, auth.uid())
  AND NOT is_list_owner(id, auth.uid())
);

-- Policy 2: Editor-Mitglieder können geteilte Listen aktualisieren
CREATE POLICY "List editors can update shared lists"
ON lists FOR UPDATE TO authenticated
USING (
  -- User ist Editor (aber NICHT Owner)
  is_list_editor(id, auth.uid())
  AND NOT is_list_owner(id, auth.uid())
)
WITH CHECK (
  is_list_editor(id, auth.uid())
  AND NOT is_list_owner(id, auth.uid())
);

-- =============================================
-- SCHRITT 5: LIST_INVITATIONS POLICIES NEU ERSTELLEN
-- =============================================
-- Auch hier SECURITY DEFINER Funktionen verwenden

-- Entferne bestehende Policies
DROP POLICY IF EXISTS "List owners can view all invitations" ON list_invitations;
DROP POLICY IF EXISTS "List owners can create invitations" ON list_invitations;

-- Policy 1: Owner kann alle Einladungen seiner Liste sehen
CREATE POLICY "List owners can view all invitations"
ON list_invitations FOR SELECT TO authenticated
USING (
  is_list_owner(list_id, auth.uid())
);

-- Policy 2: Owner kann Einladungen erstellen
CREATE POLICY "List owners can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  is_list_owner(list_id, auth.uid())
);

-- =============================================
-- SCHRITT 6: FOODSPOTS POLICIES NEU ERSTELLEN
-- =============================================
-- WICHTIG: Die ursprünglichen Policies ("Users can view foodspots in own lists" etc.)
-- bleiben erhalten und funktionieren weiterhin für private Listen
-- Diese neuen Policies sind ZUSÄTZLICH für geteilte Listen

-- Entferne nur die problematischen rekursiven Policies
DROP POLICY IF EXISTS "List members can view foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "List editors can create foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "List editors can update foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "List editors can delete foodspots in shared lists" ON foodspots;

-- Policy 1: Mitglieder können Foodspots in geteilten Listen sehen
CREATE POLICY "List members can view foodspots in shared lists"
ON foodspots FOR SELECT TO authenticated
USING (
  -- User ist Owner ODER Mitglied
  is_list_owner(list_id, auth.uid())
  OR is_list_member(list_id, auth.uid())
);

-- Policy 2: Editor-Mitglieder können Foodspots erstellen
CREATE POLICY "List editors can create foodspots in shared lists"
ON foodspots FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_list_owner(list_id, auth.uid())
    OR is_list_editor(list_id, auth.uid())
  )
);

-- Policy 3: Editor-Mitglieder können Foodspots aktualisieren
CREATE POLICY "List editors can update foodspots in shared lists"
ON foodspots FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    is_list_owner(list_id, auth.uid())
    OR is_list_editor(list_id, auth.uid())
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_list_owner(list_id, auth.uid())
    OR is_list_editor(list_id, auth.uid())
  )
);

-- Policy 4: Editor-Mitglieder können Foodspots löschen
CREATE POLICY "List editors can delete foodspots in shared lists"
ON foodspots FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    is_list_owner(list_id, auth.uid())
    OR is_list_editor(list_id, auth.uid())
  )
);

-- =============================================
-- SUCCESS: RLS Recursion Fixed
-- =============================================
-- Alle Policies verwenden jetzt SECURITY DEFINER Funktionen
-- Keine zirkulären Abhängigkeiten mehr
-- Ursprüngliche "Users can view own lists" Policy bleibt unverändert

