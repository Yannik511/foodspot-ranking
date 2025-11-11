import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'

const ProfileContext = createContext(null)

const normalizeProfile = (profile) => {
  if (!profile) return null
  const id = profile.id || profile.user_id
  if (!id) return null

  return {
    id,
    user_id: profile.user_id || profile.id,
    username: profile.username || '',
    avatar_url: profile.profile_image_url || profile.avatar_url || null,
    profile_image_url: profile.profile_image_url || profile.avatar_url || null,
    profile_visibility: profile.profile_visibility || 'private',
    updated_at: profile.updated_at || null
  }
}

export const ProfileProvider = ({ children }) => {
  const [profiles, setProfiles] = useState({})
  const profilesRef = useRef(profiles)

  useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])

  const upsertProfiles = useCallback((input) => {
    const list = Array.isArray(input) ? input : [input]
    setProfiles(prev => {
      const next = { ...prev }
      list.forEach(item => {
        const normalized = normalizeProfile(item)
        if (normalized?.id) {
          next[normalized.id] = {
            ...next[normalized.id],
            ...normalized
          }
        }
      })
      return next
    })
  }, [])

  const removeProfile = useCallback((profileId) => {
    if (!profileId) return
    setProfiles(prev => {
      if (!prev[profileId]) return prev
      const next = { ...prev }
      delete next[profileId]
      return next
    })
  }, [])

  const ensureProfiles = useCallback(async (ids = []) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return

    const missing = uniqueIds.filter(id => !profilesRef.current[id])
    if (missing.length === 0) return

    let fetched = []
    let needsFallback = false

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, user_id, username, profile_image_url, profile_visibility, updated_at')
      .in('id', missing)

    if (!error && data) {
      fetched = data
      needsFallback = data.length < missing.length
    } else {
      needsFallback = true
    }

    if (needsFallback) {
      const fallbackIds = missing.filter(id => !fetched.some(profile => (profile.id || profile.user_id) === id))

      if (fallbackIds.length > 0) {
        const fallbackResults = await Promise.all(fallbackIds.map(async (id) => {
          try {
            const { data: profileData } = await supabase.rpc('get_user_profile', { user_id: id })
            if (Array.isArray(profileData) && profileData.length > 0) return profileData[0]
            if (profileData) return profileData
          } catch (rpcError) {
            console.warn('[ProfileContext] get_user_profile RPC failed', rpcError)
          }
          return null
        }))

        fetched = [
          ...fetched,
          ...fallbackResults.filter(Boolean)
        ]
      }
    }

    if (fetched.length > 0) {
      upsertProfiles(fetched)
    }
  }, [upsertProfiles])

  useEffect(() => {
    const channel = supabase
      .channel('profile_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_profiles'
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old?.id || payload.old?.user_id
          if (id) removeProfile(id)
        } else if (payload.new) {
          upsertProfiles(payload.new)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [upsertProfiles, removeProfile])

  const getProfile = useCallback((id) => {
    if (!id) return null
    return profilesRef.current[id] || null
  }, [])

  const value = {
    profiles,
    upsertProfiles,
    ensureProfiles,
    getProfile
  }

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfilesStore = () => {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfilesStore must be used within ProfileProvider')
  }
  return context
}

