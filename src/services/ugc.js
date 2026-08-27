import { supabase } from './supabase'

// UGC-Schutz (Apple 1.2): Inhalte/Nutzer melden + Nutzer blockieren.
// Backend-RPCs siehe migrations/068_ugc_reports_blocks.sql.

// Meldet einen Inhalt oder Nutzer. targetType ∈ 'user'|'spot'|'photo'|'list'.
export async function reportContent(targetType, targetId, reason, note = null) {
  return supabase.rpc('report_content', {
    p_target_type: targetType,
    p_target_id: String(targetId),
    p_reason: reason,
    p_note: note,
  })
}

// Blockiert einen Nutzer (löst serverseitig die Freundschaft beidseitig).
export async function blockUser(blockedId) {
  return supabase.rpc('block_user', { p_blocked: blockedId })
}

// Hebt die Blockierung auf.
export async function unblockUser(blockedId) {
  return supabase.rpc('unblock_user', { p_blocked: blockedId })
}

// Liefert die blockierten Nutzer mit Profil-Infos (für die Settings-Liste).
export async function getBlockedUsers() {
  const { data: rows, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .order('created_at', { ascending: false })

  if (error || !rows || rows.length === 0) return []

  const ids = rows.map((r) => r.blocked_id)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, profile_image_url')
    .in('id', ids)

  const byId = new Map((profiles || []).map((p) => [p.id, p]))
  return rows.map((r) => ({
    id: r.blocked_id,
    created_at: r.created_at,
    username: byId.get(r.blocked_id)?.username || 'Unbekannt',
    profile_image_url: byId.get(r.blocked_id)?.profile_image_url || null,
  }))
}
