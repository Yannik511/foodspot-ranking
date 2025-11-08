-- =============================================
-- WICHTIG: FÜHRE ZUERST RESTORE_BASIC_FUNCTIONS.sql AUS!
-- =============================================
-- Diese Datei löscht nur die Daten, nicht die Policies.
-- Die vollständige Lösung ist in RESTORE_BASIC_FUNCTIONS.sql
-- =============================================

-- Lösche alle geteilten Listen Daten
DELETE FROM list_collaborators;
DELETE FROM shared_lists;

-- Überprüfung: Zeige, ob noch Einträge vorhanden sind
SELECT 
  (SELECT COUNT(*) FROM list_collaborators) as remaining_collaborators,
  (SELECT COUNT(*) FROM shared_lists) as remaining_shared_lists;

