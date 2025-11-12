-- =============================================
-- 027_shared_spot_photos_storage_policies.sql
-- Zusätzliche Storage Policies für Shared-Spot-Fotos
-- =============================================

-- Owner & Editoren dürfen Fotos für geteilte Listen hochladen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'Shared list editors upload photos'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "Shared list editors upload photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'list-covers'
      AND split_part(name, '/', 1) = 'shared-lists'
      AND split_part(name, '/', 3) = 'spots'
      AND (
        is_list_owner(split_part(name, '/', 2)::uuid, auth.uid())
        OR is_list_editor(split_part(name, '/', 2)::uuid, auth.uid())
      )
    );
  END IF;
END
$$;

-- Owner & Editoren dürfen Fotos für geteilte Listen löschen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'Shared list editors delete photos'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "Shared list editors delete photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'list-covers'
      AND split_part(name, '/', 1) = 'shared-lists'
      AND split_part(name, '/', 3) = 'spots'
      AND (
        is_list_owner(split_part(name, '/', 2)::uuid, auth.uid())
        OR is_list_editor(split_part(name, '/', 2)::uuid, auth.uid())
      )
    );
  END IF;
END
$$;

-- =============================================
-- ENDE 027_shared_spot_photos_storage_policies.sql
-- =============================================




