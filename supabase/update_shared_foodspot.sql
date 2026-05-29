-- Migration: update_shared_foodspot
-- Ersetzt die fehlerhafte Name-Matching-Logik von merge_foodspot im Edit-Mode.
-- merge_foodspot bleibt unverändert und wird weiterhin für neue Spots verwendet.

CREATE OR REPLACE FUNCTION "public"."update_shared_foodspot"(
  "p_foodspot_id"  uuid,
  "p_list_id"      uuid,
  "p_name"         text    DEFAULT NULL::text,
  "p_score"        numeric DEFAULT NULL::numeric,
  "p_criteria"     jsonb   DEFAULT '{}'::jsonb,
  "p_comment"      text    DEFAULT NULL::text,
  "p_description"  text    DEFAULT NULL::text,
  "p_category"     text    DEFAULT NULL::text,
  "p_address"      text    DEFAULT NULL::text,
  "p_latitude"     double precision DEFAULT NULL::double precision,
  "p_longitude"    double precision DEFAULT NULL::double precision,
  "p_cover_photo"  text    DEFAULT NULL::text,
  "p_phone"        text    DEFAULT NULL::text,
  "p_website"      text    DEFAULT NULL::text
) RETURNS "public"."foodspots"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_user_id         UUID := auth.uid();
  v_foodspot        foodspots;
  v_is_list_owner   BOOLEAN;
  v_is_member       BOOLEAN;
  v_is_spot_owner   BOOLEAN;
  v_normalized_score NUMERIC(4,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Sicherstellen dass der Spot zu dieser Liste gehört
  IF NOT EXISTS (
    SELECT 1 FROM foodspots WHERE id = p_foodspot_id AND list_id = p_list_id
  ) THEN
    RAISE EXCEPTION 'Spot not found in this list' USING ERRCODE = 'P0002';
  END IF;

  -- Listen-Owner prüfen
  SELECT EXISTS (
    SELECT 1 FROM lists WHERE id = p_list_id AND user_id = v_user_id
  ) INTO v_is_list_owner;

  IF NOT v_is_list_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM list_members
      WHERE list_id = p_list_id AND user_id = v_user_id AND role = 'editor'
    ) INTO v_is_member;
  ELSE
    v_is_member := TRUE;
  END IF;

  IF NOT v_is_list_owner AND NOT v_is_member THEN
    RAISE EXCEPTION 'Not authorized to edit this list' USING ERRCODE = '42501';
  END IF;

  -- Spot-Owner prüfen (darf Name, Beschreibung, Adresse etc. ändern)
  SELECT EXISTS (
    SELECT 1 FROM foodspots WHERE id = p_foodspot_id AND user_id = v_user_id
  ) INTO v_is_spot_owner;

  -- Score normalisieren
  IF p_score IS NOT NULL THEN
    IF p_score > 10 THEN
      v_normalized_score := ROUND((p_score / 10.0)::numeric, 2);
    ELSE
      v_normalized_score := ROUND(p_score::numeric, 2);
    END IF;
    v_normalized_score := GREATEST(0.00, LEAST(10.00, v_normalized_score));
  END IF;

  -- UPDATE per ID — niemals INSERT
  -- Spot-Felder (Name, Beschreibung, Adresse, ...) nur wenn Spot-Owner
  -- Bewertung immer (jeder Teilnehmer kann seine Bewertung ändern)
  UPDATE foodspots SET
    name            = CASE WHEN v_is_spot_owner AND p_name IS NOT NULL
                        THEN TRIM(p_name) ELSE name END,
    normalized_name = CASE WHEN v_is_spot_owner AND p_name IS NOT NULL
                        THEN LOWER(TRIM(p_name)) ELSE normalized_name END,
    description     = CASE WHEN v_is_spot_owner
                        THEN COALESCE(NULLIF(TRIM(p_description), ''), description)
                        ELSE description END,
    category        = CASE WHEN v_is_spot_owner
                        THEN COALESCE(p_category, category)
                        ELSE category END,
    address         = CASE WHEN v_is_spot_owner
                        THEN COALESCE(NULLIF(TRIM(p_address), ''), address)
                        ELSE address END,
    latitude        = CASE WHEN v_is_spot_owner
                        THEN COALESCE(p_latitude, latitude) ELSE latitude END,
    longitude       = CASE WHEN v_is_spot_owner
                        THEN COALESCE(p_longitude, longitude) ELSE longitude END,
    cover_photo_url = CASE WHEN v_is_spot_owner
                        THEN COALESCE(p_cover_photo, cover_photo_url)
                        ELSE cover_photo_url END,
    phone           = CASE WHEN v_is_spot_owner
                        THEN COALESCE(NULLIF(TRIM(p_phone), ''), phone)
                        ELSE phone END,
    website         = CASE WHEN v_is_spot_owner
                        THEN COALESCE(NULLIF(TRIM(p_website), ''), website)
                        ELSE website END,
    updated_at      = TIMEZONE('utc'::text, NOW())
  WHERE id = p_foodspot_id
  RETURNING * INTO v_foodspot;

  -- Bewertung upserten — für jeden Listenteilnehmer erlaubt
  IF v_normalized_score IS NOT NULL THEN
    INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
    VALUES (p_foodspot_id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment)
    ON CONFLICT (foodspot_id, user_id) DO UPDATE SET
      score      = EXCLUDED.score,
      criteria   = EXCLUDED.criteria,
      comment    = EXCLUDED.comment,
      updated_at = TIMEZONE('utc'::text, NOW());
  END IF;

  RETURN v_foodspot;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."update_shared_foodspot"(
  uuid, uuid, text, numeric, jsonb, text, text, text, text,
  double precision, double precision, text, text, text
) TO "authenticated";
