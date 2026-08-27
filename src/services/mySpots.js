import { supabase } from './supabase'

// Dedupliziert Spots per canonical_key (= gleicher Ort). Bevorzugt den
// Repräsentanten mit Bild bzw. mit vorhandener Bewertung, damit auf der
// Karte pro Ort genau eine Nadel steht (privat + geteilt gemerged).
export function dedupeByCanonicalKey(spots) {
  const byKey = new Map()
  for (const s of spots) {
    const key = s.canonical_key || `id|${s.id}`
    const existing = byKey.get(key)
    if (!existing) { byKey.set(key, s); continue }
    const better =
      (s.cover_photo_url && !existing.cover_photo_url) ||
      (s.rating != null && existing.rating == null)
    if (better) byKey.set(key, s)
  }
  return Array.from(byKey.values())
}

// Lädt die verorteten Spots des Nutzers für die Profil-Weltkarte:
//  - private Listen: alle eigenen Spots (foodspots.user_id === ich)
//  - geteilte Listen: nur Spots, die ICH selbst bewertet habe (foodspot_ratings)
// Anzeige-Bewertung bleibt der App-Durchschnitt (avg_score ?? rating); die
// foodspot_ratings-Abfrage dient NUR als Ja/Nein-Filter. Dedupliziert per
// canonical_key (privat + geteilt = eine Nadel pro Ort).
export async function getMyMappedSpots(userId) {
  if (!userId) return []

  // 1) Listen: eigene + Mitgliedschaften
  const [{ data: ownLists }, { data: memberRows }] = await Promise.all([
    supabase.from('lists').select('id').eq('user_id', userId),
    supabase.from('list_members').select('list_id').eq('user_id', userId),
  ])

  const listIds = Array.from(new Set([
    ...(ownLists || []).map((l) => l.id),
    ...(memberRows || []).map((r) => r.list_id),
  ]))
  if (listIds.length === 0) return []

  // 2) Spots mit Koordinaten + meine Bewertungs-Einträge (nur zum Filtern)
  const [{ data: spots, error }, { data: myRatings }] = await Promise.all([
    supabase
      .from('foodspots')
      .select('id, name, rating, avg_score, category, address, cover_photo_url, latitude, longitude, canonical_key, user_id')
      .in('list_id', listIds)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    supabase
      .from('foodspot_ratings')
      .select('foodspot_id')
      .eq('user_id', userId),
  ])

  if (error || !spots) return []

  const ratedByMe = new Set((myRatings || []).map((r) => r.foodspot_id))

  // privat (ich = Ersteller) ODER geteilt aber von mir bewertet
  const mine = spots
    .filter((s) => s.user_id === userId || ratedByMe.has(s.id))
    .map((s) => ({
      ...s,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
    }))

  return dedupeByCanonicalKey(mine)
}
