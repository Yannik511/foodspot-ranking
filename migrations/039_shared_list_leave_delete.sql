-- =============================================
-- MIGRATION 039: Shared List Leave & Delete Logic
-- =============================================
-- Ergänzt die serverseitige Funktion leave_shared_list(list_id)
--  * Entfernt Mitgliedschaft, persönliche Bewertungen/Fotos
--  * Aktualisiert Cover-Bilder und Aggregationen
--  * Entfernt Foodspots ohne weitere Beiträge
-- =============================================

-- =============================================
-- Funktion: Liste verlassen
-- =============================================

-- Falls Funktion bereits existiert (z.B. bei erneutem Deploy), zuerst löschen,
-- damit sich geänderte Rückgabe-Parameter sauber anwenden lassen.
DROP FUNCTION IF EXISTS leave_shared_list(UUID);

CREATE OR REPLACE FUNCTION leave_shared_list(p_list_id UUID)
RETURNS TABLE (
  list_id UUID,
  ratings_removed INTEGER,
  photos_removed INTEGER,
  spots_removed INTEGER,
  invitations_removed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_owner BOOLEAN;
  v_membership_exists BOOLEAN;
  v_affected_spots UUID[] := ARRAY[]::UUID[];
  v_deleted_spots UUID[] := ARRAY[]::UUID[];
  v_spot UUID;
  v_cover RECORD;
  v_removed_ratings INTEGER := 0;
  v_removed_photos INTEGER := 0;
  v_removed_spots INTEGER := 0;
  v_removed_invitations INTEGER := 0;
  rec RECORD;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_list_id IS NULL THEN
    RAISE EXCEPTION 'list_id is required' USING ERRCODE = '23502';
  END IF;

  PERFORM 1 FROM lists WHERE id = p_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT is_list_owner(p_list_id, v_user_id) INTO v_is_owner;
  IF v_is_owner THEN
    RAISE EXCEPTION 'Owner können Listen nicht verlassen. Bitte die Liste löschen.' USING ERRCODE = '42501';
  END IF;

  -- Prüfe tatsächliche Mitgliedschaft (ohne Owner-Sonderfall)
  SELECT EXISTS (
    SELECT 1
    FROM list_members lm
    WHERE lm.list_id = p_list_id
      AND lm.user_id = v_user_id
  ) INTO v_membership_exists;

  IF NOT v_membership_exists THEN
    RAISE EXCEPTION 'Mitgliedschaft nicht gefunden oder bereits entfernt.' USING ERRCODE = 'P0002';
  END IF;

  -- Sperre Mitgliedschaft, um parallele Vorgänge zu vermeiden
  PERFORM 1
  FROM list_members lm
  WHERE lm.list_id = p_list_id
    AND lm.user_id = v_user_id
  FOR UPDATE;

  -- Entferne Mitgliedschaft
  DELETE FROM list_members lm
  WHERE lm.list_id = p_list_id
    AND lm.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitgliedschaft konnte nicht entfernt werden.' USING ERRCODE = 'P0002';
  END IF;

  -- Offene oder angenommene Einladungen entfernen (ermöglicht späteres Neu-Einladen)
  DELETE FROM list_invitations li
  WHERE li.list_id = p_list_id
    AND li.invitee_id = v_user_id;
  GET DIAGNOSTICS v_removed_invitations = ROW_COUNT;

  -- Persönliche Bewertungen entfernen und betroffene Spots merken
  FOR rec IN
    DELETE FROM foodspot_ratings fr
    WHERE fr.list_id = p_list_id
      AND fr.user_id = v_user_id
    RETURNING fr.foodspot_id
  LOOP
    v_removed_ratings := v_removed_ratings + 1;
    IF rec.foodspot_id IS NOT NULL THEN
      v_affected_spots := array_append(v_affected_spots, rec.foodspot_id);
    END IF;
  END LOOP;

  -- Eigene Fotos entfernen und betroffene Spots merken
  FOR rec IN
    DELETE FROM spot_photos sp
    WHERE sp.list_id = p_list_id
      AND sp.uploader_user_id = v_user_id
    RETURNING sp.spot_id
  LOOP
    v_removed_photos := v_removed_photos + 1;
    IF rec.spot_id IS NOT NULL THEN
      v_affected_spots := array_append(v_affected_spots, rec.spot_id);
    END IF;
  END LOOP;

  -- Spots markieren, die vom User erstellt wurden
  SELECT
    COALESCE(array_cat(
      v_affected_spots,
      ARRAY(
        SELECT fs.id
        FROM foodspots fs
        WHERE fs.list_id = p_list_id
          AND (fs.user_id = v_user_id OR fs.first_uploader_id = v_user_id)
      )
    ), ARRAY[]::UUID[])
  INTO v_affected_spots;

  -- Duplikate entfernen
  SELECT
    COALESCE(array_agg(DISTINCT spot_id), ARRAY[]::UUID[])
  INTO v_affected_spots
  FROM (
    SELECT unnest(v_affected_spots) AS spot_id
  ) dedup
  WHERE spot_id IS NOT NULL;

  -- Spots löschen, falls keine fremden Beiträge mehr existieren
  IF array_length(v_affected_spots, 1) > 0 THEN
    FOR rec IN
      DELETE FROM foodspots f
      WHERE f.list_id = p_list_id
        AND f.id = ANY(v_affected_spots)
        AND NOT EXISTS (
          SELECT 1
          FROM foodspot_ratings r
          WHERE r.foodspot_id = f.id
            AND r.user_id <> v_user_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM spot_photos p
          WHERE p.spot_id = f.id
            AND p.uploader_user_id <> v_user_id
        )
      RETURNING id
    LOOP
      v_removed_spots := v_removed_spots + 1;
      v_deleted_spots := array_append(v_deleted_spots, rec.id);
    END LOOP;
  END IF;

  -- Cover neu setzen für verbleibende betroffene Spots
  IF v_affected_spots IS NOT NULL THEN
    FOR v_spot IN
      SELECT spot_id
      FROM (
        SELECT unnest(v_affected_spots) AS spot_id
      ) spots
      WHERE NOT (spot_id = ANY(v_deleted_spots))
    LOOP
      SELECT sp.id, sp.public_url
      INTO v_cover
      FROM spot_photos sp
      WHERE sp.spot_id = v_spot
      ORDER BY sp.created_at ASC, sp.id ASC
      LIMIT 1;

      IF v_cover.id IS NOT NULL THEN
        UPDATE foodspots
        SET
          cover_image_id = v_cover.id,
          cover_photo_url = v_cover.public_url,
          updated_at = timezone('utc', now())
        WHERE id = v_spot
          AND (cover_image_id IS DISTINCT FROM v_cover.id OR cover_photo_url IS DISTINCT FROM v_cover.public_url);
      ELSE
        UPDATE foodspots
        SET
          cover_image_id = NULL,
          cover_photo_url = NULL,
          updated_at = timezone('utc', now())
        WHERE id = v_spot
          AND (cover_image_id IS NOT NULL OR cover_photo_url IS NOT NULL);
      END IF;
    END LOOP;
  END IF;

  -- Liste als aktualisiert markieren
  UPDATE lists
  SET updated_at = timezone('utc', now())
  WHERE id = p_list_id;

  list_id := p_list_id;
  ratings_removed := v_removed_ratings;
  photos_removed := v_removed_photos;
  spots_removed := v_removed_spots;
  invitations_removed := v_removed_invitations;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION leave_shared_list(UUID) IS 'Mitglied verlässt eine geteilte Liste: entfernt Mitgliedschaft, persönliche Beiträge und bereinigt verwaiste Spots.';

GRANT EXECUTE ON FUNCTION leave_shared_list(UUID) TO authenticated;

-- =============================================
-- SUCCESS: Shared List Leave Logic added
-- =============================================

