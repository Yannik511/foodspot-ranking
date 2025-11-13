-- =============================================
-- MIGRATION 046 (DOWN): DROP get_shared_list_members FUNCTION
-- =============================================
-- Stellt den Zustand vor Migration 046 wieder her.
-- =============================================

REVOKE EXECUTE ON FUNCTION public.get_shared_list_members(uuid) FROM authenticated;

DROP FUNCTION IF EXISTS public.get_shared_list_members(uuid);

-- =============================================
-- ENDE DOWN-MIGRATION
-- =============================================

