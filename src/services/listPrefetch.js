import { supabase } from './supabase'

// Vorladen der Listendaten, sobald der Finger eine Listenkarte beruehrt.
//
// Zwischen dem Beruehren und dem Loslassen liegen typischerweise 100-200ms,
// dazu kommt der Screenwechsel — diese Zeit steht sonst ungenutzt herum,
// waehrend der Zielscreen erst NACH dem Aufbau zu laden beginnt.
//
// Bewusst kurzlebig: der Eintrag ist nur fuer die unmittelbar folgende
// Navigation gedacht. Wer eine Karte antippt und doch weiterscrollt, soll
// spaeter keine veralteten Daten sehen.
const TTL_MS = 10000

const cache = new Map() // listId -> { promise, timer }

function drop(listId) {
  const entry = cache.get(listId)
  if (!entry) return
  clearTimeout(entry.timer)
  cache.delete(listId)
}

/**
 * Liste und ihre Spots im Hintergrund holen. Mehrfachaufrufe fuer dieselbe
 * Liste teilen sich die laufende Anfrage.
 */
export function prefetchList(listId, userId) {
  if (!listId || !userId || cache.has(listId)) return

  const promise = Promise.all([
    supabase.from('lists').select('*').eq('id', listId).eq('user_id', userId).single(),
    supabase.from('foodspots').select('*').eq('list_id', listId)
      .order('rating', { ascending: false, nullsLast: true }),
  ])
    .then(([listRes, spotsRes]) => {
      if (listRes.error || spotsRes.error) return null
      return { list: listRes.data, spots: spotsRes.data || [] }
    })
    .catch(() => null)

  const timer = setTimeout(() => drop(listId), TTL_MS)
  cache.set(listId, { promise, timer })
}

/**
 * Vorgeladene Daten abholen und den Eintrag verbrauchen.
 * Gibt null zurueck, wenn nichts vorliegt oder das Vorladen fehlschlug.
 */
export function takePrefetchedList(listId) {
  const entry = cache.get(listId)
  if (!entry) return null
  drop(listId)
  return entry.promise
}
