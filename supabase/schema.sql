


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."spot_photos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "uploader_user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "size_bytes" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."spot_photos" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_spot_photo"("p_list_id" "uuid", "p_spot_id" "uuid", "p_storage_path" "text", "p_public_url" "text", "p_width" integer DEFAULT NULL::integer, "p_height" integer DEFAULT NULL::integer, "p_size_bytes" integer DEFAULT NULL::integer, "p_mime_type" "text" DEFAULT NULL::"text", "p_set_as_cover" boolean DEFAULT false) RETURNS "public"."spot_photos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
  v_role_ok BOOLEAN;
  v_photo spot_photos;
  v_current_count INTEGER;
  v_cover_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_list_id IS NULL OR p_spot_id IS NULL THEN
    RAISE EXCEPTION 'list_id und spot_id sind erforderlich' USING ERRCODE = '23502';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM foodspots WHERE id = p_spot_id AND list_id = p_list_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Spot gehört nicht zu dieser Liste' USING ERRCODE = 'P0002';
  END IF;

  SELECT (is_list_owner(p_list_id, v_user_id) OR is_list_editor(p_list_id, v_user_id))
  INTO v_role_ok;

  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM spot_photos
  WHERE spot_id = p_spot_id;

  IF v_current_count >= 8 THEN
    RAISE EXCEPTION 'Maximal 8 Fotos pro Spot erlaubt' USING ERRCODE = '22023';
  END IF;

  INSERT INTO spot_photos (
    list_id,
    spot_id,
    uploader_user_id,
    storage_path,
    public_url,
    width,
    height,
    size_bytes,
    mime_type
  )
  VALUES (
    p_list_id,
    p_spot_id,
    v_user_id,
    p_storage_path,
    p_public_url,
    p_width,
    p_height,
    p_size_bytes,
    p_mime_type
  )
  RETURNING * INTO v_photo;

  SELECT cover_image_id INTO v_cover_id FROM foodspots WHERE id = p_spot_id;

  IF v_cover_id IS NULL OR p_set_as_cover THEN
    UPDATE foodspots
    SET
      cover_image_id = v_photo.id,
      cover_photo_url = v_photo.public_url,
      updated_at = timezone('utc', now())
    WHERE id = p_spot_id;
  END IF;

  RETURN v_photo;
END;
$$;


ALTER FUNCTION "public"."add_spot_photo"("p_list_id" "uuid", "p_spot_id" "uuid", "p_storage_path" "text", "p_public_url" "text", "p_width" integer, "p_height" integer, "p_size_bytes" integer, "p_mime_type" "text", "p_set_as_cover" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_shared_list"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying DEFAULT 'participants'::character varying) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_shared_list_id UUID;
BEGIN
  -- Verify that the user owns the list
  IF NOT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id AND user_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'User does not own this list';
  END IF;

  -- Verify that the owner_id matches the authenticated user
  IF p_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Owner ID must match authenticated user';
  END IF;

  -- Insert the shared_list (bypasses RLS)
  INSERT INTO shared_lists (list_id, owner_id, visibility)
  VALUES (p_list_id, p_owner_id, p_visibility)
  RETURNING id INTO v_shared_list_id;

  RETURN v_shared_list_id;
END;
$$;


ALTER FUNCTION "public"."create_shared_list"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_shared_list_with_collaborators"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying DEFAULT 'participants'::character varying, "p_collaborators" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_shared_list_id UUID;
  v_collaborator JSONB;
BEGIN
  -- Verify that the user owns the list
  IF NOT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id AND user_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'User does not own this list';
  END IF;

  -- Verify that the owner_id matches the authenticated user
  IF p_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Owner ID must match authenticated user';
  END IF;

  -- Validate visibility value
  IF p_visibility NOT IN ('private', 'friends', 'link', 'public', 'participants') THEN
    RAISE EXCEPTION 'Invalid visibility value: %', p_visibility;
  END IF;

  -- Check if shared_list already exists
  SELECT id INTO v_shared_list_id
  FROM shared_lists
  WHERE list_id = p_list_id;

  -- Create or update shared_list entry
  IF v_shared_list_id IS NULL THEN
    INSERT INTO shared_lists (list_id, owner_id, visibility)
    VALUES (p_list_id, p_owner_id, p_visibility)
    RETURNING id INTO v_shared_list_id;
  ELSE
    UPDATE shared_lists
    SET visibility = p_visibility,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_shared_list_id;
  END IF;

  -- Add owner as collaborator with 'editor' role (if not exists)
  -- Note: We use 'editor' role for owner, not a separate 'owner' role
  -- The owner is identified by lists.user_id, not by role in list_collaborators
  INSERT INTO list_collaborators (list_id, user_id, role, added_by)
  VALUES (p_list_id, p_owner_id, 'editor', p_owner_id)
  ON CONFLICT (list_id, user_id) DO UPDATE
  SET role = 'editor',
      added_by = p_owner_id;

  -- Add collaborators from JSONB array
  FOR v_collaborator IN SELECT * FROM jsonb_array_elements(p_collaborators)
  LOOP
    INSERT INTO list_collaborators (list_id, user_id, role, added_by)
    VALUES (
      p_list_id,
      (v_collaborator->>'user_id')::UUID,
      COALESCE(v_collaborator->>'role', 'viewer'),
      p_owner_id
    )
    ON CONFLICT (list_id, user_id) DO UPDATE
    SET role = COALESCE(EXCLUDED.role, list_collaborators.role),
        added_by = p_owner_id;
  END LOOP;

  RETURN v_shared_list_id;
END;
$$;


ALTER FUNCTION "public"."create_shared_list_with_collaborators"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying, "p_collaborators" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_shared_list_with_collaborators"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying, "p_collaborators" "jsonb") IS 'Creates a shared list entry and collaborators in a transaction. Non-recursive.';



CREATE OR REPLACE FUNCTION "public"."delete_foodspot_rating"("p_foodspot_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_list_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT list_id
  INTO v_list_id
  FROM foodspots
  WHERE id = p_foodspot_id;

  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Foodspot nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF NOT is_list_member(v_list_id, v_user_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  DELETE FROM foodspot_ratings
  WHERE foodspot_id = p_foodspot_id
    AND user_id = v_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_foodspot_rating"("p_foodspot_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shared_list"("p_list_id" "uuid") RETURNS TABLE("list_id" "uuid", "spots_removed" integer, "photos_removed" integer, "ratings_removed" integer, "members_removed" integer, "invitations_removed" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_spots INTEGER := 0;
  v_photos INTEGER := 0;
  v_ratings INTEGER := 0;
  v_members INTEGER := 0;
  v_invitations INTEGER := 0;
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

  IF NOT is_list_owner(p_list_id, v_user_id) THEN
    RAISE EXCEPTION 'Nur der Owner darf diese Liste löschen.' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_members
  FROM list_members
  WHERE list_id = p_list_id;

  SELECT COUNT(*) INTO v_invitations
  FROM list_invitations
  WHERE list_id = p_list_id;

  SELECT COUNT(*) INTO v_spots
  FROM foodspots
  WHERE list_id = p_list_id;

  SELECT COUNT(*) INTO v_ratings
  FROM foodspot_ratings
  WHERE list_id = p_list_id;

  SELECT COUNT(*) INTO v_photos
  FROM spot_photos
  WHERE list_id = p_list_id;

  DELETE FROM lists
  WHERE id = p_list_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liste konnte nicht gelöscht werden.' USING ERRCODE = 'P0002';
  END IF;

  list_id := p_list_id;
  spots_removed := v_spots;
  photos_removed := v_photos;
  ratings_removed := v_ratings;
  members_removed := v_members;
  invitations_removed := v_invitations;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."delete_shared_list"("p_list_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_shared_list"("p_list_id" "uuid") IS 'Owner löscht eine (geteilte) Liste inklusive aller abhängigen Datensätze per CASCADE.';



CREATE OR REPLACE FUNCTION "public"."delete_spot_photo"("p_photo_id" "uuid") RETURNS TABLE("deleted_id" "uuid", "list_id" "uuid", "spot_id" "uuid", "storage_path" "text", "new_cover_id" "uuid", "new_cover_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_photo spot_photos;
  v_owner BOOLEAN;
  v_next_cover spot_photos;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_photo
  FROM spot_photos
  WHERE id = p_photo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foto nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_owner := is_list_owner(v_photo.list_id, v_user_id);

  IF NOT v_owner AND v_photo.uploader_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  DELETE FROM spot_photos
  WHERE id = p_photo_id
  RETURNING *
  INTO v_photo;

  IF EXISTS (
    SELECT 1 FROM foodspots
    WHERE id = v_photo.spot_id AND cover_image_id = v_photo.id
  ) THEN
    SELECT *
    INTO v_next_cover
    FROM spot_photos
    WHERE spot_id = v_photo.spot_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_next_cover.id IS NOT NULL THEN
      UPDATE foodspots
      SET
        cover_image_id = v_next_cover.id,
        cover_photo_url = v_next_cover.public_url,
        updated_at = timezone('utc', now())
      WHERE id = v_photo.spot_id;
    ELSE
      UPDATE foodspots
      SET
        cover_image_id = NULL,
        cover_photo_url = NULL,
        updated_at = timezone('utc', now())
      WHERE id = v_photo.spot_id;
    END IF;
  END IF;

  deleted_id := v_photo.id;
  list_id := v_photo.list_id;
  spot_id := v_photo.spot_id;
  storage_path := v_photo.storage_path;
  new_cover_id := v_next_cover.id;
  new_cover_url := v_next_cover.public_url;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."delete_spot_photo"("p_photo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friendship_status"("user1_id" "uuid", "user2_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  friendship_status VARCHAR;
BEGIN
  SELECT status INTO friendship_status
  FROM friendships
  WHERE (requester_id = user1_id AND addressee_id = user2_id)
     OR (requester_id = user2_id AND addressee_id = user1_id)
  LIMIT 1;
  
  RETURN COALESCE(friendship_status, 'none');
END;
$$;


ALTER FUNCTION "public"."get_friendship_status"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_list_entry_counts"("p_list_ids" "uuid"[]) RETURNS TABLE("list_id" "uuid", "entry_count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    f.list_id,
    COUNT(*)::integer AS entry_count
  FROM public.foodspots f
  WHERE f.list_id = ANY(p_list_ids)
  GROUP BY f.list_id;
$$;


ALTER FUNCTION "public"."get_list_entry_counts"("p_list_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_list_members"("p_list_id" "uuid") RETURNS TABLE("user_id" "uuid", "role" "text", "joined_at" timestamp with time zone, "username" "text", "profile_image_url" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    member.user_id,
    member.role,
    member.joined_at,
    up.username,
    up.profile_image_url,
    up.email
  FROM (
    -- Owner wird immer inkludiert
    SELECT l.user_id, 'owner'::text AS role, l.created_at AS joined_at
    FROM public.lists l
    WHERE l.id = p_list_id
    UNION
    -- Alle akzeptierten Mitglieder der Liste
    SELECT lm.user_id, lm.role, lm.joined_at
    FROM public.list_members lm
    WHERE lm.list_id = p_list_id
  ) AS member
  LEFT JOIN public.user_profiles up ON up.id = member.user_id
  WHERE
    -- Zugriff erlaubt, wenn aufrufender User Owner ist ...
    EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = p_list_id
      AND l.user_id = auth.uid()
    )
    OR
    -- ... oder als Mitglied der Liste eingetragen ist
    EXISTS (
      SELECT 1 FROM public.list_members lm2
      WHERE lm2.list_id = p_list_id
      AND lm2.user_id = auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."get_shared_list_members"("p_list_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile"("user_id" "uuid") RETURNS TABLE("id" "uuid", "username" "text", "profile_image_url" "text", "profile_visibility" "text", "bio" "text", "email" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.username,
    up.profile_image_url,
    -- WICHTIG: Lese profile_visibility aus auth.users.user_metadata (nicht aus Tabelle!)
    COALESCE(au.raw_user_meta_data->>'profile_visibility', 'private')::TEXT as profile_visibility,
    NULL::TEXT as bio, -- bio existiert nicht mehr
    up.email,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE up.id = user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_profile"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_stats"("target_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
  v_total_spots INT := 0;
  v_total_lists INT := 0;
  v_total_cities INT := 0;
  v_avg_score NUMERIC := 0;
  v_most_visited_city JSON;
  v_top_category JSON;
  v_top_categories JSON;
  v_recent_spots JSON;
  v_top_spots JSON;
BEGIN
  -- Total spots (ONLY from private lists = lists with NO other members)
  SELECT COUNT(DISTINCT foodspots.id)
  INTO v_total_spots
  FROM foodspots
  INNER JOIN lists ON foodspots.list_id = lists.id
  WHERE lists.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Total lists (ONLY private lists)
  SELECT COUNT(*)
  INTO v_total_lists
  FROM lists
  WHERE lists.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Total cities (ONLY from private lists)
  SELECT COUNT(DISTINCT lists.city)
  INTO v_total_cities
  FROM lists
  WHERE lists.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Average score (ONLY from private lists)
  SELECT ROUND(AVG(foodspots.rating)::numeric, 2)
  INTO v_avg_score
  FROM foodspots
  INNER JOIN lists ON foodspots.list_id = lists.id
  WHERE lists.user_id = target_user_id
    AND foodspots.rating IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Most visited city (ONLY from private lists)
  SELECT json_build_object('city', sub.city, 'count', sub.count)
  INTO v_most_visited_city
  FROM (
    SELECT lists.city, COUNT(*) as count
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    GROUP BY lists.city
    ORDER BY count DESC
    LIMIT 1
  ) sub;

  -- Top category (ONLY from private lists)
  SELECT json_build_object(
    'category', sub.category,
    'count', sub.count,
    'percentage', ROUND((sub.count::numeric / NULLIF(v_total_spots, 0) * 100), 1)
  )
  INTO v_top_category
  FROM (
    SELECT foodspots.category, COUNT(*) as count
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND foodspots.category IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    GROUP BY foodspots.category
    ORDER BY count DESC
    LIMIT 1
  ) sub;

  -- Top categories (top 5, ONLY from private lists)
  SELECT json_agg(
    json_build_object(
      'category', sub.category,
      'count', sub.count,
      'percentage', ROUND((sub.count::numeric / NULLIF(v_total_spots, 0) * 100), 1)
    )
  )
  INTO v_top_categories
  FROM (
    SELECT foodspots.category, COUNT(*) as count
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND foodspots.category IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    GROUP BY foodspots.category
    ORDER BY count DESC
    LIMIT 5
  ) sub;

  -- Recent spots (last 5, ONLY from private lists)
  SELECT json_agg(
    json_build_object(
      'id', sub.id,
      'name', sub.name,
      'category', sub.category,
      'rating', sub.rating,
      'tier', sub.tier,
      'city', sub.city,
      'cover_photo_url', sub.cover_photo_url,
      'created_at', sub.created_at
    )
  )
  INTO v_recent_spots
  FROM (
    SELECT 
      foodspots.id,
      foodspots.name,
      foodspots.category,
      foodspots.rating,
      foodspots.tier,
      lists.city,
      foodspots.cover_photo_url,
      foodspots.created_at
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    ORDER BY foodspots.created_at DESC
    LIMIT 5
  ) sub;

  -- Top spots (by rating, top 10, ONLY from private lists)
  SELECT json_agg(
    json_build_object(
      'id', sub.id,
      'name', sub.name,
      'category', sub.category,
      'rating', sub.rating,
      'tier', sub.tier,
      'city', sub.city,
      'cover_photo_url', sub.cover_photo_url,
      'created_at', sub.created_at
    )
  )
  INTO v_top_spots
  FROM (
    SELECT 
      foodspots.id,
      foodspots.name,
      foodspots.category,
      foodspots.rating,
      foodspots.tier,
      lists.city,
      foodspots.cover_photo_url,
      foodspots.created_at
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND foodspots.rating IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    ORDER BY foodspots.rating DESC
    LIMIT 10
  ) sub;

  -- Build final result
  result := json_build_object(
    'total_spots', COALESCE(v_total_spots, 0),
    'total_lists', COALESCE(v_total_lists, 0),
    'total_cities', COALESCE(v_total_cities, 0),
    'avg_score', COALESCE(v_avg_score, 0),
    'most_visited_city', COALESCE(v_most_visited_city, json_build_object('city', null, 'count', 0)),
    'top_category', COALESCE(v_top_category, json_build_object('category', null, 'count', 0, 'percentage', 0)),
    'top_categories', COALESCE(v_top_categories, '[]'::json),
    'recent_spots', COALESCE(v_recent_spots, '[]'::json),
    'top_spots', COALESCE(v_top_spots, '[]'::json)
  );

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_user_stats"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_accepted_invitation"("p_list_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."has_accepted_invitation"("p_list_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_accepted_invitation"("p_list_id" "uuid", "p_user_id" "uuid") IS 'Prüft ob ein User eine angenommene Einladung für eine Liste hat (ohne RLS) - verhindert Rekursion';



CREATE OR REPLACE FUNCTION "public"."has_pending_invitation"("p_list_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM list_invitations
    WHERE list_id = p_list_id
    AND invitee_id = p_user_id
    AND status = 'pending'
  );
END;
$$;


ALTER FUNCTION "public"."has_pending_invitation"("p_list_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_pending_invitation"("p_list_id" "uuid", "p_user_id" "uuid") IS 'Prüft ob ein User eine pending Einladung zu einer Liste hat (ohne RLS)';



CREATE OR REPLACE FUNCTION "public"."is_list_editor"("p_list_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
    AND user_id = p_user_id
    AND role = 'editor'
  );
END;
$$;


ALTER FUNCTION "public"."is_list_editor"("p_list_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_list_member"("p_list_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM list_members
    WHERE list_id = p_list_id
    AND user_id = p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."is_list_member"("p_list_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_list_member"("p_list_id" "uuid", "p_user_id" "uuid") IS 'Prüft ob ein User Mitglied einer Liste ist (Owner oder eingeladenes Mitglied)';



CREATE OR REPLACE FUNCTION "public"."is_list_owner"("p_list_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND user_id = p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."is_list_owner"("p_list_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shared_list"("p_list_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."is_shared_list"("p_list_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_shared_list"("p_list_id" "uuid") IS 'Prüft ob eine Liste geteilt ist (hat Mitglieder oder offene Einladungen)';



CREATE OR REPLACE FUNCTION "public"."leave_shared_list"("p_list_id" "uuid") RETURNS TABLE("list_id" "uuid", "ratings_removed" integer, "photos_removed" integer, "spots_removed" integer, "invitations_removed" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."leave_shared_list"("p_list_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."leave_shared_list"("p_list_id" "uuid") IS 'Mitglied verlässt eine geteilte Liste: entfernt Mitgliedschaft, persönliche Beiträge und bereinigt verwaiste Spots.';



CREATE TABLE IF NOT EXISTS "public"."foodspots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "address" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "phone" character varying(50),
    "website" "text",
    "category" character varying(50),
    "tier" character varying(1),
    "rating" numeric(4,2),
    "notes" "text",
    "cover_photo_url" "text",
    "visited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ratings" "jsonb" DEFAULT '{}'::"jsonb",
    "first_uploader_id" "uuid",
    "ratings_count" integer DEFAULT 0 NOT NULL,
    "avg_score" numeric(4,2),
    "normalized_name" "text" NOT NULL,
    "description" "text",
    "cover_image_id" "uuid",
    CONSTRAINT "foodspots_tier_check" CHECK ((("tier")::"text" = ANY ((ARRAY['S'::character varying, 'A'::character varying, 'B'::character varying, 'C'::character varying, 'D'::character varying, 'E'::character varying])::"text"[])))
);


ALTER TABLE "public"."foodspots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."foodspots"."rating" IS 'Gesamt-Rating (0.00 - 10.00)';



COMMENT ON COLUMN "public"."foodspots"."ratings" IS 'JSON object storing individual criterion ratings (e.g., {"Brot": 5, "Fleisch": 4, "Soße": 5})';



CREATE OR REPLACE FUNCTION "public"."merge_foodspot"("p_list_id" "uuid", "p_name" "text", "p_score" numeric, "p_criteria" "jsonb" DEFAULT '{}'::"jsonb", "p_comment" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_latitude" double precision DEFAULT NULL::double precision, "p_longitude" double precision DEFAULT NULL::double precision, "p_cover_photo" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_website" "text" DEFAULT NULL::"text") RETURNS "public"."foodspots"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."merge_foodspot"("p_list_id" "uuid", "p_name" "text", "p_score" numeric, "p_criteria" "jsonb", "p_comment" "text", "p_description" "text", "p_category" "text", "p_address" "text", "p_latitude" double precision, "p_longitude" double precision, "p_cover_photo" "text", "p_phone" "text", "p_website" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_foodspot_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := TRIM(NEW.name);
    NEW.normalized_name := LOWER(NEW.name);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.first_uploader_id IS NULL THEN
      NEW.first_uploader_id := NEW.user_id;
    END IF;
    IF NEW.ratings_count IS NULL THEN
      NEW.ratings_count := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_foodspot_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_foodspot_aggregates"("p_foodspot_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_avg NUMERIC(4,2);
  v_count INTEGER;
BEGIN
  SELECT
    ROUND(AVG(score)::numeric, 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM foodspot_ratings
  WHERE foodspot_id = p_foodspot_id;

  UPDATE foodspots
  SET
    rating = CASE WHEN v_count > 0 THEN v_avg ELSE NULL END,
    avg_score = CASE WHEN v_count > 0 THEN v_avg ELSE NULL END,
    ratings_count = v_count,
    tier = CASE
      WHEN v_count = 0 THEN NULL
      WHEN v_avg >= 9.0 THEN 'S'
      WHEN v_avg >= 8.0 THEN 'A'
      WHEN v_avg >= 6.5 THEN 'B'
      WHEN v_avg >= 5.0 THEN 'C'
      WHEN v_avg >= 3.0 THEN 'D'
      ELSE 'E'
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_foodspot_id;
END;
$$;


ALTER FUNCTION "public"."refresh_foodspot_aggregates"("p_foodspot_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_invitation"("p_invitation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."reject_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reject_invitation"("p_invitation_id" "uuid") IS 'Verarbeitet Ablehnung einer Einladung: Aktualisiert Status';



CREATE OR REPLACE FUNCTION "public"."search_users_by_username"("search_query" "text") RETURNS TABLE("id" "uuid", "username" "text", "profile_image_url" "text", "profile_visibility" "text", "bio" "text", "email" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.username,
    up.profile_image_url,
    -- WICHTIG: Lese profile_visibility aus auth.users.user_metadata (nicht aus Tabelle!)
    COALESCE(au.raw_user_meta_data->>'profile_visibility', 'private')::TEXT as profile_visibility,
    NULL::TEXT as bio, -- bio existiert nicht mehr
    up.email,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE (
    search_query IS NULL
    OR search_query = ''
    OR up.username ILIKE search_query || '%'
    OR up.username ILIKE '%' || search_query || '%'
    OR up.email ILIKE search_query || '%'
    OR up.email ILIKE '%' || search_query || '%'
  )
  ORDER BY up.username ASC, up.created_at DESC
  LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."search_users_by_username"("search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_spot_cover_photo"("p_photo_id" "uuid") RETURNS "public"."spot_photos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_photo spot_photos;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_photo
  FROM spot_photos
  WHERE id = p_photo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foto nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (is_list_owner(v_photo.list_id, v_user_id) OR is_list_editor(v_photo.list_id, v_user_id)) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  UPDATE foodspots
  SET
    cover_image_id = v_photo.id,
    cover_photo_url = v_photo.public_url,
    updated_at = timezone('utc', now())
  WHERE id = v_photo.spot_id;

  RETURN v_photo;
END;
$$;


ALTER FUNCTION "public"."set_spot_cover_photo"("p_photo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_foodspot_ratings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_foodspot_ratings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_spot_photos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_spot_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_user_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_user_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Synchronisiere oder aktualisiere user_profiles
  INSERT INTO user_profiles (id, email, username, profile_image_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    -- Username: Aus user_metadata, falls vorhanden, sonst Email-Prefix
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    -- Profile Image: Aus user_metadata
    NEW.raw_user_meta_data->>'profileImageUrl',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    -- Username immer aktualisieren (auch wenn sich user_metadata.username geändert hat)
    username = COALESCE(
      NULLIF(EXCLUDED.username, ''),
      user_profiles.username
    ),
    -- Profile Image: Aktualisieren wenn vorhanden, sonst behalten
    profile_image_url = COALESCE(
      NULLIF(EXCLUDED.profile_image_url, ''),
      user_profiles.profile_image_url
    ),
    updated_at = now();
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_profile"() IS 'Synchronisiert user_profiles automatisch bei Änderungen in auth.users. Wird von Triggern aufgerufen.';



CREATE OR REPLACE FUNCTION "public"."trg_refresh_foodspot_aggregates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_foodspot_id UUID;
BEGIN
  v_foodspot_id := COALESCE(NEW.foodspot_id, OLD.foodspot_id);
  PERFORM refresh_foodspot_aggregates(v_foodspot_id);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trg_refresh_foodspot_aggregates"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "ref_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."foodspot_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "foodspot_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "score" numeric(4,2) NOT NULL,
    "criteria" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "foodspot_ratings_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (10)::numeric)))
);


ALTER TABLE "public"."foodspot_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" character varying(20) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "friendships_check" CHECK (("requester_id" <> "addressee_id")),
    CONSTRAINT "friendships_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'blocked'::character varying])::"text"[])))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."list_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(20) DEFAULT 'viewer'::character varying NOT NULL,
    "added_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "list_collaborators_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['viewer'::character varying, 'editor'::character varying])::"text"[])))
);


ALTER TABLE "public"."list_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."list_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "invitee_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "responded_at" timestamp with time zone,
    "role" character varying(20) DEFAULT 'editor'::character varying NOT NULL,
    CONSTRAINT "list_invitations_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['viewer'::character varying, 'editor'::character varying])::"text"[]))),
    CONSTRAINT "list_invitations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."list_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."list_invitations" IS 'Einladungen zu geteilten Listen';



COMMENT ON COLUMN "public"."list_invitations"."status" IS 'Status: pending, accepted, rejected';



COMMENT ON COLUMN "public"."list_invitations"."role" IS 'Rolle des eingeladenen Users: viewer oder editor';



CREATE TABLE IF NOT EXISTS "public"."list_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(20) DEFAULT 'editor'::character varying NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "list_members_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['editor'::character varying, 'viewer'::character varying])::"text"[])))
);


ALTER TABLE "public"."list_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."list_members" IS 'Mitglieder geteilter Listen (inkl. Owner)';



COMMENT ON COLUMN "public"."list_members"."role" IS 'Rolle: editor (kann bearbeiten) oder viewer (nur lesen)';



CREATE TABLE IF NOT EXISTS "public"."lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "list_name" character varying(100) NOT NULL,
    "city" character varying(100) NOT NULL,
    "description" "text",
    "cover_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "category" character varying(50)
);


ALTER TABLE "public"."lists" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lists"."category" IS 'Kategorie der Liste (null = alle Kategorien, sonst spezifische Kategorie wie Döner, Burger, etc.)';



CREATE TABLE IF NOT EXISTS "public"."shared_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "visibility" character varying(20) DEFAULT 'private'::character varying NOT NULL,
    "share_link" "uuid" DEFAULT "gen_random_uuid"(),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "shared_lists_visibility_check" CHECK ((("visibility")::"text" = ANY ((ARRAY['private'::character varying, 'friends'::character varying, 'link'::character varying, 'public'::character varying, 'participants'::character varying])::"text"[])))
);


ALTER TABLE "public"."shared_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "profile_image_url" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."foodspot_ratings"
    ADD CONSTRAINT "foodspot_ratings_foodspot_id_user_id_key" UNIQUE ("foodspot_id", "user_id");



ALTER TABLE ONLY "public"."foodspot_ratings"
    ADD CONSTRAINT "foodspot_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."foodspots"
    ADD CONSTRAINT "foodspots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_addressee_id_key" UNIQUE ("requester_id", "addressee_id");



ALTER TABLE ONLY "public"."list_collaborators"
    ADD CONSTRAINT "list_collaborators_list_id_user_id_key" UNIQUE ("list_id", "user_id");



ALTER TABLE ONLY "public"."list_collaborators"
    ADD CONSTRAINT "list_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."list_invitations"
    ADD CONSTRAINT "list_invitations_list_id_invitee_id_status_key" UNIQUE ("list_id", "invitee_id", "status");



ALTER TABLE ONLY "public"."list_invitations"
    ADD CONSTRAINT "list_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."list_members"
    ADD CONSTRAINT "list_members_list_id_user_id_key" UNIQUE ("list_id", "user_id");



ALTER TABLE ONLY "public"."list_members"
    ADD CONSTRAINT "list_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_user_id_list_name_key" UNIQUE ("user_id", "list_name");



ALTER TABLE ONLY "public"."shared_lists"
    ADD CONSTRAINT "shared_lists_list_id_key" UNIQUE ("list_id");



ALTER TABLE ONLY "public"."shared_lists"
    ADD CONSTRAINT "shared_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spot_photos"
    ADD CONSTRAINT "spot_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



CREATE INDEX "idx_activity_created_at" ON "public"."activity" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_ref_id" ON "public"."activity" USING "btree" ("ref_id");



CREATE INDEX "idx_activity_type" ON "public"."activity" USING "btree" ("type");



CREATE INDEX "idx_activity_user_id" ON "public"."activity" USING "btree" ("user_id");



CREATE INDEX "idx_foodspot_ratings_foodspot" ON "public"."foodspot_ratings" USING "btree" ("foodspot_id");



CREATE INDEX "idx_foodspot_ratings_list_user" ON "public"."foodspot_ratings" USING "btree" ("list_id", "user_id");



CREATE INDEX "idx_foodspots_list_id" ON "public"."foodspots" USING "btree" ("list_id");



CREATE UNIQUE INDEX "idx_foodspots_unique_name_per_list" ON "public"."foodspots" USING "btree" ("list_id", "normalized_name");



CREATE INDEX "idx_foodspots_user_id" ON "public"."foodspots" USING "btree" ("user_id");



CREATE INDEX "idx_friendships_addressee" ON "public"."friendships" USING "btree" ("addressee_id");



CREATE INDEX "idx_friendships_pair" ON "public"."friendships" USING "btree" ("requester_id", "addressee_id");



CREATE INDEX "idx_friendships_requester" ON "public"."friendships" USING "btree" ("requester_id");



CREATE INDEX "idx_friendships_status" ON "public"."friendships" USING "btree" ("status");



CREATE INDEX "idx_list_collaborators_list_id" ON "public"."list_collaborators" USING "btree" ("list_id");



CREATE INDEX "idx_list_collaborators_list_user" ON "public"."list_collaborators" USING "btree" ("list_id", "user_id");



CREATE INDEX "idx_list_collaborators_pair" ON "public"."list_collaborators" USING "btree" ("list_id", "user_id");



CREATE INDEX "idx_list_collaborators_user_id" ON "public"."list_collaborators" USING "btree" ("user_id");



CREATE INDEX "idx_list_invitations_invitee_id" ON "public"."list_invitations" USING "btree" ("invitee_id");



CREATE INDEX "idx_list_invitations_inviter_id" ON "public"."list_invitations" USING "btree" ("inviter_id");



CREATE INDEX "idx_list_invitations_list_id" ON "public"."list_invitations" USING "btree" ("list_id");



CREATE INDEX "idx_list_invitations_status" ON "public"."list_invitations" USING "btree" ("status");



CREATE INDEX "idx_list_members_list_id" ON "public"."list_members" USING "btree" ("list_id");



CREATE INDEX "idx_list_members_user_id" ON "public"."list_members" USING "btree" ("user_id");



CREATE INDEX "idx_lists_category" ON "public"."lists" USING "btree" ("category") WHERE ("category" IS NOT NULL);



CREATE INDEX "idx_lists_created_at" ON "public"."lists" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lists_owner_id" ON "public"."lists" USING "btree" ("user_id");



CREATE INDEX "idx_lists_user_id" ON "public"."lists" USING "btree" ("user_id");



CREATE INDEX "idx_shared_lists_list_id" ON "public"."shared_lists" USING "btree" ("list_id");



CREATE INDEX "idx_shared_lists_owner_id" ON "public"."shared_lists" USING "btree" ("owner_id");



CREATE INDEX "idx_shared_lists_share_link" ON "public"."shared_lists" USING "btree" ("share_link");



CREATE INDEX "idx_shared_lists_visibility" ON "public"."shared_lists" USING "btree" ("visibility");



CREATE INDEX "idx_spot_photos_created_at" ON "public"."spot_photos" USING "btree" ("created_at");



CREATE INDEX "idx_spot_photos_list_id" ON "public"."spot_photos" USING "btree" ("list_id");



CREATE INDEX "idx_spot_photos_spot_id" ON "public"."spot_photos" USING "btree" ("spot_id");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_username" ON "public"."user_profiles" USING "btree" ("username");



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."lists" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_foodspot_ratings" BEFORE UPDATE ON "public"."foodspot_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_foodspot_ratings"();



CREATE OR REPLACE TRIGGER "set_updated_at_foodspots" BEFORE UPDATE ON "public"."foodspots" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_friendships" BEFORE UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_shared_lists" BEFORE UPDATE ON "public"."shared_lists" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_foodspot_ratings_after_iud" AFTER INSERT OR DELETE OR UPDATE ON "public"."foodspot_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."trg_refresh_foodspot_aggregates"();



CREATE OR REPLACE TRIGGER "trg_normalize_foodspot_name" BEFORE INSERT OR UPDATE ON "public"."foodspots" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_foodspot_name"();



CREATE OR REPLACE TRIGGER "trg_spot_photos_updated_at" BEFORE UPDATE ON "public"."spot_photos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_spot_photos"();



CREATE OR REPLACE TRIGGER "trg_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_user_profiles"();



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foodspot_ratings"
    ADD CONSTRAINT "foodspot_ratings_foodspot_id_fkey" FOREIGN KEY ("foodspot_id") REFERENCES "public"."foodspots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foodspot_ratings"
    ADD CONSTRAINT "foodspot_ratings_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foodspot_ratings"
    ADD CONSTRAINT "foodspot_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foodspots"
    ADD CONSTRAINT "foodspots_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "public"."spot_photos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."foodspots"
    ADD CONSTRAINT "foodspots_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foodspots"
    ADD CONSTRAINT "foodspots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_collaborators"
    ADD CONSTRAINT "list_collaborators_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_collaborators"
    ADD CONSTRAINT "list_collaborators_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_collaborators"
    ADD CONSTRAINT "list_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_invitations"
    ADD CONSTRAINT "list_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_invitations"
    ADD CONSTRAINT "list_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_invitations"
    ADD CONSTRAINT "list_invitations_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_members"
    ADD CONSTRAINT "list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_members"
    ADD CONSTRAINT "list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_lists"
    ADD CONSTRAINT "shared_lists_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_lists"
    ADD CONSTRAINT "shared_lists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_photos"
    ADD CONSTRAINT "spot_photos_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_photos"
    ADD CONSTRAINT "spot_photos_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."foodspots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spot_photos"
    ADD CONSTRAINT "spot_photos_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Invitees can add themselves when accepting invitation" ON "public"."list_members" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."has_accepted_invitation"("list_id", "auth"."uid"())));



CREATE POLICY "Invitees can respond to invitations" ON "public"."list_invitations" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "invitee_id") AND (("status")::"text" = 'pending'::"text"))) WITH CHECK ((("auth"."uid"() = "invitee_id") AND (("status")::"text" = ANY ((ARRAY['accepted'::character varying, 'rejected'::character varying])::"text"[])) AND ("responded_at" IS NOT NULL)));



CREATE POLICY "Invitees can view lists they are invited to" ON "public"."lists" FOR SELECT TO "authenticated" USING ("public"."has_pending_invitation"("id", "auth"."uid"()));



CREATE POLICY "Invitees can view their own invitations" ON "public"."list_invitations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "invitee_id"));



CREATE POLICY "List editors can create foodspots in shared lists" ON "public"."foodspots" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_editor"("list_id", "auth"."uid"()))));



CREATE POLICY "List editors can create invitations" ON "public"."list_invitations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_list_editor"("list_id", "auth"."uid"()) AND ("inviter_id" = "auth"."uid"())));



CREATE POLICY "List editors can delete foodspots in shared lists" ON "public"."foodspots" FOR DELETE TO "authenticated" USING (("public"."is_list_owner"("list_id", "auth"."uid"()) OR (("auth"."uid"() = "user_id") AND "public"."is_list_editor"("list_id", "auth"."uid"()))));



COMMENT ON POLICY "List editors can delete foodspots in shared lists" ON "public"."foodspots" IS 'Owner kann alle Foodspots löschen, Editor nur eigene. Für private Listen gilt weiterhin die Policy "Users can delete own foodspots".';



CREATE POLICY "List editors can update foodspots in shared lists" ON "public"."foodspots" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND ("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_editor"("list_id", "auth"."uid"())))) WITH CHECK ((("auth"."uid"() = "user_id") AND ("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_editor"("list_id", "auth"."uid"()))));



CREATE POLICY "List editors can update shared lists" ON "public"."lists" FOR UPDATE TO "authenticated" USING (("public"."is_list_editor"("id", "auth"."uid"()) AND (NOT "public"."is_list_owner"("id", "auth"."uid"())))) WITH CHECK (("public"."is_list_editor"("id", "auth"."uid"()) AND (NOT "public"."is_list_owner"("id", "auth"."uid"()))));



CREATE POLICY "List members can view foodspots in shared lists" ON "public"."foodspots" FOR SELECT TO "authenticated" USING (("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_member"("list_id", "auth"."uid"())));



CREATE POLICY "List members can view shared lists" ON "public"."lists" FOR SELECT TO "authenticated" USING (("public"."is_list_member"("id", "auth"."uid"()) AND (NOT "public"."is_list_owner"("id", "auth"."uid"()))));



CREATE POLICY "List owners can add members" ON "public"."list_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_list_owner"("list_id", "auth"."uid"()));



CREATE POLICY "List owners can create invitations" ON "public"."list_invitations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_list_owner"("list_id", "auth"."uid"()) AND ("inviter_id" = "auth"."uid"())));



CREATE POLICY "List owners can delete invitations" ON "public"."list_invitations" FOR DELETE TO "authenticated" USING ("public"."is_list_owner"("list_id", "auth"."uid"()));



CREATE POLICY "List owners can remove members" ON "public"."list_members" FOR DELETE TO "authenticated" USING (("public"."is_list_owner"("list_id", "auth"."uid"()) AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "List owners can update member roles" ON "public"."list_members" FOR UPDATE TO "authenticated" USING ("public"."is_list_owner"("list_id", "auth"."uid"())) WITH CHECK ("public"."is_list_owner"("list_id", "auth"."uid"()));



CREATE POLICY "List owners can view all invitations" ON "public"."list_invitations" FOR SELECT TO "authenticated" USING ("public"."is_list_owner"("list_id", "auth"."uid"()));



CREATE POLICY "List owners can view all members" ON "public"."list_members" FOR SELECT TO "authenticated" USING ("public"."is_list_owner"("list_id", "auth"."uid"()));



CREATE POLICY "Members can add foodspot ratings" ON "public"."foodspot_ratings" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("public"."is_list_member"("list_id", "auth"."uid"()) OR "public"."is_list_owner"("list_id", "auth"."uid"()))));



CREATE POLICY "Members can delete own foodspot ratings" ON "public"."foodspot_ratings" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_list_editor"("list_id", "auth"."uid"()) OR "public"."is_list_owner"("list_id", "auth"."uid"())));



CREATE POLICY "Members can update own foodspot ratings" ON "public"."foodspot_ratings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Members can view foodspot ratings" ON "public"."foodspot_ratings" FOR SELECT TO "authenticated" USING (("public"."is_list_member"("list_id", "auth"."uid"()) OR "public"."is_list_owner"("list_id", "auth"."uid"())));



CREATE POLICY "Members select spot photos" ON "public"."spot_photos" FOR SELECT TO "authenticated" USING (("public"."is_list_member"("list_id", "auth"."uid"()) OR "public"."is_list_owner"("list_id", "auth"."uid"())));



CREATE POLICY "Owner editor insert spot photos" ON "public"."spot_photos" FOR INSERT WITH CHECK (("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_editor"("list_id", "auth"."uid"())));



CREATE POLICY "Owner editor update spot photos" ON "public"."spot_photos" FOR UPDATE USING (("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_editor"("list_id", "auth"."uid"()))) WITH CHECK (("public"."is_list_owner"("list_id", "auth"."uid"()) OR "public"."is_list_editor"("list_id", "auth"."uid"())));



CREATE POLICY "Owner or uploader delete spot photos" ON "public"."spot_photos" FOR DELETE USING (("public"."is_list_owner"("list_id", "auth"."uid"()) OR ("uploader_user_id" = "auth"."uid"())));



CREATE POLICY "Users can create foodspots in own lists" ON "public"."foodspots" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "foodspots"."list_id") AND ("lists"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create friendship requests" ON "public"."friendships" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Users can create own activity" ON "public"."activity" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own lists" ON "public"."lists" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Users can delete own foodspots" ON "public"."foodspots" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own friendships" ON "public"."friendships" FOR DELETE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



CREATE POLICY "Users can delete own lists" ON "public"."lists" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own foodspots" ON "public"."foodspots" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own lists" ON "public"."lists" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update received friendship requests" ON "public"."friendships" FOR UPDATE USING (("auth"."uid"() = "addressee_id")) WITH CHECK (("auth"."uid"() = "addressee_id"));



CREATE POLICY "Users can view all profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view foodspots in own lists" ON "public"."foodspots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lists"
  WHERE (("lists"."id" = "foodspots"."list_id") AND ("lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view friends' activity" ON "public"."activity" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (((("friendships"."requester_id" = "auth"."uid"()) AND ("friendships"."addressee_id" = "activity"."user_id")) OR (("friendships"."addressee_id" = "auth"."uid"()) AND ("friendships"."requester_id" = "activity"."user_id"))) AND (("friendships"."status")::"text" = 'accepted'::"text")))) AND ((("payload" ->> 'visibility'::"text") = 'friends'::"text") OR (("payload" ->> 'visibility'::"text") = 'public'::"text") OR (("payload" ->> 'visibility'::"text") IS NULL))));



CREATE POLICY "Users can view own activity" ON "public"."activity" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own friendships" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



CREATE POLICY "Users can view own lists" ON "public"."lists" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own memberships" ON "public"."list_members" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."foodspot_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."foodspots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."list_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."list_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spot_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."spot_photos" TO "anon";
GRANT ALL ON TABLE "public"."spot_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."spot_photos" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_spot_photo"("p_list_id" "uuid", "p_spot_id" "uuid", "p_storage_path" "text", "p_public_url" "text", "p_width" integer, "p_height" integer, "p_size_bytes" integer, "p_mime_type" "text", "p_set_as_cover" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."add_spot_photo"("p_list_id" "uuid", "p_spot_id" "uuid", "p_storage_path" "text", "p_public_url" "text", "p_width" integer, "p_height" integer, "p_size_bytes" integer, "p_mime_type" "text", "p_set_as_cover" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_spot_photo"("p_list_id" "uuid", "p_spot_id" "uuid", "p_storage_path" "text", "p_public_url" "text", "p_width" integer, "p_height" integer, "p_size_bytes" integer, "p_mime_type" "text", "p_set_as_cover" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_shared_list"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."create_shared_list"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_shared_list"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_shared_list_with_collaborators"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying, "p_collaborators" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_shared_list_with_collaborators"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying, "p_collaborators" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_shared_list_with_collaborators"("p_list_id" "uuid", "p_owner_id" "uuid", "p_visibility" character varying, "p_collaborators" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_foodspot_rating"("p_foodspot_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_foodspot_rating"("p_foodspot_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_foodspot_rating"("p_foodspot_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_shared_list"("p_list_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shared_list"("p_list_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shared_list"("p_list_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_spot_photo"("p_photo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_spot_photo"("p_photo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_spot_photo"("p_photo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friendship_status"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friendship_status"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friendship_status"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_list_entry_counts"("p_list_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_list_entry_counts"("p_list_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_list_entry_counts"("p_list_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_list_members"("p_list_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_list_members"("p_list_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_list_members"("p_list_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_stats"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_stats"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_stats"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_accepted_invitation"("p_list_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_accepted_invitation"("p_list_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_accepted_invitation"("p_list_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_pending_invitation"("p_list_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_pending_invitation"("p_list_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_pending_invitation"("p_list_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_list_editor"("p_list_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_list_editor"("p_list_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_list_editor"("p_list_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_list_member"("p_list_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_list_member"("p_list_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_list_member"("p_list_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_list_owner"("p_list_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_list_owner"("p_list_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_list_owner"("p_list_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shared_list"("p_list_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_shared_list"("p_list_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shared_list"("p_list_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_shared_list"("p_list_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_shared_list"("p_list_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_shared_list"("p_list_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."foodspots" TO "anon";
GRANT ALL ON TABLE "public"."foodspots" TO "authenticated";
GRANT ALL ON TABLE "public"."foodspots" TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_foodspot"("p_list_id" "uuid", "p_name" "text", "p_score" numeric, "p_criteria" "jsonb", "p_comment" "text", "p_description" "text", "p_category" "text", "p_address" "text", "p_latitude" double precision, "p_longitude" double precision, "p_cover_photo" "text", "p_phone" "text", "p_website" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_foodspot"("p_list_id" "uuid", "p_name" "text", "p_score" numeric, "p_criteria" "jsonb", "p_comment" "text", "p_description" "text", "p_category" "text", "p_address" "text", "p_latitude" double precision, "p_longitude" double precision, "p_cover_photo" "text", "p_phone" "text", "p_website" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_foodspot"("p_list_id" "uuid", "p_name" "text", "p_score" numeric, "p_criteria" "jsonb", "p_comment" "text", "p_description" "text", "p_category" "text", "p_address" "text", "p_latitude" double precision, "p_longitude" double precision, "p_cover_photo" "text", "p_phone" "text", "p_website" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_foodspot_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_foodspot_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_foodspot_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_foodspot_aggregates"("p_foodspot_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_foodspot_aggregates"("p_foodspot_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_foodspot_aggregates"("p_foodspot_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_invitation"("p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_invitation"("p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_users_by_username"("search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_users_by_username"("search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_users_by_username"("search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_spot_cover_photo"("p_photo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_spot_cover_photo"("p_photo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_spot_cover_photo"("p_photo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_foodspot_ratings"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_foodspot_ratings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_foodspot_ratings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_spot_photos"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_spot_photos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_spot_photos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_user_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_user_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_user_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_refresh_foodspot_aggregates"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_refresh_foodspot_aggregates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_refresh_foodspot_aggregates"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity" TO "anon";
GRANT ALL ON TABLE "public"."activity" TO "authenticated";
GRANT ALL ON TABLE "public"."activity" TO "service_role";



GRANT ALL ON TABLE "public"."foodspot_ratings" TO "anon";
GRANT ALL ON TABLE "public"."foodspot_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."foodspot_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."list_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."list_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."list_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."list_invitations" TO "anon";
GRANT ALL ON TABLE "public"."list_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."list_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."list_members" TO "anon";
GRANT ALL ON TABLE "public"."list_members" TO "authenticated";
GRANT ALL ON TABLE "public"."list_members" TO "service_role";



GRANT ALL ON TABLE "public"."lists" TO "anon";
GRANT ALL ON TABLE "public"."lists" TO "authenticated";
GRANT ALL ON TABLE "public"."lists" TO "service_role";



GRANT ALL ON TABLE "public"."shared_lists" TO "anon";
GRANT ALL ON TABLE "public"."shared_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_lists" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































