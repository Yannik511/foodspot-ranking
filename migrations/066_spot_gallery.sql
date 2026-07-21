-- Migration 066: Galerie-RPC für die Detailansicht (Feature Teil B).
--
-- Eine kanonische Gruppe (canonical_key) bündelt mehrere Spots, jeder mit
-- eigenem cover_photo_url. Diese Funktion liefert bis zu N (Default 5) eindeutige
-- Bilder der Gruppe für die scrollbare Vorschau — lazy beim Tap auf eine Card,
-- damit die Feed-RPCs schlank bleiben.
--
-- Nur Bilder von Nutzern mit aktivem Statistik-Teilen (wie die Feeds).
-- Dedupliziert identische URLs, sortiert nach erstem Auftreten (ältester zuerst).

CREATE OR REPLACE FUNCTION public.get_spot_gallery(
  p_canonical_key text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.url
  FROM (
    SELECT f.cover_photo_url AS url, min(f.created_at) AS first_seen
    FROM public.foodspots f
    JOIN auth.users au ON au.id = f.user_id
    WHERE COALESCE(f.canonical_key, f.id::text) = p_canonical_key
      AND f.cover_photo_url IS NOT NULL
      AND COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
    GROUP BY f.cover_photo_url
  ) t
  ORDER BY t.first_seen ASC
  LIMIT GREATEST(p_limit, 1);
$$;
