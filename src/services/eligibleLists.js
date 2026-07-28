import { supabase } from './supabase'

// Read-only Helper für das Feature „Spot aus Entdecken zu Liste hinzufügen".
// Liefert die Listen, in die der aktuelle User einen entdeckten Spot legen darf:
//   - eigene Listen (lists.user_id === userId)
//   - geteilte Listen, in denen man Owner/Editor ist (list_members.role)
// gefiltert nach der Kategorie-Regel:
//   list.category == null  → „Alle Kategorien"-Liste, nimmt alles
//   list.category === spot.category → passende Kategorie-Liste
// Jede Liste bekommt:
//   isShared  → Route-Entscheidung (/shared/add-foodspot vs /add-foodspot)
//   disabled  → true, wenn der canonical_key in der Liste bereits existiert (Dedupe)

const LIST_COLS = 'id, list_name, category, cover_image_url, user_id'

export async function fetchEligibleLists({ userId, spotCategory, canonicalKey }) {
  if (!userId) return []

  // 1) Eigene Listen
  const { data: owned } = await supabase
    .from('lists')
    .select(LIST_COLS)
    .eq('user_id', userId)

  // 2) Geteilte Listen mit Bearbeitungsrecht (Owner/Editor), die anderen gehören
  const { data: memberRows } = await supabase
    .from('list_members')
    .select('list_id, role')
    .eq('user_id', userId)
    .in('role', ['owner', 'editor'])

  const memberListIds = (memberRows || []).map((r) => r.list_id).filter(Boolean)
  let sharedFromMembership = []
  if (memberListIds.length) {
    const { data } = await supabase.from('lists').select(LIST_COLS).in('id', memberListIds)
    sharedFromMembership = data || []
  }

  // Zusammenführen, nach id deduplizieren
  const byId = new Map()
  for (const l of [...(owned || []), ...sharedFromMembership]) {
    if (l && !byId.has(l.id)) byId.set(l.id, l)
  }
  let lists = [...byId.values()]

  // Kategorie-Regel
  lists = lists.filter((l) => l.category == null || l.category === spotCategory)
  if (lists.length === 0) return []

  const listIds = lists.map((l) => l.id)

  // Welche (eigenen) Listen sind geteilt? → haben Einträge in list_members
  const sharedIdSet = new Set(memberListIds)
  const { data: memberOfLists } = await supabase
    .from('list_members')
    .select('list_id')
    .in('list_id', listIds)
  for (const r of memberOfLists || []) if (r?.list_id) sharedIdSet.add(r.list_id)

  // Dedupe: welche Listen enthalten den canonical_key schon?
  const alreadyIn = new Set()
  if (canonicalKey) {
    const { data: existing } = await supabase
      .from('foodspots')
      .select('list_id')
      .in('list_id', listIds)
      .eq('canonical_key', canonicalKey)
    for (const r of existing || []) if (r?.list_id) alreadyIn.add(r.list_id)
  }

  return lists.map((l) => ({
    ...l,
    isShared: sharedIdSet.has(l.id),
    disabled: alreadyIn.has(l.id),
  }))
}
