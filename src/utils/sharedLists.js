/**
 * Shared Lists Utilities
 * Zentrale Helper-Funktionen für geteilte Listen
 */

import { supabase } from '../services/supabase'

/**
 * Lädt alle Mitglieder einer geteilten Liste (Owner + akzeptierte Members)
 * @param {string} listId - Die ID der Liste
 * @param {string} ownerId - Die User-ID des Owners
 * @returns {Promise<{members: Array, totalCount: number}>}
 */
export async function getSharedListMembers(listId, ownerId) {
  try {
    // 1. Owner-Profile laden
    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('id, username, profile_image_url')
      .eq('id', ownerId)
      .single()

    // 2. Alle akzeptierten Members laden (ohne Owner)
    const { data: membersData } = await supabase
      .from('list_members')
      .select('user_id, role, joined_at')
      .eq('list_id', listId)
      .neq('user_id', ownerId)

    // 3. Profile für alle Members laden
    let memberProfiles = []
    if (membersData && membersData.length > 0) {
      const memberIds = membersData.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, profile_image_url')
        .in('id', memberIds)
      
      // Merge profiles mit roles
      memberProfiles = membersData.map(m => {
        const profile = profiles?.find(p => p.id === m.user_id)
        return {
          id: m.user_id,
          username: profile?.username || m.user_id.substring(0, 8),
          display_name: profile?.username || m.user_id.substring(0, 8),
          avatar_url: profile?.profile_image_url,
          role: m.role,
          joined_at: m.joined_at
        }
      })
    }

    // 4. Owner als erstes Element hinzufügen
    const allMembers = []
    if (ownerProfile) {
      allMembers.push({
        id: ownerProfile.id,
        username: ownerProfile.username || ownerId.substring(0, 8),
        display_name: ownerProfile.username || ownerId.substring(0, 8),
        avatar_url: ownerProfile.profile_image_url,
        role: 'owner'
      })
    }

    // 5. Members hinzufügen
    allMembers.push(...memberProfiles)

    return {
      members: allMembers,
      totalCount: allMembers.length
    }
  } catch (error) {
    console.error('[getSharedListMembers] Error:', error)
    return {
      members: [],
      totalCount: 0
    }
  }
}

/**
 * Abonniert Änderungen an Listen-Mitgliedern für Realtime-Updates
 * @param {string} listId - Die ID der Liste
 * @param {Function} callback - Callback-Funktion bei Änderungen
 * @returns {Object} Channel-Objekt für Cleanup
 */
export function subscribeSharedListMembers(listId, callback) {
  const channel = supabase
    .channel(`list_members_${listId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'list_members',
      filter: `list_id=eq.${listId}`
    }, () => {
      console.log('[subscribeSharedListMembers] Members changed for list:', listId)
      callback()
    })
    .subscribe()

  return channel
}

/**
 * Entfernt Realtime-Subscription
 * @param {Object} channel - Das Channel-Objekt
 */
export function unsubscribeSharedListMembers(channel) {
  if (channel) {
    supabase.removeChannel(channel)
  }
}



