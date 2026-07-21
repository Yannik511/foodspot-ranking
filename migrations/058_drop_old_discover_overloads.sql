-- Migration 058: Alte 052-Discover-Funktionen entfernen (Overload-Konflikt).
--
-- CREATE OR REPLACE mit geänderter Signatur ersetzt NICHT, sondern legt eine
-- zweite Überladung an. Die Ein-Parameter-Versionen aus 052 kollidieren mit den
-- neuen Mehr-Parameter-Versionen: Ruft die App get_discover_friends_recent nur
-- mit p_limit auf, passen beide → PostgREST-Fehler "not unique" → Sektion leer.
--
-- Diese Migration entfernt die veralteten Überladungen. Rein additiv/aufräumend.

DROP FUNCTION IF EXISTS public.get_discover_friends_recent(integer);
DROP FUNCTION IF EXISTS public.get_discover_top_by_category(integer);
DROP FUNCTION IF EXISTS public.get_discover_nearby(double precision, double precision, integer);
