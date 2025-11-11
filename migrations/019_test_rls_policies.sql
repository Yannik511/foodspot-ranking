-- =============================================
-- MIGRATION 019: TEST RLS POLICIES
-- =============================================
-- Test-Queries um zu verifizieren, dass keine Rekursion mehr existiert
-- =============================================

-- Diese Migration enthält nur Test-Queries
-- Führe sie manuell aus, um zu testen, ob alles funktioniert

-- =============================================
-- TEST 1: Prüfe ob SECURITY DEFINER Funktionen existieren
-- =============================================

-- Sollte 3 Funktionen zurückgeben:
SELECT 
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN ('is_list_owner', 'is_list_member', 'is_list_editor')
ORDER BY proname;

-- =============================================
-- TEST 2: Prüfe ob alle Policies existieren
-- =============================================

-- Sollte alle Policies für lists zurückgeben:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'lists'
ORDER BY policyname;

-- Sollte alle Policies für list_members zurückgeben:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'list_members'
ORDER BY policyname;

-- =============================================
-- TEST 3: Prüfe auf zirkuläre Abhängigkeiten
-- =============================================

-- Diese Query sollte KEINE Ergebnisse zurückgeben (keine Rekursion):
-- Wenn Ergebnisse zurückkommen, gibt es noch zirkuläre Abhängigkeiten
SELECT 
  p1.policyname as policy1,
  p1.tablename as table1,
  p2.policyname as policy2,
  p2.tablename as table2
FROM pg_policies p1
JOIN pg_policies p2 ON p1.tablename != p2.tablename
WHERE p1.tablename IN ('lists', 'list_members')
  AND p2.tablename IN ('lists', 'list_members')
  AND (
    -- Prüfe ob Policy1 auf Table2 referenziert und umgekehrt
    (p1.policyname LIKE '%list_members%' AND p2.tablename = 'list_members')
    OR
    (p1.policyname LIKE '%lists%' AND p2.tablename = 'lists')
  );

-- =============================================
-- TEST 4: Manuelle Tests (als eingeloggter User ausführen)
-- =============================================

-- Als Owner: Sollte eigene Listen sehen können
-- SELECT * FROM lists WHERE user_id = auth.uid();

-- Als Owner: Sollte Mitglieder seiner Listen sehen können
-- SELECT * FROM list_members WHERE list_id IN (
--   SELECT id FROM lists WHERE user_id = auth.uid()
-- );

-- Als Member: Sollte geteilte Listen sehen können
-- SELECT * FROM lists WHERE id IN (
--   SELECT list_id FROM list_members WHERE user_id = auth.uid()
-- );

-- =============================================
-- HINWEIS
-- =============================================
-- Diese Tests sollten alle erfolgreich sein
-- Falls Fehler auftreten, überprüfe die Migration 018



