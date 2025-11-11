-- =============================================
-- MIGRATION 024: ALLOW INVITEES TO ADD THEMSELVES AS MEMBERS
-- =============================================
-- Erlaubt es Eingeladenen, sich selbst als Mitglieder hinzuzufügen,
-- wenn sie eine angenommene Einladung haben
-- =============================================

-- =============================================
-- PROBLEM
-- =============================================
-- Die Policy "List owners can add members" in Migration 023 erlaubt nur OWNERn,
-- Mitglieder hinzuzufügen. Aber wenn ein User eine Einladung annimmt,
-- muss er sich selbst als Mitglied hinzufügen können, auch wenn er nicht der Owner ist.

-- =============================================
-- LÖSUNG: NEUE POLICY FÜR LIST_MEMBERS INSERT
-- =============================================

-- Entferne die alte Policy (wird durch zwei neue Policies ersetzt)
DROP POLICY IF EXISTS "List owners can add members" ON list_members;

-- Policy 1: Owner kann Mitglieder hinzufügen
CREATE POLICY "List owners can add members"
ON list_members FOR INSERT TO authenticated
WITH CHECK (
  is_list_owner(list_id, auth.uid())
);

-- Policy 2: Eingeladene können sich selbst hinzufügen, wenn sie eine angenommene Einladung haben
-- WICHTIG: Diese Policy muss direkt auf list_invitations prüfen, aber das könnte zu Rekursion führen,
-- wenn list_invitations-Policies list_members abfragen.
-- 
-- Lösung: Da list_invitations-Policies NUR auf list_invitations prüfen (nicht auf list_members),
-- sollte es keine Rekursion geben. Die Policy "Invitees can view their own invitations" prüft nur
-- auth.uid() = invitee_id, was keine Rekursion verursacht.
--
-- ABER: Um sicher zu sein, verwenden wir eine direkte Prüfung ohne EXISTS-Subquery,
-- die möglicherweise RLS-Policies triggern könnte.
--
-- Bessere Lösung: Verwende eine SECURITY DEFINER Funktion, die list_invitations direkt prüft
-- (ohne RLS), um sicherzustellen, dass keine Rekursion auftritt.

-- Funktion: Prüft ob User eine angenommene Einladung für eine Liste hat (ohne RLS)
CREATE OR REPLACE FUNCTION has_accepted_invitation(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  -- Diese Funktion umgeht RLS komplett, um Rekursion zu vermeiden
  RETURN EXISTS (
    SELECT 1 FROM list_invitations
    WHERE list_id = p_list_id
    AND invitee_id = p_user_id
    AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kommentar für die Funktion
COMMENT ON FUNCTION has_accepted_invitation(UUID, UUID) IS 'Prüft ob ein User eine angenommene Einladung für eine Liste hat (ohne RLS) - verhindert Rekursion';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION has_accepted_invitation(UUID, UUID) TO authenticated;

-- Policy 2: Eingeladene können sich selbst hinzufügen, wenn sie eine angenommene Einladung haben
-- WICHTIG: Verwendet SECURITY DEFINER Funktion, um Rekursion zu vermeiden
CREATE POLICY "Invitees can add themselves when accepting invitation"
ON list_members FOR INSERT TO authenticated
WITH CHECK (
  -- User fügt sich selbst hinzu
  auth.uid() = user_id
  -- UND User hat eine angenommene Einladung für diese Liste
  -- WICHTIG: Verwendet SECURITY DEFINER Funktion, um RLS zu umgehen
  AND has_accepted_invitation(list_id, auth.uid())
);

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration sollten:
-- 1. Owner weiterhin Mitglieder hinzufügen können (Policy 1) ✅
-- 2. Eingeladene sich selbst hinzufügen können, wenn sie eine angenommene Einladung haben (Policy 2) ✅
-- 3. Keine Rekursion auftreten, da die Policy direkt auf list_invitations prüft (nicht über list_members) ✅

-- =============================================
-- SUCCESS: Invitees Can Add Themselves
-- =============================================

