-- =============================================
-- MIGRATION 052: BERECHTIGUNGEN SERVERSEITIG DURCHSETZEN
-- =============================================
-- Setzt die List-Toggles serverseitig durch, unabhängig vom UI-Zustand.
--
-- Rechtemodell (rein rechtebasiert, Urheberschaft nur beim LÖSCHEN relevant):
--   - Owner der Liste: darf immer alles (hinzufügen, bearbeiten, Liste ändern, löschen).
--   - Mitglied (role='editor'):
--       * Spots hinzufügen   nur wenn members_can_add_spots  = true
--       * Spots bearbeiten   nur wenn members_can_edit_spots = true (via update_shared_foodspot)
--       * Liste bearbeiten   nur wenn members_can_edit_list  = true
--       * Bewerten           IMMER (kein Toggle, hier nicht berührt)
--       * Löschen            nur EIGENE Spots (Urheberschaft), NIE die Liste
--
-- Reihenfolge beim Ausführen in Supabase:
--   1) update_shared_foodspot.sql   (Punkt 3 – Spots bearbeiten inkl. Standort)
--   2) DIESE Datei                  (Punkt 1 + 2)
-- =============================================


-- ---------------------------------------------
-- PUNKT 1: "Spots hinzufügen" serverseitig durchsetzen
-- ---------------------------------------------

-- 1a) merge_foodspot: Add-Recht prüfen.
--     Owner immer; Editor nur bei members_can_add_spots = true.
--     Private Listen bleiben unberührt (dort ist der User immer Owner → v_can_add = TRUE).
CREATE OR REPLACE FUNCTION "public"."merge_foodspot"(
  "p_list_id" "uuid",
  "p_name" "text",
  "p_score" numeric,
  "p_criteria" "jsonb" DEFAULT '{}'::"jsonb",
  "p_comment" "text" DEFAULT NULL::"text",
  "p_description" "text" DEFAULT NULL::"text",
  "p_category" "text" DEFAULT NULL::"text",
  "p_address" "text" DEFAULT NULL::"text",
  "p_latitude" double precision DEFAULT NULL::double precision,
  "p_longitude" double precision DEFAULT NULL::double precision,
  "p_cover_photo" "text" DEFAULT NULL::"text",
  "p_phone" "text" DEFAULT NULL::"text",
  "p_website" "text" DEFAULT NULL::"text"
) RETURNS "public"."foodspots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_foodspot foodspots;
  v_foodspot_id UUID;
  v_normalized_name TEXT;
  v_is_owner BOOLEAN;
  v_is_editor BOOLEAN := FALSE;
  v_members_can_add BOOLEAN := FALSE;
  v_can_add BOOLEAN;
  v_normalized_score NUMERIC(4,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Normalize score to 1-10 scale (max 10.00)
  IF p_score IS NOT NULL THEN
    IF p_score > 10 THEN
      v_normalized_score := ROUND((p_score / 10.0)::numeric, 2);
    ELSE
      v_normalized_score := ROUND(p_score::numeric, 2);
    END IF;

    IF v_normalized_score > 10.00 THEN
      v_normalized_score := 10.00;
    ELSIF v_normalized_score < 0.00 THEN
      v_normalized_score := 0.00;
    END IF;
  ELSE
    v_normalized_score := NULL;
  END IF;

  -- ---- Berechtigung: Hinzufügen ----
  -- Owner der Liste + Add-Toggle in einem Zug holen
  SELECT (l.user_id = v_user_id), COALESCE(l.members_can_add_spots, FALSE)
    INTO v_is_owner, v_members_can_add
  FROM lists l
  WHERE l.id = p_list_id;

  IF v_is_owner IS NULL THEN
    RAISE EXCEPTION 'List not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM list_members
      WHERE list_id = p_list_id
        AND user_id = v_user_id
        AND role = 'editor'
    ) INTO v_is_editor;
  END IF;

  -- Owner immer; Editor nur wenn Owner "Spots hinzufügen" aktiviert hat.
  v_can_add := v_is_owner OR (v_is_editor AND v_members_can_add);

  IF NOT v_can_add THEN
    RAISE EXCEPTION 'User is not authorized to add foodspots to this list' USING ERRCODE = '42501';
  END IF;

  v_normalized_name := LOWER(TRIM(p_name));

  SELECT id INTO v_foodspot_id
  FROM foodspots
  WHERE list_id = p_list_id
    AND LOWER(TRIM(name)) = v_normalized_name
  LIMIT 1;

  IF v_foodspot_id IS NOT NULL THEN
    -- Update existing foodspot
    UPDATE foodspots SET
      rating = COALESCE(v_normalized_score, rating),  -- Keep existing rating if new one is NULL
      category = COALESCE(p_category, category),
      address = COALESCE(p_address, address),
      latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      cover_photo_url = COALESCE(p_cover_photo, cover_photo_url),
      phone = COALESCE(p_phone, phone),
      website = COALESCE(p_website, website),
      description = COALESCE(p_description, description),
      updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_foodspot_id
    RETURNING * INTO v_foodspot;

    IF v_normalized_score IS NOT NULL THEN
      INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
      VALUES (v_foodspot_id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment)
      ON CONFLICT (foodspot_id, user_id) DO UPDATE SET
        score = EXCLUDED.score,
        criteria = EXCLUDED.criteria,
        comment = EXCLUDED.comment,
        updated_at = TIMEZONE('utc'::text, NOW());
    END IF;
  ELSE
    -- Insert new foodspot
    INSERT INTO foodspots (
      list_id, user_id, first_uploader_id, name, normalized_name, rating,
      category, description, address, latitude, longitude, phone, website,
      cover_photo_url, ratings, avg_score, ratings_count
    ) VALUES (
      p_list_id, v_user_id, v_user_id, TRIM(p_name), v_normalized_name, v_normalized_score,
      p_category, NULLIF(TRIM(p_description), ''), NULLIF(TRIM(p_address), ''),
      p_latitude, p_longitude, NULLIF(TRIM(p_phone), ''), NULLIF(TRIM(p_website), ''),
      p_cover_photo, '{}'::jsonb, NULL, 0
    )
    RETURNING * INTO v_foodspot;

    IF v_normalized_score IS NOT NULL THEN
      INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
      VALUES (v_foodspot.id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment);
    END IF;
  END IF;

  RETURN v_foodspot;
END;
$$;

ALTER FUNCTION "public"."merge_foodspot"(
  "uuid","text",numeric,"jsonb","text","text","text","text",
  double precision,double precision,"text","text","text"
) OWNER TO "postgres";


-- 1b) RLS: Direktes INSERT auf foodspots (Defense-in-Depth, falls nicht über merge_foodspot).
--     Editor darf nur mit members_can_add_spots = true.
DROP POLICY IF EXISTS "List editors can create foodspots in shared lists" ON "public"."foodspots";
CREATE POLICY "List editors can create foodspots in shared lists"
ON "public"."foodspots" FOR INSERT TO "authenticated"
WITH CHECK (
  ("auth"."uid"() = "user_id")
  AND (
    "public"."is_list_owner"("list_id", "auth"."uid"())
    OR (
      "public"."is_list_editor"("list_id", "auth"."uid"())
      AND EXISTS (
        SELECT 1 FROM "public"."lists"
        WHERE "lists"."id" = "foodspots"."list_id"
          AND "lists"."members_can_add_spots" = true
      )
    )
  )
);


-- ---------------------------------------------
-- PUNKT 2: "Liste bearbeiten" serverseitig durchsetzen
-- ---------------------------------------------
-- Editor (Nicht-Owner) darf die Liste nur updaten, wenn members_can_edit_list = true.
-- Owner-Updates laufen weiterhin über "Users can update own lists" (unverändert).
DROP POLICY IF EXISTS "List editors can update shared lists" ON "public"."lists";
CREATE POLICY "List editors can update shared lists"
ON "public"."lists" FOR UPDATE TO "authenticated"
USING (
  "public"."is_list_editor"("id", "auth"."uid"())
  AND (NOT "public"."is_list_owner"("id", "auth"."uid"()))
  AND "members_can_edit_list" = true
)
WITH CHECK (
  "public"."is_list_editor"("id", "auth"."uid"())
  AND (NOT "public"."is_list_owner"("id", "auth"."uid"()))
  AND "members_can_edit_list" = true
);


-- ---------------------------------------------
-- HÄRTUNG (empfohlen): Mitglieder dürfen die Toggle-Spalten NICHT selbst ändern
-- ---------------------------------------------
-- Ohne diesen Schutz könnte ein Mitglied mit members_can_edit_list = true über die
-- obige UPDATE-Policy theoretisch die Rechte-Spalten (members_can_*) selbst hochsetzen
-- (Privilege Escalation). Nur der Owner soll die Toggles setzen dürfen.
CREATE OR REPLACE FUNCTION "public"."guard_list_permission_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Owner darf alles ändern.
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Nicht-Owner: Rechte-Spalten und Eigentümer dürfen sich nicht ändern.
  IF NEW.members_can_add_spots  IS DISTINCT FROM OLD.members_can_add_spots
     OR NEW.members_can_edit_spots IS DISTINCT FROM OLD.members_can_edit_spots
     OR NEW.members_can_edit_list  IS DISTINCT FROM OLD.members_can_edit_list
     OR NEW.members_can_invite     IS DISTINCT FROM OLD.members_can_invite
     OR NEW.user_id                IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Only the list owner may change permission settings'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."guard_list_permission_columns"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_guard_list_permission_columns" ON "public"."lists";
CREATE TRIGGER "trg_guard_list_permission_columns"
  BEFORE UPDATE ON "public"."lists"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."guard_list_permission_columns"();

-- =============================================
-- HINWEIS ZU PUNKT 5 (Löschen) – bereits korrekt, hier nur dokumentiert:
--   RLS "List editors can delete foodspots in shared lists":
--     is_list_owner(list_id) OR (auth.uid() = user_id AND is_list_editor(list_id))
--     → Owner löscht alle, Editor nur eigene. An KEINEN Toggle gebunden. Korrekt.
--   Liste löschen ("Users can delete own lists"): nur Owner. Korrekt.
--   → Keine Änderung nötig.
-- =============================================
