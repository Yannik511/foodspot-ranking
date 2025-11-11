-- =============================================
-- MIGRATION 040: Shared List Invitation & Rating Fixes
-- =============================================
-- 1) Stellt sicher, dass Ratings bis 10.00 gespeichert werden können
-- 2) Aktualisiert accept_invitation(), um alte Einträge zu bereinigen
-- =============================================

-- 1) Rating-Spalten auf NUMERIC(4,2) sicherstellen (idempotent)
ALTER TABLE foodspots
  ALTER COLUMN rating TYPE NUMERIC(4,2)
  USING CASE
    WHEN rating IS NULL THEN NULL
    ELSE LEAST(rating::NUMERIC, 10.00)
  END;

ALTER TABLE foodspots
  ALTER COLUMN avg_score TYPE NUMERIC(4,2)
  USING CASE
    WHEN avg_score IS NULL THEN NULL
    ELSE LEAST(avg_score::NUMERIC, 10.00)
  END;

ALTER TABLE foodspot_ratings
  ALTER COLUMN score TYPE NUMERIC(4,2)
  USING CASE
    WHEN score IS NULL THEN NULL
    ELSE LEAST(score::NUMERIC, 10.00)
  END;

ALTER TABLE foodspot_ratings
  ALTER COLUMN score SET NOT NULL;

ALTER TABLE foodspot_ratings
  ADD CONSTRAINT foodspot_ratings_score_check CHECK (score >= 0 AND score <= 10);

-- 2) Einladung akzeptieren Funktion aktualisieren
DROP FUNCTION IF EXISTS accept_invitation(UUID);

CREATE OR REPLACE FUNCTION accept_invitation(p_invitation_id UUID)
RETURNS UUID AS $$
DECLARE
  v_list_id UUID;
  v_invitee_id UUID;
  v_is_owner BOOLEAN;
BEGIN
  PERFORM set_config('search_path', 'public', true);

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
    RETURN v_list_id;
  END IF;

  -- Bereinige alte akzeptierte/abgelehnte Einträge, damit Unique-Constraint nicht kollidiert
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

GRANT EXECUTE ON FUNCTION accept_invitation(UUID) TO authenticated;

-- =============================================
-- SUCCESS: Invitation handling & rating precision fixed
-- =============================================

