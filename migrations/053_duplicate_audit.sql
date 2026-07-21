-- Duplikat-Audit (Task 3) — NUR LESEN, ändert nichts.
-- Erst 053_discover_canonical_geo.sql laufen lassen (setzt canonical_key), dann das hier.
-- Zeigt physische Spots, die von mehreren Einträgen/Nutzern mit ABWEICHENDER Adresse angelegt wurden.

-- (A) Kanonische Spots mit mehreren Einträgen und >1 unterschiedlicher Adresse
SELECT
  canonical_key,
  count(*)                              AS eintraege,
  count(DISTINCT user_id)               AS nutzer,
  count(DISTINCT btrim(lower(coalesce(address, '')))) AS verschiedene_adressen,
  min(created_at)                       AS erst_angelegt,
  array_agg(DISTINCT address)           AS adressen,
  array_agg(DISTINCT name)              AS namen
FROM public.foodspots
WHERE canonical_key IS NOT NULL
GROUP BY canonical_key
HAVING count(*) > 1
   AND count(DISTINCT btrim(lower(coalesce(address, '')))) > 1
ORDER BY eintraege DESC;

-- (B) Grobzahl: wie viele kanonische Spots sind überhaupt mehrfach vorhanden?
-- SELECT count(*) AS mehrfach_vorhandene_spots
-- FROM (
--   SELECT canonical_key FROM public.foodspots
--   WHERE canonical_key IS NOT NULL
--   GROUP BY canonical_key HAVING count(*) > 1
-- ) t;

-- Migrationsweg (VORSCHLAG, NICHT ausführen ohne Freigabe):
--   Für jeden canonical_key mit abweichenden Adressen gilt die Adresse des
--   ältesten Eintrags (min(created_at)) als kanonisch. Ein optionales UPDATE
--   würde die Adressen der jüngeren Einträge darauf vereinheitlichen:
--
--   WITH canon AS (
--     SELECT DISTINCT ON (canonical_key) canonical_key, address AS canon_address
--     FROM public.foodspots
--     WHERE canonical_key IS NOT NULL
--     ORDER BY canonical_key, created_at ASC
--   )
--   UPDATE public.foodspots f
--   SET address = c.canon_address
--   FROM canon c
--   WHERE f.canonical_key = c.canonical_key
--     AND f.address IS DISTINCT FROM c.canon_address;
--
--   → Erst nach Sichtung von (A) entscheiden, ob dieses Angleichen gewünscht ist.
