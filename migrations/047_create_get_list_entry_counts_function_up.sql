-- 047_create_get_list_entry_counts_function_up.sql
-- Zweck: Schnelleres Laden der Listen durch serverseitiges Aggregieren der Foodspot-Anzahlen

SET search_path TO public;

DROP FUNCTION IF EXISTS public.get_list_entry_counts(uuid[]);

CREATE OR REPLACE FUNCTION public.get_list_entry_counts(p_list_ids uuid[])
RETURNS TABLE (
  list_id uuid,
  entry_count integer
)
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.list_id,
    COUNT(*)::integer AS entry_count
  FROM public.foodspots f
  WHERE f.list_id = ANY(p_list_ids)
  GROUP BY f.list_id;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_list_entry_counts(uuid[]) TO authenticated;

