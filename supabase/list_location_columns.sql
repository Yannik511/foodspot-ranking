-- =============================================
-- MIGRATION 054: Präziser Listen-Standort (MapKit)
-- =============================================
-- Der Listen-Standort läuft künftig über dieselbe MapKit-Auswahl wie Spots.
-- Neue Präzisionsfelder auf der Liste — UNABHÄNGIG von den Spot-Koordinaten.
--
-- Datenmodell-Prinzip:
--   - lists.latitude/longitude/address = Anker/Label der Liste (grobe Verortung).
--   - foodspots.latitude/longitude/address = Source of Truth für Discover/Weltkarte.
--   Beide Ebenen existieren unabhängig; das Ändern des Listen-Standorts lässt
--   bestehende Spots unberührt. `city` bleibt als kurzes Anzeige-/Filter-Label.
-- =============================================

ALTER TABLE "public"."lists"
  ADD COLUMN IF NOT EXISTS "latitude"  double precision,
  ADD COLUMN IF NOT EXISTS "longitude" double precision,
  ADD COLUMN IF NOT EXISTS "address"   text;

COMMENT ON COLUMN "public"."lists"."latitude"  IS 'Grober Anker-Standort der Liste (MapKit). Unabhängig von Spot-Koordinaten.';
COMMENT ON COLUMN "public"."lists"."longitude" IS 'Grober Anker-Standort der Liste (MapKit). Unabhängig von Spot-Koordinaten.';
COMMENT ON COLUMN "public"."lists"."address"   IS 'Volle formatierte Adresse des Listen-Ankers (MapKit). city bleibt Kurz-Label.';
