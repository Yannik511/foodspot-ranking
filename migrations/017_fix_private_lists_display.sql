-- =============================================
-- MIGRATION 017: FIX PRIVATE LISTS DISPLAY
-- =============================================
-- Behebt das Problem, dass alle Listen als "geteilt" angezeigt werden
-- Problem: Der Trigger add_owner_as_member fügte Owner automatisch als Mitglied hinzu
-- Lösung: Trigger entfernen und Owner-Einträge aus list_members entfernen
-- =============================================

-- =============================================
-- ENTFERNE TRIGGER UND FUNKTION
-- =============================================

-- Entferne Trigger
DROP TRIGGER IF EXISTS add_owner_as_member_trigger ON lists;

-- Entferne Funktion (wenn nicht anderswo verwendet)
DROP FUNCTION IF EXISTS add_owner_as_member() CASCADE;

-- =============================================
-- BEREINIGE BESTEHENDE OWNER-EINTRÄGE
-- =============================================

-- Entferne alle list_members Einträge, wo der User auch der Owner der Liste ist
-- Diese sollten nicht in list_members sein, da Owner-Zugriff über lists.user_id gehandhabt wird
DELETE FROM list_members
WHERE EXISTS (
  SELECT 1 FROM lists
  WHERE lists.id = list_members.list_id
  AND lists.user_id = list_members.user_id
);

-- =============================================
-- AKTUALISIERE HELPER-FUNKTIONEN
-- =============================================

-- Aktualisiere is_list_member Funktion: Owner zählt nicht als "Mitglied" in list_members
CREATE OR REPLACE FUNCTION is_list_member(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- User ist Owner
  IF EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND user_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- User ist eingeladenes Mitglied (nicht Owner)
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
    AND user_id = p_user_id
    -- Sicherstellen, dass User nicht Owner ist
    AND NOT EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id
      AND lists.user_id = p_user_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aktualisiere is_shared_list Funktion: Liste ist geteilt, wenn sie andere Mitglieder hat
CREATE OR REPLACE FUNCTION is_shared_list(p_list_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Liste ist geteilt, wenn sie andere Mitglieder hat (nicht nur Owner)
  RETURN EXISTS (
    SELECT 1 FROM list_members lm
    WHERE lm.list_id = p_list_id
    -- Mitglied ist nicht der Owner
    AND NOT EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = lm.list_id
      AND lists.user_id = lm.user_id
    )
  )
  -- Oder wenn es ausstehende Einladungen gibt
  OR EXISTS (
    SELECT 1 FROM list_invitations
    WHERE list_id = p_list_id
    AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SICHERSTELLEN: OWNER WIRD NICHT ALS MITGLIED HINZUGEFÜGT
-- =============================================

-- Constraint: Verhindere, dass Owner als Mitglied hinzugefügt wird
-- (Optional, aber hilfreich für Datenintegrität)
-- Hinweis: Dies kann zu Problemen führen, wenn wir später Owner auch in list_members haben wollen
-- Daher kommentiert - wir handhaben es in der Anwendungslogik

-- =============================================
-- AKTUALISIERE accept_invitation FUNKTION
-- =============================================

-- Aktualisiere accept_invitation Funktion, um zu verhindern, dass Owner als Mitglied hinzugefügt wird
CREATE OR REPLACE FUNCTION accept_invitation(p_invitation_id UUID)
RETURNS UUID AS $$
DECLARE
  v_list_id UUID;
  v_invitee_id UUID;
  v_is_owner BOOLEAN;
BEGIN
  -- Hole Einladungs-Details
  SELECT list_id, invitee_id INTO v_list_id, v_invitee_id
  FROM list_invitations
  WHERE id = p_invitation_id
  AND status = 'pending';
  
  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;
  
  -- Prüfe, ob User bereits Owner der Liste ist (sollte nicht passieren, aber sicherheitshalber)
  SELECT EXISTS (
    SELECT 1 FROM lists
    WHERE id = v_list_id
    AND user_id = v_invitee_id
  ) INTO v_is_owner;
  
  IF v_is_owner THEN
    -- User ist bereits Owner, entferne Einladung aber markiere als angenommen
    UPDATE list_invitations
    SET status = 'accepted',
        responded_at = NOW()
    WHERE id = p_invitation_id;
    -- Füge NICHT als Mitglied hinzu, da Owner bereits Zugriff hat
    RETURN v_list_id;
  END IF;
  
  -- Aktualisiere Einladungs-Status
  UPDATE list_invitations
  SET status = 'accepted',
      responded_at = NOW()
  WHERE id = p_invitation_id;
  
  -- Füge User als Mitglied hinzu (nur wenn nicht Owner)
  INSERT INTO list_members (list_id, user_id, role, joined_at)
  VALUES (v_list_id, v_invitee_id, 'editor', NOW())
  ON CONFLICT (list_id, user_id) DO UPDATE
  SET role = EXCLUDED.role,
      joined_at = EXCLUDED.joined_at;
  
  RETURN v_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SUCCESS: Private Lists Fix Applied
-- =============================================
-- Nach dieser Migration sollten private Listen wieder korrekt angezeigt werden
-- Geteilte Listen erscheinen nur, wenn sie tatsächlich andere Mitglieder haben

