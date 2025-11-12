-- =============================================
-- MIGRATION 043: Fix merge_foodspot NULL score handling
-- =============================================
-- Problem: Wenn nur die Beschreibung bearbeitet wird (p_score = NULL),
--          versucht die Funktion trotzdem ein Rating einzufügen,
--          was gegen die NOT NULL Constraint verstößt.
-- Lösung: INSERT in foodspot_ratings nur wenn p_score nicht NULL ist
-- =============================================

CREATE OR REPLACE FUNCTION merge_foodspot(
  p_list_id UUID,
  p_name TEXT,
  p_score NUMERIC(4,2),
  p_criteria JSONB DEFAULT '{}'::jsonb,
  p_comment TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_cover_photo TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL
)
RETURNS foodspots
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_foodspot foodspots;
  v_foodspot_id UUID;
  v_normalized_name TEXT;
  v_is_member BOOLEAN;
  v_is_owner BOOLEAN;
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

  SELECT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id AND user_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM list_members
      WHERE list_id = p_list_id
        AND user_id = v_user_id
        AND role = 'editor'
    ) INTO v_is_member;
  ELSE
    v_is_member := TRUE;
  END IF;

  IF NOT v_is_owner AND NOT v_is_member THEN
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

    -- Only insert/update rating if score is provided
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
      list_id,
      user_id,
      first_uploader_id,
      name,
      normalized_name,
      rating,
      category,
      description,
      address,
      latitude,
      longitude,
      phone,
      website,
      cover_photo_url,
      ratings,
      avg_score,
      ratings_count
    ) VALUES (
      p_list_id,
      v_user_id,
      v_user_id,
      TRIM(p_name),
      v_normalized_name,
      v_normalized_score,
      p_category,
      NULLIF(TRIM(p_description), ''),
      NULLIF(TRIM(p_address), ''),
      p_latitude,
      p_longitude,
      NULLIF(TRIM(p_phone), ''),
      NULLIF(TRIM(p_website), ''),
      p_cover_photo,
      '{}'::jsonb,
      NULL,
      0
    )
    RETURNING * INTO v_foodspot;

    -- Only insert rating if score is provided
    IF v_normalized_score IS NOT NULL THEN
      INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
      VALUES (v_foodspot.id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment);
    END IF;
  END IF;

  RETURN v_foodspot;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_foodspot(UUID, TEXT, NUMERIC, JSONB, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT) TO authenticated;

-- =============================================
-- SUCCESS: merge_foodspot NULL score handling fixed
-- =============================================

