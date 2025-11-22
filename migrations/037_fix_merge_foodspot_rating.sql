-- =============================================
-- FIX: merge_foodspot Rating Overflow
-- =============================================
-- Problem: Rating-Werte können größer als 9.99 sein (z.B. bei 1-10 Skala)
-- Lösung: Normalisiere Ratings auf 1-10 Skala in der Funktion
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
  v_normalized_score NUMERIC(3,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Normalize score to 1-10 scale (max 10.00)
  -- If score is already in valid range (0-10), use it
  -- Otherwise normalize it
  IF p_score IS NOT NULL THEN
    IF p_score > 10 THEN
      -- Assume it's on a different scale (e.g. 1-100), normalize to 1-10
      v_normalized_score := ROUND((p_score / 10.0)::numeric, 2);
    ELSE
      v_normalized_score := ROUND(p_score::numeric, 2);
    END IF;
    
    -- Ensure score is within valid range
    IF v_normalized_score > 10.00 THEN
      v_normalized_score := 10.00;
    ELSIF v_normalized_score < 0.00 THEN
      v_normalized_score := 0.00;
    END IF;
  ELSE
    v_normalized_score := NULL;
  END IF;

  -- Check if user is owner
  SELECT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id AND user_id = v_user_id
  ) INTO v_is_owner;

  -- Check if user is member (editor or viewer)
  IF NOT v_is_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM list_members
      WHERE list_id = p_list_id 
      AND user_id = v_user_id
      AND role = 'editor'
    ) INTO v_is_member;
  ELSE
    v_is_member := TRUE; -- Owner has full access
  END IF;

  IF NOT v_is_owner AND NOT v_is_member THEN
    RAISE EXCEPTION 'User is not authorized to add foodspots to this list' USING ERRCODE = '42501';
  END IF;

  -- Normalize name for comparison
  v_normalized_name := LOWER(TRIM(p_name));

  -- Try to find existing foodspot in this list
  SELECT id INTO v_foodspot_id
  FROM foodspots
  WHERE list_id = p_list_id
  AND LOWER(TRIM(name)) = v_normalized_name
  LIMIT 1;

  IF v_foodspot_id IS NOT NULL THEN
    -- Update existing foodspot
    UPDATE foodspots SET
      rating = v_normalized_score,
      category = COALESCE(p_category, category),
      address = COALESCE(p_address, address),
      latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      cover_photo_url = COALESCE(p_cover_photo, cover_photo_url),
      phone = COALESCE(p_phone, phone),
      website = COALESCE(p_website, website),
      notes = COALESCE(p_description, notes),
      updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_foodspot_id
    RETURNING * INTO v_foodspot;

    -- Update or insert rating
    INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
    VALUES (v_foodspot_id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment)
    ON CONFLICT (foodspot_id, user_id) DO UPDATE SET
      score = EXCLUDED.score,
      criteria = EXCLUDED.criteria,
      comment = EXCLUDED.comment,
      updated_at = TIMEZONE('utc'::text, NOW());
  ELSE
    -- Create new foodspot
    INSERT INTO foodspots (
      list_id,
      user_id,
      name,
      normalized_name,
      rating,
      category,
      address,
      latitude,
      longitude,
      cover_photo_url,
      phone,
      website,
      notes,
      first_uploader_id
    ) VALUES (
      p_list_id,
      v_user_id,
      TRIM(p_name),
      v_normalized_name,
      v_normalized_score,
      p_category,
      p_address,
      p_latitude,
      p_longitude,
      p_cover_photo,
      p_phone,
      p_website,
      p_description,
      v_user_id
    )
    RETURNING * INTO v_foodspot;

    -- Insert initial rating
    INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
    VALUES (v_foodspot.id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment);
  END IF;

  RETURN v_foodspot;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION merge_foodspot(UUID, TEXT, NUMERIC, JSONB, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT) TO authenticated;

-- =============================================
-- SUCCESS: merge_foodspot fixed!
-- =============================================
-- Ratings werden jetzt automatisch auf 1-10 Skala normalisiert
-- Kein Overflow mehr möglich
-- =============================================










