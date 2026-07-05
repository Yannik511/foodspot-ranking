-- =============================================
-- MIGRATION 053: send_list_invitations RPC (Einladungen mit Dedup)
-- =============================================
-- Behebt: duplicate key value violates unique constraint
--         "list_invitations_list_id_invitee_id_status_key" (23505).
--
-- Ursache: Ein einladendes MITGLIED darf per RLS bestehende Einladungen nicht
-- sehen (nur Owner + Eingeladener). Der clientseitige Dedup-Filter läuft daher
-- ins Leere und ein bereits 'pending' Eingeladener wird erneut eingeladen.
--
-- Lösung: SECURITY DEFINER Funktion, die serverseitig entscheidet und
-- dedupliziert. Räumt zusätzlich alte 'accepted'/'rejected'-Zeilen weg, damit
-- weder der INSERT noch ein späteres accept/reject am Unique-Constraint
-- (list_id, invitee_id, status) kollidiert.
--
-- Rückgabe: Anzahl der NEU erstellten Einladungen.
-- =============================================

CREATE OR REPLACE FUNCTION "public"."send_list_invitations"(
  "p_list_id" "uuid",
  "p_invitee_ids" "uuid"[]
) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id            uuid := auth.uid();
  v_is_owner           boolean;
  v_members_can_invite boolean;
  v_is_editor          boolean := false;
  v_invitee            uuid;
  v_new_count          integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Owner + Invite-Toggle in einem Zug holen
  SELECT (l.user_id = v_user_id), COALESCE(l.members_can_invite, false)
    INTO v_is_owner, v_members_can_invite
  FROM lists l
  WHERE l.id = p_list_id;

  IF v_is_owner IS NULL THEN
    RAISE EXCEPTION 'List not found' USING ERRCODE = 'P0002';
  END IF;

  -- Editor-Mitglied?
  IF NOT v_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM list_members
      WHERE list_id = p_list_id AND user_id = v_user_id AND role = 'editor'
    ) INTO v_is_editor;
  END IF;

  -- Berechtigung: Owner immer; Mitglied nur wenn members_can_invite = true
  IF NOT (v_is_owner OR (v_is_editor AND v_members_can_invite)) THEN
    RAISE EXCEPTION 'Not authorized to invite to this list' USING ERRCODE = '42501';
  END IF;

  FOREACH v_invitee IN ARRAY COALESCE(p_invitee_ids, ARRAY[]::uuid[]) LOOP
    -- Sich selbst überspringen
    CONTINUE WHEN v_invitee = v_user_id;

    -- Bereits Mitglied? überspringen
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM list_members WHERE list_id = p_list_id AND user_id = v_invitee
    );

    -- Owner der Liste? überspringen
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM lists WHERE id = p_list_id AND user_id = v_invitee
    );

    -- Alte beantwortete Einladungen entfernen (verhindert Constraint-Kollisionen)
    DELETE FROM list_invitations
    WHERE list_id = p_list_id
      AND invitee_id = v_invitee
      AND status IN ('accepted', 'rejected');

    -- Pending anlegen; existiert bereits eine pending Einladung, passiert nichts
    INSERT INTO list_invitations (list_id, inviter_id, invitee_id, role, status)
    VALUES (p_list_id, v_user_id, v_invitee, 'editor', 'pending')
    ON CONFLICT ("list_id", "invitee_id", "status") DO NOTHING;

    IF FOUND THEN
      v_new_count := v_new_count + 1;
    END IF;
  END LOOP;

  RETURN v_new_count;
END;
$$;

ALTER FUNCTION "public"."send_list_invitations"("uuid", "uuid"[]) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."send_list_invitations"("uuid", "uuid"[]) TO "authenticated";
