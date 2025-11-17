-- =============================================
-- MIGRATION 049 (DOWN): ROLLBACK AUTO-SYNC USER_PROFILES
-- =============================================
-- Stellt den Zustand vor Migration 049 wieder her.
-- 
-- ENTWARNUNG: Diese Migration entfernt NUR die Trigger und Funktionen.
-- Die synchronisierten Daten in user_profiles bleiben erhalten!
-- (Das ist sicherer als alles zu löschen)
-- =============================================

SET search_path TO public, auth;

-- =============================================
-- SCHRITT 1: Entferne Trigger
-- =============================================
-- Trigger entfernen, die automatische Synchronisation durchführen

DROP TRIGGER IF EXISTS trigger_sync_user_profile_update ON auth.users;
DROP TRIGGER IF EXISTS trigger_sync_user_profile_insert ON auth.users;

-- =============================================
-- SCHRITT 2: Entferne Funktion
-- =============================================
-- Die sync_user_profile() Funktion entfernen

DROP FUNCTION IF EXISTS sync_user_profile() CASCADE;

-- =============================================
-- HINWEIS ZU DEN DATEN:
-- =============================================
-- Die bereits synchronisierten Daten in user_profiles bleiben erhalten!
-- 
-- Falls du die Daten auch zurücksetzen willst (NICHT EMPFOHLEN!),
-- kannst du diese SQL-Befehle manuell ausführen:
--
--   -- ENTWARNUNG: Löscht alle User, die NICHT in auth.users existieren
--   -- (Normalerweise sollte das nicht passieren)
--   DELETE FROM user_profiles 
--   WHERE id NOT IN (SELECT id FROM auth.users);
--
-- ABER: Das wird NICHT automatisch ausgeführt, da es Datenverlust
-- verursachen könnte. Die synchronisierten User bleiben erhalten.
-- =============================================

-- =============================================
-- ERFOLG: Rollback abgeschlossen!
-- =============================================
-- ✅ Trigger wurden entfernt
-- ✅ Funktion wurde entfernt
-- ✅ user_profiles Daten bleiben erhalten (sicherer)
-- 
-- Nach diesem Rollback wird KEINE automatische Synchronisation mehr
-- durchgeführt. Neue User müssen manuell synchronisiert werden oder
-- du musst Migration 049 erneut ausführen.
-- =============================================

