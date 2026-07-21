-- Rollback Migration 052: Discover-Feed-Funktionen entfernen.
-- Rein additiv angelegt → sauberes Entfernen ohne Nebenwirkungen.

DROP FUNCTION IF EXISTS public.get_discover_nearby(double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.get_discover_top_by_category(integer);
DROP FUNCTION IF EXISTS public.get_discover_friends_recent(integer);
