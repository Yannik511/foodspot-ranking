import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'

const PresenceContext = createContext({})

export const usePresence = () => useContext(PresenceContext)

export const PresenceProvider = ({ children }) => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  useEffect(() => {
    if (!user) {
      setOnlineUsers(new Set())
      return
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUsers(new Set(Object.keys(state)))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [user])

  const isOnline = (userId) => onlineUsers.has(userId)

  return (
    <PresenceContext.Provider value={{ isOnline, onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  )
}
