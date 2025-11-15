import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import FriendsTab from '../components/social/FriendsTab'
import { supabase } from '../services/supabase'

function Social() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)

  // Check for unread notifications
  useEffect(() => {
    if (!user) return

    const checkUnreadNotifications = async () => {
      try {
        // Check for pending friendship requests (incoming)
        const { data: incomingRequests } = await supabase
          .from('friendships')
          .select('id')
          .eq('addressee_id', user.id)
          .eq('status', 'pending')
          .limit(1)

        // Check for accepted friendship requests (where user was requester)
        const { data: acceptedRequests } = await supabase
          .from('friendships')
          .select('id, created_at')
          .eq('requester_id', user.id)
          .eq('status', 'accepted')
          .gt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
          .limit(1)

        // Check if user has viewed the social tab (localStorage)
        const lastViewed = localStorage.getItem('social_tab_last_viewed')
        const lastViewedTime = lastViewed ? new Date(lastViewed).getTime() : 0

        const hasIncoming = (incomingRequests?.length || 0) > 0
        const hasAccepted = (acceptedRequests?.length || 0) > 0 && 
          acceptedRequests.some(r => new Date(r.created_at).getTime() > lastViewedTime)

        setHasUnreadNotifications(hasIncoming || hasAccepted)
      } catch (error) {
        console.error('Error checking unread notifications:', error)
      }
    }

    checkUnreadNotifications()

    // Subscribe to realtime updates
    const friendshipsChannel = supabase
      .channel('social_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${user.id}`
      }, () => {
        checkUnreadNotifications()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${user.id}`
      }, () => {
        checkUnreadNotifications()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_invitations',
        filter: `invitee_id=eq.${user.id}`
      }, (payload) => {
        console.log('[Social] Realtime: list_invitations changed:', payload.eventType)
        checkUnreadNotifications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(friendshipsChannel)
    }
  }, [user])

  // Mark as read when tab is opened
  useEffect(() => {
    if (user) {
      localStorage.setItem('social_tab_last_viewed', new Date().toISOString())
      setHasUnreadNotifications(false)
    }
  }, [user])

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <header className={`header-safe border-b sticky top-0 z-20 ${
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className={`text-lg font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Social {hasUnreadNotifications && (
              <span className="inline-flex items-center justify-center ml-2 align-middle">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              </span>
            )}
          </h1>

          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className={`flex-1 overflow-y-auto ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <FriendsTab />
      </main>
    </div>
  )
}

export default Social


