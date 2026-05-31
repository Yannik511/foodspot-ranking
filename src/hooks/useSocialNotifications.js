import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'

export function useSocialNotifications() {
  const { user } = useAuth()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!user) return

    const checkUnread = async () => {
      try {
        const lastViewed = localStorage.getItem('social_tab_last_viewed')
        const lastViewedTime = lastViewed ? new Date(lastViewed).getTime() : 0

        const [incomingRequests, acceptedRequests, listInvitations] = await Promise.all([
          supabase.from('friendships').select('id').eq('addressee_id', user.id).eq('status', 'pending').limit(1),
          supabase.from('friendships').select('id, created_at').eq('requester_id', user.id).eq('status', 'accepted').gt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(1),
          supabase.from('list_invitations').select('id, created_at').eq('invitee_id', user.id).eq('status', 'pending').limit(1)
        ])

        const hasIncoming = (incomingRequests.data?.length || 0) > 0
        const hasAccepted = (acceptedRequests.data?.length || 0) > 0 &&
          acceptedRequests.data.some(r => new Date(r.created_at).getTime() > lastViewedTime)
        const hasListInvitations = (listInvitations.data?.length || 0) > 0

        setHasUnread(hasIncoming || hasAccepted || hasListInvitations)
      } catch (error) {
        if (error.code !== 'PGRST200' && !error.message?.includes('does not exist')) {
          console.error('Error checking notifications:', error)
        }
      }
    }

    checkUnread()

    const channel = supabase
      .channel('social_notifications_hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${user.id}` }, () => checkUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships', filter: `requester_id=eq.${user.id}` }, () => checkUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_invitations', filter: `invitee_id=eq.${user.id}` }, () => checkUnread())
      .subscribe((status) => {
        // Re-check after reconnect so we don't miss events that arrived while disconnected
        if (status === 'SUBSCRIBED') checkUnread()
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return hasUnread
}
