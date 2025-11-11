-- =============================================
-- MIGRATION 015: CREATE SHARED LISTS SYSTEM
-- =============================================
-- Erstellt Tabellen für geteilte Listen:
-- - list_members: Mitglieder einer Liste (Owner + eingeladene)
-- - list_invitations: Einladungen zu geteilten Listen
-- =============================================

-- =============================================
-- LIST_MEMBERS TABLE
-- =============================================
-- Speichert alle Mitglieder einer geteilten Liste
CREATE TABLE IF NOT EXISTS list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ein User kann nur einmal Mitglied einer Liste sein
  UNIQUE(list_id, user_id)
);

COMMENT ON TABLE list_members IS 'Mitglieder geteilter Listen (inkl. Owner)';
COMMENT ON COLUMN list_members.role IS 'Rolle: editor (kann bearbeiten) oder viewer (nur lesen)';

-- =============================================
-- LIST_INVITATIONS TABLE
-- =============================================
-- Speichert Einladungen zu geteilten Listen
CREATE TABLE IF NOT EXISTS list_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'editor' CHECK (role IN ('viewer', 'editor')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Ein User kann nur eine offene Einladung pro Liste haben
  UNIQUE(list_id, invitee_id, status)
);

COMMENT ON TABLE list_invitations IS 'Einladungen zu geteilten Listen';
COMMENT ON COLUMN list_invitations.role IS 'Rolle des eingeladenen Users: viewer oder editor';
COMMENT ON COLUMN list_invitations.status IS 'Status: pending, accepted, rejected';

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_list_members_list_id ON list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_user_id ON list_members(user_id);
CREATE INDEX IF NOT EXISTS idx_list_invitations_list_id ON list_invitations(list_id);
CREATE INDEX IF NOT EXISTS idx_list_invitations_invitee_id ON list_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_list_invitations_inviter_id ON list_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_list_invitations_status ON list_invitations(status);

-- =============================================
-- RLS POLICIES FOR LIST_MEMBERS
-- =============================================

ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;

-- Mitglieder können ihre eigenen Mitgliedschaften sehen
CREATE POLICY "Users can view own memberships"
ON list_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Liste-Owner und Mitglieder können alle Mitglieder einer Liste sehen
CREATE POLICY "List members can view all members"
ON list_members FOR SELECT TO authenticated
USING (
  -- User ist Mitglied der Liste
  EXISTS (
    SELECT 1 FROM list_members lm
    WHERE lm.list_id = list_members.list_id
    AND lm.user_id = auth.uid()
  )
  -- Oder User ist Owner der Liste
  OR EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_members.list_id
    AND lists.user_id = auth.uid()
  )
);

-- Liste-Owner kann Mitglieder hinzufügen
CREATE POLICY "List owners can add members"
ON list_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_members.list_id
    AND lists.user_id = auth.uid()
  )
);

-- Liste-Owner kann Mitglieder entfernen (außer sich selbst)
CREATE POLICY "List owners can remove members"
ON list_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_members.list_id
    AND lists.user_id = auth.uid()
  )
  AND user_id != auth.uid() -- Owner kann sich nicht selbst entfernen
);

-- Liste-Owner kann Rollen ändern
CREATE POLICY "List owners can update member roles"
ON list_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_members.list_id
    AND lists.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_members.list_id
    AND lists.user_id = auth.uid()
  )
);

-- =============================================
-- RLS POLICIES FOR LIST_INVITATIONS
-- =============================================

ALTER TABLE list_invitations ENABLE ROW LEVEL SECURITY;

-- Eingeladene können ihre eigenen Einladungen sehen
CREATE POLICY "Users can view own invitations"
ON list_invitations FOR SELECT TO authenticated
USING (auth.uid() = invitee_id);

-- Liste-Owner kann alle Einladungen seiner Liste sehen
CREATE POLICY "List owners can view all invitations"
ON list_invitations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_invitations.list_id
    AND lists.user_id = auth.uid()
  )
);

-- Liste-Owner kann Einladungen erstellen
CREATE POLICY "List owners can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lists
    WHERE lists.id = list_invitations.list_id
    AND lists.user_id = auth.uid()
  )
  AND inviter_id = auth.uid()
);

-- Eingeladene können Einladungen annehmen/ablehnen
CREATE POLICY "Invitees can respond to invitations"
ON list_invitations FOR UPDATE TO authenticated
USING (auth.uid() = invitee_id AND status = 'pending')
WITH CHECK (
  auth.uid() = invitee_id
  AND status IN ('accepted', 'rejected')
  AND responded_at IS NOT NULL
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Funktion: Prüft ob User Mitglied einer Liste ist
CREATE OR REPLACE FUNCTION is_list_member(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
    AND user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_list_member IS 'Prüft ob ein User Mitglied einer Liste ist (Owner oder eingeladenes Mitglied)';

-- Funktion: Prüft ob Liste geteilt ist (hat Mitglieder oder offene Einladungen)
CREATE OR REPLACE FUNCTION is_shared_list(p_list_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
  )
  OR EXISTS (
    SELECT 1 FROM list_invitations
    WHERE list_id = p_list_id
    AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_shared_list IS 'Prüft ob eine Liste geteilt ist (hat Mitglieder oder offene Einladungen)';

-- HINWEIS: Owner wird NICHT automatisch als Mitglied hinzugefügt
-- Owner-Zugriff wird über user_id in lists Tabelle gehandhabt
-- list_members wird nur für geteilte Listen verwendet (andere Mitglieder)
-- Der Trigger wurde entfernt, da er alle Listen als "geteilt" markiert hätte
--
-- WICHTIG: Wenn die Migration bereits ausgeführt wurde und der Trigger existiert,
-- führe Migration 017_fix_private_lists_display.sql aus, um den Trigger zu entfernen
-- und bestehende Owner-Einträge zu bereinigen

-- Funktion: Verarbeitet Annahme einer Einladung
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
  
  -- Bereinige ggf. alte Eintragungen (z.B. akzeptierte Einladungen aus vorherigen Runden)
  DELETE FROM list_invitations
  WHERE list_id = v_list_id
    AND invitee_id = v_invitee_id
    AND status IN ('accepted', 'rejected')
    AND id <> p_invitation_id;
  
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

COMMENT ON FUNCTION accept_invitation IS 'Verarbeitet Annahme einer Einladung: Aktualisiert Status und fügt User als Mitglied hinzu';

-- Funktion: Verarbeitet Ablehnung einer Einladung
CREATE OR REPLACE FUNCTION reject_invitation(p_invitation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE list_invitations
  SET status = 'rejected',
      responded_at = NOW()
  WHERE id = p_invitation_id
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reject_invitation IS 'Verarbeitet Ablehnung einer Einladung: Aktualisiert Status';

-- =============================================
-- GRANTS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON list_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON list_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION is_list_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_shared_list(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_invitation(UUID) TO authenticated;

-- =============================================
-- SUCCESS: Shared Lists System Created
-- =============================================

