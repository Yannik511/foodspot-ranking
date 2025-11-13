-- =============================================
-- 026_shared_spot_photos.sql
-- Fotos für geteilte Foodspots + Cover-Handling
-- =============================================

-- 1) Tabelle für Spot-Fotos
CREATE TABLE IF NOT EXISTS spot_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES foodspots (id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_spot_photos_spot_id ON spot_photos (spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_photos_list_id ON spot_photos (list_id);
CREATE INDEX IF NOT EXISTS idx_spot_photos_created_at ON spot_photos (created_at);

-- 2) Trigger für updated_at
CREATE OR REPLACE FUNCTION set_updated_at_spot_photos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spot_photos_updated_at ON spot_photos;
CREATE TRIGGER trg_spot_photos_updated_at
BEFORE UPDATE ON spot_photos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_spot_photos();

-- 3) Cover-Bild Referenz auf Foodspots
ALTER TABLE foodspots
  ADD COLUMN IF NOT EXISTS cover_image_id UUID;

ALTER TABLE foodspots
  DROP CONSTRAINT IF EXISTS foodspots_cover_image_id_fkey;

ALTER TABLE foodspots
  ADD CONSTRAINT foodspots_cover_image_id_fkey
  FOREIGN KEY (cover_image_id)
  REFERENCES spot_photos(id)
  ON DELETE SET NULL;

-- 4) RLS für spot_photos
ALTER TABLE spot_photos ENABLE ROW LEVEL SECURITY;

-- Alle Listen-Mitglieder dürfen Fotos sehen
DROP POLICY IF EXISTS "Members select spot photos" ON spot_photos;
CREATE POLICY "Members select spot photos"
ON spot_photos
FOR SELECT
USING (
  is_list_member(list_id, auth.uid())
);

-- Nur Owner/Editor dürfen Fotos hinzufügen
DROP POLICY IF EXISTS "Owner editor insert spot photos" ON spot_photos;
CREATE POLICY "Owner editor insert spot photos"
ON spot_photos
FOR INSERT
WITH CHECK (
  is_list_owner(list_id, auth.uid()) OR is_list_editor(list_id, auth.uid())
);

-- Owner oder Uploader dürfen löschen
DROP POLICY IF EXISTS "Owner or uploader delete spot photos" ON spot_photos;
CREATE POLICY "Owner or uploader delete spot photos"
ON spot_photos
FOR DELETE
USING (
  is_list_owner(list_id, auth.uid()) OR uploader_user_id = auth.uid()
);

-- Updates werden nur über Server-Funktionen erlaubt
DROP POLICY IF EXISTS "Owner editor update spot photos" ON spot_photos;
CREATE POLICY "Owner editor update spot photos"
ON spot_photos
FOR UPDATE
USING (
  is_list_owner(list_id, auth.uid()) OR is_list_editor(list_id, auth.uid())
)
WITH CHECK (
  is_list_owner(list_id, auth.uid()) OR is_list_editor(list_id, auth.uid())
);

-- 5) RPC: Foto hinzufügen
CREATE OR REPLACE FUNCTION add_spot_photo(
  p_list_id UUID,
  p_spot_id UUID,
  p_storage_path TEXT,
  p_public_url TEXT,
  p_width INTEGER DEFAULT NULL,
  p_height INTEGER DEFAULT NULL,
  p_size_bytes INTEGER DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_set_as_cover BOOLEAN DEFAULT FALSE
)
RETURNS spot_photos
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6) RPC: Cover setzen
CREATE OR REPLACE FUNCTION set_spot_cover_photo(
  p_photo_id UUID
)
RETURNS spot_photos
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 7) RPC: Foto löschen + Cover-Fallback
CREATE OR REPLACE FUNCTION delete_spot_photo(
  p_photo_id UUID
)
RETURNS TABLE (
  deleted_id UUID,
  list_id UUID,
  spot_id UUID,
  storage_path TEXT,
  new_cover_id UUID,
  new_cover_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- =============================================
-- ENDE 026_shared_spot_photos.sql
-- =============================================





