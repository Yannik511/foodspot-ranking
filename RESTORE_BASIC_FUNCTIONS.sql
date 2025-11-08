-- =============================================
-- RESTORE BASIC FUNCTIONS - VOLLSTÄNDIGER ROLLBACK
-- =============================================
-- Diese Query setzt die Datenbank auf den Stand VOR den Shared Lists Änderungen zurück
-- =============================================
-- Was wird gemacht:
-- 1. Löscht alle geteilten Listen Daten (list_collaborators, shared_lists)
-- 2. Entfernt ALLE Shared Lists Policies
-- 3. Entfernt ALLE erweiterten Policies für Collaborators
-- 4. Stellt die ursprünglichen, einfachen RLS Policies wieder her
-- =============================================
-- WICHTIG: 
-- - Freundschafts-Funktionen (friendships, activity) werden NICHT verändert!
-- - Freunde hinzufügen, Profil anzeigen, Vergleichen funktionieren weiterhin!
-- - Nur geteilte Listen Features werden entfernt
-- =============================================

-- =============================================
-- SCHRITT 1: Lösche alle geteilten Listen Daten
-- =============================================

DELETE FROM list_collaborators;
DELETE FROM shared_lists;

-- =============================================
-- SCHRITT 2: Lösche ALLE Shared Lists Policies
-- =============================================

-- Shared Lists Policies (alle Varianten)
DROP POLICY IF EXISTS "Users can view own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can create shared lists for own lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can update own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Users can delete own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Owners can view own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Owners can create shared lists for own lists" ON shared_lists;
DROP POLICY IF EXISTS "Owners can update own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Owners can delete own shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Owners and collaborators can view shared lists" ON shared_lists;
DROP POLICY IF EXISTS "List owners can create shared lists" ON shared_lists;
DROP POLICY IF EXISTS "List owners can update shared lists" ON shared_lists;
DROP POLICY IF EXISTS "List owners can delete shared lists" ON shared_lists;
DROP POLICY IF EXISTS "Friends can view shared lists if profile is public" ON shared_lists;
DROP POLICY IF EXISTS "List members can view shared lists" ON shared_lists;

-- List Collaborators Policies (alle Varianten)
DROP POLICY IF EXISTS "Users can view own collaborator entries" ON list_collaborators;
DROP POLICY IF EXISTS "Users can view collaborators of accessible lists" ON list_collaborators;
DROP POLICY IF EXISTS "Users can view their own collaborator entries" ON list_collaborators;
DROP POLICY IF EXISTS "Owners and collaborators can view collaborator entries" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can add collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can update collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can remove collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners and collaborators can remove collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "List owners can manage collaborators" ON list_collaborators;
DROP POLICY IF EXISTS "Users can remove collaborators" ON list_collaborators;

-- =============================================
-- SCHRITT 3: Lösche ALLE erweiterten Policies für Lists
-- =============================================

-- Erweiterte Policies für Lists (Collaborators können sehen)
DROP POLICY IF EXISTS "Collaborators can view shared lists" ON lists;
DROP POLICY IF EXISTS "List members can view lists" ON lists;
DROP POLICY IF EXISTS "Friends can view lists if profile is public" ON lists;
DROP POLICY IF EXISTS "Users can view accessible lists" ON lists;

-- =============================================
-- SCHRITT 4: Lösche ALLE erweiterten Policies für Foodspots
-- =============================================

-- Erweiterte Policies für Foodspots (Collaborators können sehen/bearbeiten)
DROP POLICY IF EXISTS "Collaborators can view foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "Editors can create foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "Editors can update foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "Editors can delete foodspots in shared lists" ON foodspots;
DROP POLICY IF EXISTS "List members can view foodspots" ON foodspots;
DROP POLICY IF EXISTS "Friends can view foodspots if profile is public" ON foodspots;
DROP POLICY IF EXISTS "Users can view foodspots in accessible lists" ON foodspots;

-- =============================================
-- SCHRITT 5: Lösche ALLE bestehenden Policies für lists und foodspots
-- =============================================
-- (Wir erstellen sie danach neu mit den ursprünglichen, einfachen Policies)

DROP POLICY IF EXISTS "Users can view own lists" ON lists;
DROP POLICY IF EXISTS "Users can create own lists" ON lists;
DROP POLICY IF EXISTS "Users can update own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON lists;
DROP POLICY IF EXISTS "Public lists are viewable by all users" ON lists;

DROP POLICY IF EXISTS "Users can view foodspots in own lists" ON foodspots;
DROP POLICY IF EXISTS "Users can create foodspots in own lists" ON foodspots;
DROP POLICY IF EXISTS "Users can update own foodspots" ON foodspots;
DROP POLICY IF EXISTS "Users can delete own foodspots" ON foodspots;

-- =============================================
-- SCHRITT 6: Stelle sicher, dass RLS aktiviert ist
-- =============================================

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodspots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SCHRITT 7: Erstelle die ursprünglichen, einfachen Policies NEU
-- =============================================

-- =============================================
-- LISTS POLICIES - URSPRÜNGLICH & EINFACH
-- =============================================

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
-- (Nur wenn is_public Spalte existiert - sonst wird diese Policy übersprungen)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lists' 
    AND column_name = 'is_public'
  ) THEN
    CREATE POLICY "Public lists are viewable by all users"
    ON lists
    FOR SELECT
    TO authenticated
    USING (is_public = true AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- =============================================
-- FOODSPOTS POLICIES - URSPRÜNGLICH & EINFACH
-- =============================================

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
-- SCHRITT 8: VERIFIKATION
-- =============================================

-- Zeige alle Policies für lists
SELECT 
  'lists' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'lists'
ORDER BY policyname;

-- Zeige alle Policies für foodspots
SELECT 
  'foodspots' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'foodspots'
ORDER BY policyname;

-- Zeige alle Policies für shared_lists (sollten keine sein)
SELECT 
  'shared_lists' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'shared_lists'
ORDER BY policyname;

-- Zeige alle Policies für list_collaborators (sollten keine sein)
SELECT 
  'list_collaborators' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'list_collaborators'
ORDER BY policyname;

-- Prüfe, ob noch geteilte Listen Daten vorhanden sind
SELECT 
  (SELECT COUNT(*) FROM list_collaborators) as remaining_collaborators,
  (SELECT COUNT(*) FROM shared_lists) as remaining_shared_lists;

-- Überprüfe, ob friendships Policies noch vorhanden sind (sollten nicht verändert worden sein)
SELECT 
  'friendships' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'friendships'
ORDER BY policyname;

-- =============================================
-- SUCCESS: Grundfunktionen wiederhergestellt!
-- =============================================
-- Nach dieser Migration sollten funktionieren:
-- ✅ Listen erstellen
-- ✅ Listen anzeigen (nur eigene)
-- ✅ Listen bearbeiten
-- ✅ Listen löschen
-- ✅ Foodspots hinzufügen
-- ✅ Foodspots bearbeiten
-- ✅ Foodspots löschen
-- ✅ Welcome Screen nur bei 0 Listen
-- ✅ Freunde hinzufügen (friendships Tabelle unverändert)
-- ✅ Freunde anzeigen (FriendsTab funktioniert)
-- ✅ Profil anzeigen (FriendProfile funktioniert)
-- ✅ Vergleichen (Compare funktioniert)
-- ❌ Geteilte Listen (deaktiviert - nur Daten gelöscht, Tabellen bleiben)
-- =============================================
-- WICHTIG: Freundschafts-Features sind NICHT betroffen!
-- =============================================
