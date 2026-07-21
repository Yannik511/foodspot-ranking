-- Rollback Migration 053.
-- Entfernt die neuen Funktionen, Trigger und Spalten. Rein additiv angelegt.

DROP FUNCTION IF EXISTS public.find_canonical_spot(double precision, double precision, text, text);
DROP FUNCTION IF EXISTS public.get_discover_friends_recent(integer, text[], text[], text);
DROP FUNCTION IF EXISTS public.get_discover_top_by_category(integer, text[], text[], text);
DROP FUNCTION IF EXISTS public.get_discover_ranked(double precision, double precision, text[], text[], text, integer, double precision);

DROP TRIGGER IF EXISTS trg_foodspot_canonical_key ON public.foodspots;
DROP FUNCTION IF EXISTS public.set_foodspot_canonical_key();

DROP INDEX IF EXISTS public.idx_foodspots_canonical_key;
DROP INDEX IF EXISTS public.idx_foodspots_country_code;
DROP INDEX IF EXISTS public.idx_foodspots_city;
DROP INDEX IF EXISTS public.idx_foodspots_category;

ALTER TABLE public.foodspots DROP COLUMN IF EXISTS canonical_key;
ALTER TABLE public.foodspots DROP COLUMN IF EXISTS country_code;
ALTER TABLE public.foodspots DROP COLUMN IF EXISTS city;
