-- Rollback für 047_create_get_list_entry_counts_function_up.sql

SET search_path TO public;

REVOKE EXECUTE ON FUNCTION public.get_list_entry_counts(uuid[]) FROM authenticated;
DROP FUNCTION IF EXISTS public.get_list_entry_counts(uuid[]);

