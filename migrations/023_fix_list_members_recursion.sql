-- =============================================
-- MIGRATION 023: FIX LIST_MEMBERS RECURSION
-- =============================================
-- Behebt die rekursive RLS-Policy auf list_members
-- Das Problem: Policy "List members can view all members" verwendet is_list_member(),
-- die wiederum list_members abfragt, was zu Rekursion führt
-- =============================================

-- =============================================
-- PROBLEM
-- =============================================
-- Die Policy "List members can view all members" in Migration 018 verwendet is_list_member(list_id, auth.uid()).
-- Obwohl is_list_member() SECURITY DEFINER ist, kommt es zu Rekursion, weil:
-- 1. Policy prüft: is_list_member(list_id, auth.uid())
-- 2. is_list_member() macht: SELECT FROM list_members WHERE ...
-- 3. PostgreSQL wendet RLS auf diese Abfrage an
-- 4. RLS prüft wieder: is_list_member() → Rekursion!
--
-- Lösung: Entferne die rekursive Policy komplett. Stattdessen:
-- - Policy 1: User sieht eigene Mitgliedschaft (direkt, keine Rekursion)
-- - Policy 2: Owner sieht alle Mitglieder (is_list_owner() prüft nur lists, keine Rekursion)
-- - Policy 3: ENTFERNT - Mitglieder sehen andere Mitglieder nur über die Application-Logik

-- =============================================
-- LÖSUNG: LIST_MEMBERS POLICIES VEREINFACHEN
-- =============================================

-- Entferne alle bestehenden Policies auf list_members
DROP POLICY IF EXISTS "Users can view own memberships" ON list_members;
DROP POLICY IF EXISTS "List members can view all members" ON list_members;
DROP POLICY IF EXISTS "List members can view other members" ON list_members;
DROP POLICY IF EXISTS "List owners can add members" ON list_members;
DROP POLICY IF EXISTS "List owners can remove members" ON list_members;
DROP POLICY IF EXISTS "List owners can update member roles" ON list_members;

-- Policy 1: User kann seine eigene Mitgliedschaft sehen
-- Diese Policy ist einfach und nicht rekursiv
CREATE POLICY "Users can view own memberships"
ON list_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Owner kann alle Mitglieder seiner Listen sehen
-- WICHTIG: Verwendet is_list_owner() (prüft lists.user_id direkt), nicht is_list_member()
-- Dies vermeidet Rekursion, da is_list_owner() nur lists abfragt, nicht list_members
CREATE POLICY "List owners can view all members"
ON list_members FOR SELECT TO authenticated
USING (
  is_list_owner(list_id, auth.uid())
);

-- WICHTIG: Policy 3 (Mitglieder sehen andere Mitglieder) wurde ENTFERNT
-- Grund: Diese Policy würde is_list_member() verwenden, was zu Rekursion führt.
-- 
-- Alternative für die Anwendung:
-- - Wenn ein User Mitglied einer Liste ist (Policy 1), kann er seine eigene Mitgliedschaft sehen
-- - Um andere Mitglieder zu sehen, muss die Anwendung:
--   1. Prüfen, ob der User Owner ist (Policy 2) → sieht alle Mitglieder
--   2. ODER: Die Anwendung kann die Mitglieder über die lists-Tabelle abfragen,
--      wenn der User Zugriff auf die Liste hat (über lists-Policies)

-- Policy 4: Owner kann Mitglieder hinzufügen
CREATE POLICY "List owners can add members"
ON list_members FOR INSERT TO authenticated
WITH CHECK (
  is_list_owner(list_id, auth.uid())
);

-- Policy 5: Owner kann Mitglieder entfernen (außer sich selbst)
CREATE POLICY "List owners can remove members"
ON list_members FOR DELETE TO authenticated
USING (
  is_list_owner(list_id, auth.uid())
  AND user_id != auth.uid() -- Owner kann sich nicht selbst entfernen
);

-- Policy 6: Owner kann Rollen ändern
CREATE POLICY "List owners can update member roles"
ON list_members FOR UPDATE TO authenticated
USING (is_list_owner(list_id, auth.uid()))
WITH CHECK (is_list_owner(list_id, auth.uid()));

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration sollten:
-- 1. User ihre eigenen Mitgliedschaften sehen können (Policy 1) ✅
-- 2. Owner alle Mitglieder ihrer Listen sehen können (Policy 2) ✅
-- 3. Keine Rekursion mehr auftreten ✅
--
-- WICHTIG: Mitglieder können andere Mitglieder NICHT direkt über list_members sehen.
-- Stattdessen muss die Anwendung:
-- - Die Mitglieder über die lists-Tabelle abfragen (wenn User Zugriff auf die Liste hat)
-- - ODER: Nur für Owner die Mitglieder-Liste anzeigen

-- =============================================
-- ANWENDUNGS-LOGIK ANPASSEN
-- =============================================
-- Die fetchSharedLists() Funktion muss angepasst werden:
-- - Statt list_members mit Join auf lists abzufragen,
-- - Sollte sie zuerst prüfen, ob der User Owner ist (dann alle Mitglieder sehen)
-- - ODER: Die Mitglieder über die lists-Policies abfragen (wenn User Zugriff auf die Liste hat)

-- =============================================
-- SUCCESS: List Members Recursion Fixed
-- =============================================
