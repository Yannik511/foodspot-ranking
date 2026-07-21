-- Migration 060: canonical_key erneut backfillen (nach aktuellem list_mode).
--
-- Grund: Wurde eine Liste nach dem Anlegen der Spots auf 'product' umgestellt,
-- blieb der canonical_key veraltet (z. B. 'name|guiness' statt 'product|guiness'),
-- weil der Trigger nur bei Änderung von lat/lng/name feuert, nicht bei list_mode.
-- Dieser Backfill vereinheitlicht alle Schlüssel nach dem AKTUELLEN Typ.
-- Idempotent, rein korrigierend.

UPDATE public.foodspots f
SET canonical_key = CASE
  WHEN l.list_mode = 'product'
    THEN 'product|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
  WHEN f.latitude IS NOT NULL AND f.longitude IS NOT NULL
    THEN 'geo|' || round(f.latitude, 4)::text || '|' || round(f.longitude, 4)::text
  ELSE
    'name|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
END
FROM public.lists l
WHERE l.id = f.list_id
  AND f.canonical_key IS DISTINCT FROM (
    CASE
      WHEN l.list_mode = 'product'
        THEN 'product|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
      WHEN f.latitude IS NOT NULL AND f.longitude IS NOT NULL
        THEN 'geo|' || round(f.latitude, 4)::text || '|' || round(f.longitude, 4)::text
      ELSE
        'name|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
    END
  );
