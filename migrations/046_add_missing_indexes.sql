-- Migration 046: Fehlende Indizes für Hot Query-Patterns
--
-- Die initiale Migration 004 hatte nur Indizes auf `lists` und `foodspots`.
-- Beim Wachstum der App (mehr Mitglieder, Einladungen, Bewertungen, Fotos)
-- werden die folgenden Tabellen Scan-lastig. CREATE INDEX IF NOT EXISTS
-- macht das Skript idempotent.
--
-- Alle CONCURRENTLY weggelassen, damit die Migration auch im Pooler-Modus
-- läuft und in einer Transaktion stattfindet.

-- foodspot_ratings: Hot bei Detail-Anzeige eines Spots + persönlichen Stats
CREATE INDEX IF NOT EXISTS idx_foodspot_ratings_foodspot_id
  ON foodspot_ratings(foodspot_id);

CREATE INDEX IF NOT EXISTS idx_foodspot_ratings_user_id
  ON foodspot_ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_foodspot_ratings_list_user
  ON foodspot_ratings(list_id, user_id);

-- list_members: Hot bei jeder RLS-Auswertung (is_list_member, is_list_editor)
CREATE INDEX IF NOT EXISTS idx_list_members_list_user
  ON list_members(list_id, user_id);

CREATE INDEX IF NOT EXISTS idx_list_members_user_id
  ON list_members(user_id);

-- list_invitations: Hot bei Social-Tab (fetchListInvitations) und Notifications
CREATE INDEX IF NOT EXISTS idx_list_invitations_invitee_status
  ON list_invitations(invitee_id, status);

CREATE INDEX IF NOT EXISTS idx_list_invitations_list_id
  ON list_invitations(list_id);

-- friendships: Hot bei Social-Tab und Suche
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status
  ON friendships(requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status
  ON friendships(addressee_id, status);

-- spot_photos: Hot bei Photo-Gallery eines Spots + Cleanup auf list-Ebene
CREATE INDEX IF NOT EXISTS idx_spot_photos_spot_id
  ON spot_photos(spot_id);

CREATE INDEX IF NOT EXISTS idx_spot_photos_list_id
  ON spot_photos(list_id);

-- Orphan-Cleanup: idx_lists_is_public verweist auf eine Spalte, die in der
-- aktuellen Schema-Version nicht mehr existiert. Index entfernen, falls da.
DROP INDEX IF EXISTS idx_lists_is_public;
