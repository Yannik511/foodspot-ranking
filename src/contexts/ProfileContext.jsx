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
  // Laufende Anfragen, damit gleichzeitig gerenderte Avatare denselben Nutzer
  // nicht mehrfach anfordern.
  const inFlightRef = useRef(new Set())

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

    // Schon angefragte IDs nicht noch einmal holen: auf einem Screen haengen
    // mehrere Avatare am selben Nutzer und rufen alle gleichzeitig hier an.
    const missing = uniqueIds.filter(
      id => !profilesRef.current[id] && !inFlightRef.current.has(id)
    )
    if (missing.length === 0) return
    missing.forEach(id => inFlightRef.current.add(id))

    let fetched = []
    let needsFallback = false

    try {
      // Batch-RPC statt direkter Tabellenabfrage. Die Tabelle user_profiles hat
      // weder user_id noch profile_visibility — letztere hat Migration 045
      // wieder entfernt, die Sichtbarkeit liegt seither in
      // auth.users.raw_user_meta_data. Die alte Abfrage lief deshalb IMMER in
      // einen 400er (Postgres 42703) und fiel danach auf einen einzelnen
      // get_user_profile-Aufruf pro Nutzer zurueck. Bei fuenf Gruppen-
      // mitgliedern also ein Fehlschlag plus fuenf Roundtrips statt einem.
      // Gleiches Muster wie in FriendsTab, siehe Migration 047.
      const { data, error } = await supabase.rpc('get_user_profiles_batch', {
        p_user_ids: missing
      })

      if (!error && Array.isArray(data)) {
        fetched = data
        needsFallback = data.length < missing.length
      } else {
        // Solange Migration 047 irgendwo noch nicht ausgefuehrt ist.
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
    } finally {
      missing.forEach(id => inFlightRef.current.delete(id))
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

