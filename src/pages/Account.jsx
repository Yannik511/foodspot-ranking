import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'
import { useProfilesStore } from '../contexts/ProfileContext'

// Category emojis for display
const CATEGORY_EMOJIS = {
  'Döner': '🥙',
  'Burger': '🍔',
  'Pizza': '🍕',
  'Asiatisch': '🍜',
  'Bratwurst': '🥓',
  'Glühwein': '🍷',
  'Sushi': '🍣',
  'Steak': '🥩',
  'Fast Food': '🍔',
  'Streetfood': '🌯',
  'Deutsche Küche': '🥨',
  'Bier': '🍺'
}

// Helper function to compress image
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 512
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (blob.size > 200 * 1024) {
              canvas.toBlob(
                (compressedBlob) => {
                  resolve(new File([compressedBlob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  }))
                },
                'image/jpeg',
                0.7
              )
            } else {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              }))
            }
          },
          'image/jpeg',
          0.8
        )
      }
    }
  })
}

function Account() {
  const { user, signOut } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Profile stats
  const createEmptyStats = () => ({
    totalSpots: 0,
    totalCities: 0,
    totalPlaces: 0,
    averageScore: 0,
    tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
    categoryCounts: {},
    topCities: [],
    topSpots: [],
    recentSpots: []
  })

  const [statsByContext, setStatsByContext] = useState({
    private: createEmptyStats(),
    shared: createEmptyStats(),
    overall: createEmptyStats()
  })
  const [activeContext, setActiveContext] = useState('overall')
  const [listSummary, setListSummary] = useState({
    total: 0,
    private: 0,
    shared: 0
  })
  const [contextListIds, setContextListIds] = useState({
    private: [],
    shared: [],
    overall: []
  })
  const { getProfile, upsertProfiles } = useProfilesStore()
  
  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  }

  const getMemberSince = () => {
    if (!user?.created_at) return ''
    const date = new Date(user.created_at)
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const getProfileVisibility = () => {
    return user?.user_metadata?.profile_visibility || 'private'
  }
  
  const isProfileVisibleToFriends = () => {
    return getProfileVisibility() === 'friends'
  }

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('profile-animations')) return

    const styleElement = document.createElement('style')
    styleElement.id = 'profile-animations'
    styleElement.innerHTML = `
      @keyframes profileFadeInUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `
    document.head.appendChild(styleElement)
  }, [])

  const computeStats = (lists = [], spots = [], options = {}) => {
    const {
      dedupeByName = false,
      participantMap = new Map(),
      ownerMap = new Map()
    } = options

    const listMap = new Map((lists || []).map(list => [list.id, list]))
    const processedSpots = []
    const placeSet = new Set()

    if (dedupeByName) {
      const accumulator = new Map()

      spots?.forEach((spot) => {
        if (!spot) return

        const key = spot.normalized_name?.trim() || spot.name?.trim().toLowerCase() || spot.id
        const timestamp = new Date(spot.updated_at || spot.created_at || new Date()).getTime()
        const participants = new Set(participantMap.get(spot.list_id) || [])
        if (spot.user_id) participants.add(spot.user_id)
        const ownerId = ownerMap.get(spot.list_id)
        const ownerIds = new Set()
        if (ownerId) {
          participants.add(ownerId)
          ownerIds.add(ownerId)
        }

        if (!accumulator.has(key)) {
          accumulator.set(key, {
            baseSpot: spot,
            ratingSum: 0,
            ratingCount: 0,
            participants,
            ownerIds,
            categories: new Set(spot.category ? [spot.category] : []),
            listIds: new Set([spot.list_id]),
            addresses: new Set(spot.address ? [spot.address] : []),
            latestTimestamp: timestamp,
            primaryListId: spot.list_id
          })
        } else {
          const entry = accumulator.get(key)
          spot.category && entry.categories.add(spot.category)
          entry.listIds.add(spot.list_id)
          if (spot.address) entry.addresses.add(spot.address)
          participants.forEach(id => entry.participants.add(id))
          ownerIds.forEach(id => entry.ownerIds.add(id))
          if (timestamp > entry.latestTimestamp) {
            entry.latestTimestamp = timestamp
            entry.baseSpot = spot
            entry.primaryListId = spot.list_id
          }
        }

        const ratingValue = spot.avg_score ?? spot.rating
        if (ratingValue != null && !Number.isNaN(ratingValue)) {
          const entry = accumulator.get(key)
          entry.ratingSum += ratingValue
          entry.ratingCount += 1
        }
      })

      accumulator.forEach((entry) => {
        const averageScore = entry.ratingCount > 0
          ? entry.ratingSum / entry.ratingCount
          : entry.baseSpot.avg_score ?? entry.baseSpot.rating ?? null

        const representativeListId = entry.primaryListId || entry.baseSpot.list_id
        const addresses = Array.from(entry.addresses)

        processedSpots.push({
          ...entry.baseSpot,
          list_id: representativeListId,
          avg_score: averageScore,
          rating: averageScore,
          participants: Array.from(entry.participants),
          ownerIds: Array.from(entry.ownerIds),
          category: entry.baseSpot.category || Array.from(entry.categories)[0] || null,
          updated_at: new Date(entry.latestTimestamp).toISOString(),
          allAddresses: addresses,
          address: entry.baseSpot.address || addresses[0] || null,
          listIds: Array.from(entry.listIds)
        })
      })
    } else {
      spots?.forEach((spot) => {
        if (!spot) return

        const participants = new Set(participantMap.get(spot.list_id) || [])
        if (spot.user_id) participants.add(spot.user_id)
        const ownerId = ownerMap.get(spot.list_id)
        const ownerIds = []
        if (ownerId) {
          participants.add(ownerId)
          ownerIds.push(ownerId)
        }

        processedSpots.push({
          ...spot,
          participants: Array.from(participants),
          ownerIds,
          allAddresses: spot.address ? [spot.address] : []
        })
      })
    }

        const categoryCounts = {}
    const tierDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0 }
    const ratingValues = []
    const cityCounts = {}
    const uniqueCities = new Set()

    processedSpots.forEach((spot) => {
      const list = listMap.get(spot.list_id)
      const city = list?.city || spot.city
      if (city) {
        uniqueCities.add(city.trim())
        cityCounts[city] = (cityCounts[city] || 0) + 1
      }

      const addresses = spot.allAddresses?.length ? spot.allAddresses : (spot.address ? [spot.address] : [])
      addresses.forEach(address => {
        if (address) {
          placeSet.add(address.trim().toLowerCase())
        }
      })

          if (spot.category) {
            categoryCounts[spot.category] = (categoryCounts[spot.category] || 0) + 1
          }

      if (spot.tier && tierDistribution[spot.tier] !== undefined) {
        tierDistribution[spot.tier]++
      }

      const ratingValue = spot.avg_score ?? spot.rating
      if (ratingValue != null && !Number.isNaN(ratingValue)) {
        ratingValues.push(ratingValue)
      }
    })

    const totalSpots = processedSpots.length
    const totalCities = uniqueCities.size
    const totalPlaces = placeSet.size
    const averageScore = ratingValues.length > 0
      ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
      : null

        const topCities = Object.entries(cityCounts)
          .map(([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)

    const topSpots = processedSpots
      .map((spot) => {
        const list = listMap.get(spot.list_id)
        const score = spot.avg_score ?? spot.rating ?? null
        return {
          ...spot,
          avgScore: score,
          city: list?.city || spot.city || ''
        }
      })
      .filter(spot => spot.avgScore != null && !Number.isNaN(spot.avgScore))
      .sort((a, b) => b.avgScore - a.avgScore)
          .slice(0, 10)
          .map((spot, index) => ({
            ...spot,
        rank: index + 1
          }))

    const recentSpots = [...processedSpots]
          .sort((a, b) => {
        const aDate = new Date(a.updated_at || a.created_at || new Date(0))
        const bDate = new Date(b.updated_at || b.created_at || new Date(0))
            return bDate - aDate
          })
          .slice(0, 5)
      .map((spot) => {
        const list = listMap.get(spot.list_id)
        return {
            ...spot,
          city: list?.city || spot.city || ''
        }
      })

    return {
          totalSpots,
          totalCities,
      totalPlaces,
          averageScore,
          tierDistribution,
          categoryCounts,
          topCities,
          topSpots,
          recentSpots
    }
  }

  // Fetch profile statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      setLoading(true)
      try {
        const { data: privateLists, error: privateListsError } = await supabase
          .from('lists')
          .select('id, city, category, user_id')
          .eq('user_id', user.id)

        if (privateListsError) throw privateListsError

        const privateListIds = privateLists?.map(list => list.id) || []

        let privateSpots = []
        if (privateListIds.length > 0) {
          const { data: privateSpotsData, error: privateSpotsError } = await supabase
            .from('foodspots')
            .select('id, name, rating, avg_score, tier, category, address, cover_photo_url, list_id, created_at, updated_at, normalized_name, user_id')
            .in('list_id', privateListIds)

          if (privateSpotsError) throw privateSpotsError
          privateSpots = privateSpotsData || []
        }
        const { data: membershipRows, error: membershipError } = await supabase
          .from('list_members')
          .select('list_id')
          .eq('user_id', user.id)

        if (membershipError && membershipError.code !== 'PGRST116') {
          throw membershipError
        }

        const memberListIds = membershipRows?.map(row => row.list_id) || []

        const sharedOwnedChecks = await Promise.all(
          privateListIds.map(async (listId) => {
            const { data, error } = await supabase.rpc('is_shared_list', { p_list_id: listId })
            if (error) {
              console.warn('is_shared_list error:', error)
              return null
            }
            return data ? listId : null
          })
        )

        const sharedOwnedIds = sharedOwnedChecks.filter(Boolean)
        const sharedListIdSet = new Set([...memberListIds, ...sharedOwnedIds])
        const sharedListIds = Array.from(sharedListIdSet)

        const purePrivateListIds = privateListIds.filter(id => !sharedListIdSet.has(id))
        const privateListsPure = (privateLists || []).filter(list => purePrivateListIds.includes(list.id))
        const privateSpotsPure = (privateSpots || []).filter(spot => purePrivateListIds.includes(spot.list_id))

        let sharedLists = []
        if (sharedListIds.length > 0) {
          const { data: sharedListsData, error: sharedListsError } = await supabase
            .from('lists')
            .select('id, city, category, user_id')
            .in('id', sharedListIds)

          if (sharedListsError) throw sharedListsError
          sharedLists = sharedListsData || []
        }

        let sharedSpots = []
        if (sharedListIds.length > 0) {
          const { data: sharedSpotsData, error: sharedSpotsError } = await supabase
            .from('foodspots')
            .select('id, name, rating, avg_score, tier, category, address, cover_photo_url, list_id, created_at, updated_at, user_id, normalized_name')
            .in('list_id', sharedListIds)

          if (sharedSpotsError) throw sharedSpotsError
          sharedSpots = sharedSpotsData || []
        }

        const participantMap = new Map()
        const ownerMap = new Map()

        const ensureParticipant = (listId, userId) => {
          if (!listId || !userId) return
          const existing = participantMap.get(listId) || new Set()
          existing.add(userId)
          participantMap.set(listId, existing)
        }

        privateLists?.forEach((list) => {
          if (!list) return
          ownerMap.set(list.id, list.user_id)
          ensureParticipant(list.id, list.user_id)
        })

        sharedLists?.forEach((list) => {
          if (!list) return
          ownerMap.set(list.id, list.user_id)
          ensureParticipant(list.id, list.user_id)
        })

        if (sharedListIds.length > 0) {
          const { data: sharedMembersData, error: sharedMembersError } = await supabase
            .from('list_members')
            .select('list_id, user_id')
            .in('list_id', sharedListIds)

          if (sharedMembersError && sharedMembersError.code !== 'PGRST116') {
            console.warn('Error fetching shared members for profile stats:', sharedMembersError)
          } else {
            sharedMembersData?.forEach(member => ensureParticipant(member.list_id, member.user_id))
          }
        }

        privateSpots?.forEach(spot => ensureParticipant(spot.list_id, spot.user_id))
        sharedSpots?.forEach(spot => ensureParticipant(spot.list_id, spot.user_id))

        if (sharedListIds.length > 0) {
          const { data: ratingsData, error: ratingsError } = await supabase
            .from('foodspot_ratings')
            .select('list_id, user_id')
            .in('list_id', sharedListIds)

          if (ratingsError && ratingsError.code !== 'PGRST116') {
            console.warn('Error fetching shared ratings for profile stats:', ratingsError)
          } else {
            ratingsData?.forEach(rating => ensureParticipant(rating.list_id, rating.user_id))
          }
        }

        const participantIds = new Set()
        participantMap.forEach(set => {
          set.forEach(id => participantIds.add(id))
        })

        if (participantIds.size > 0) {
          const ids = Array.from(participantIds)
          let profileLookup = {}

          const { data: profileRows, error: profilesError } = await supabase
            .from('user_profiles')
            .select('user_id, username, profile_image_url, profile_visibility')
            .in('user_id', ids)

          if (!profilesError) {
            profileRows?.forEach(profile => {
              if (profile?.user_id) {
                profileLookup[profile.user_id] = {
                  id: profile.user_id,
                  username: profile.username,
                  avatar_url: profile.profile_image_url,
                  profile_image_url: profile.profile_image_url,
                  profile_visibility: profile.profile_visibility || 'private'
                }
              }
            })
          } else {
            console.warn('user_profiles fallback (Account):', profilesError)
            const fallbackProfiles = await Promise.all(ids.map(async (id) => {
              try {
                const { data, error } = await supabase.rpc('get_user_profile', { user_id: id })
                if (error || !data) return null
                const profile = Array.isArray(data) ? data[0] : data
                if (!profile) return null
                return {
                  id: profile.id || id,
                  username: profile.username,
                  avatar_url: profile.profile_image_url,
                  profile_image_url: profile.profile_image_url,
                  profile_visibility: profile.profile_visibility || 'private'
                }
              } catch (rpcError) {
                console.warn('get_user_profile RPC error:', rpcError)
                return null
              }
            }))

            fallbackProfiles
              .filter(Boolean)
              .forEach(profile => {
                profileLookup[profile.id || profile.user_id] = profile
              })
          }

          upsertProfiles(Object.values(profileLookup))
        }

        const privateStats = computeStats(privateListsPure || [], privateSpotsPure, { participantMap, ownerMap })
        const sharedStats = computeStats(sharedLists || [], sharedSpots, { participantMap, ownerMap })

        const overallListMap = new Map()
        privateListsPure?.forEach(list => {
          if (list) {
            overallListMap.set(list.id, list)
          }
        })
        sharedLists?.forEach(list => {
          if (list && !overallListMap.has(list.id)) {
            overallListMap.set(list.id, list)
          }
        })

        const overallListIds = Array.from(overallListMap.keys())
        const overallLists = Array.from(overallListMap.values())

        const spotMap = new Map()
        privateSpotsPure?.forEach(spot => {
          if (spot) {
            spotMap.set(spot.id, spot)
          }
        })
        sharedSpots?.forEach(spot => {
          if (spot && !spotMap.has(spot.id)) {
            spotMap.set(spot.id, spot)
          }
        })

        const overallSpots = Array.from(spotMap.values())
        const overallStats = computeStats(overallLists, overallSpots, {
          participantMap,
          ownerMap,
          dedupeByName: true
        })

        setStatsByContext({
          private: privateStats,
          shared: sharedStats,
          overall: overallStats
        })

        setListSummary({
          private: purePrivateListIds.length,
          shared: sharedListIds.length,
          total: new Set([...purePrivateListIds, ...sharedListIds]).size
        })

        setContextListIds({
          private: purePrivateListIds,
          shared: sharedListIds,
          overall: overallListIds
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    const channel = supabase
      .channel('account_stats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspots'
      }, () => fetchStats())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lists'
      }, () => fetchStats())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_members',
        filter: `user_id=eq.${user?.id}`
      }, () => fetchStats())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Bitte wähle ein Bild aus', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Bild muss kleiner als 5MB sein', 'error')
      return
    }

    setUploading(true)

    try {
      const compressedFile = await compressImage(file)
      const fileExt = 'jpg'
      const fileName = `${user.id}/avatar.${fileExt}`

      const oldAvatarPath = `${user.id}/avatar.${fileExt}`
      await supabase.storage.from('profile-avatars').remove([oldAvatarPath])

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('Der Storage-Bucket "profile-avatars" wurde nicht gefunden.')
        }
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`)
      }

      const { data: urlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName)
      
      const imageUrl = urlData?.publicUrl

      if (!imageUrl) {
        throw new Error('Konnte URL für das hochgeladene Bild nicht abrufen')
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          profileImageUrl: imageUrl
        }
      })

      if (updateError) throw updateError

      showToast('Profilbild erfolgreich aktualisiert!', 'success')
      
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      showToast('Fehler beim Hochladen. Bitte versuche es erneut.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const stats = statsByContext[activeContext] || createEmptyStats()
  const sharedListIdSet = useMemo(() => new Set(contextListIds.shared || []), [contextListIds.shared])

  const formatNumber = (value, decimals = 0) => {
    if (value == null) return '–'
    const numericValue = Number(value)
    if (Number.isNaN(numericValue)) return '–'
    return numericValue.toLocaleString('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  const kpiCards = useMemo(() => {
    if (activeContext === 'overall') {
      return [
        {
          key: 'overall-spots',
          label: 'Overall Foodspots',
          value: formatNumber(stats.totalSpots)
        },
        {
          key: 'overall-cities',
          label: 'Overall Städte',
          value: formatNumber(stats.totalCities)
        },
        {
          key: 'overall-lists',
          label: 'Overall Listen',
          value: formatNumber(listSummary.total)
        },
        {
          key: 'overall-score',
          label: 'Overall Score',
          value: formatNumber(stats.averageScore, 1),
          suffix: formatNumber(stats.averageScore, 1) === '–' ? '' : '/10',
          icon: '🔥',
          accent: true
        }
      ]
    }

    if (activeContext === 'shared') {
      return [
        {
          key: 'shared-spots',
          label: 'Gesamte Spots (geteilt)',
          value: formatNumber(stats.totalSpots)
        },
        {
          key: 'shared-cities',
          label: 'Städte (geteilt)',
          value: formatNumber(stats.totalCities)
        },
        {
          key: 'shared-lists',
          label: 'Anzahl Listen (geteilt)',
          value: formatNumber(listSummary.shared)
        },
        {
          key: 'shared-score',
          label: 'Ø-Score (geteilt)',
          value: formatNumber(stats.averageScore, 1),
          suffix: formatNumber(stats.averageScore, 1) === '–' ? '' : '/10',
          icon: '🔥',
          accent: true
        }
      ]
    }

    return [
      {
        key: 'private-spots',
        label: 'Gesamte Spots (privat)',
        value: formatNumber(stats.totalSpots)
      },
      {
        key: 'private-cities',
        label: 'Städte (privat)',
        value: formatNumber(stats.totalCities)
      },
      {
        key: 'private-lists',
        label: 'Anzahl Listen (privat)',
        value: formatNumber(listSummary.private)
      },
      {
        key: 'private-score',
        label: 'Ø-Score (privat)',
        value: formatNumber(stats.averageScore, 1),
        suffix: formatNumber(stats.averageScore, 1) === '–' ? '' : '/10',
        icon: '🔥',
        accent: true
      }
    ]
  }, [activeContext, stats, listSummary])

  const kpiGridClass = 'grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4'

  const topSpotsTitle = '🏆 Top 10'

  const renderParticipantAvatars = (userIds = [], ownerIds = [], maxVisible = 4) => {
    const filteredIds = (userIds || []).filter(Boolean)
    if (!filteredIds.length) return null

    const uniqueUserIds = Array.from(new Set(filteredIds))
    const ownersSet = new Set((ownerIds || []).filter(Boolean))

    const sorted = uniqueUserIds.sort((a, b) => {
      const aIsOwner = ownersSet.has(a)
      const bIsOwner = ownersSet.has(b)
      if (aIsOwner && !bIsOwner) return -1
      if (!aIsOwner && bIsOwner) return 1
      const nameA = getProfile(a)?.username?.toLowerCase() || ''
      const nameB = getProfile(b)?.username?.toLowerCase() || ''
      return nameA.localeCompare(nameB)
    })

    const visible = sorted.slice(0, maxVisible)
    const extra = sorted.length - visible.length

  return (
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {visible.map((id, index) => {
            const profile = getProfile(id)
            const initials = profile?.username?.charAt(0)?.toUpperCase() || '🍽️'
            const isOwner = ownersSet.has(id)
            const ringClasses = isOwner
              ? `ring-2 ring-[#FF7E42] ${isDark ? 'ring-offset-2 ring-offset-gray-800' : 'ring-offset-2 ring-offset-white'}`
              : ''
            const shouldShowImage = profile?.avatar_url && profile?.profile_visibility !== 'private'
            const avatarUrl = shouldShowImage ? profile.avatar_url : null

            return (
              <div
                key={`${id}-${index}`}
                className={`w-7 h-7 rounded-full border-2 ${
                  isDark ? 'border-gray-900 bg-gray-700' : 'border-white bg-gray-200'
                } overflow-hidden flex items-center justify-center text-xs font-semibold ${ringClasses}`}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.username || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className={`text-xs font-semibold ${
                    isDark ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    {initials}
                  </span>
                )}
              </div>
            )
          })}
          {extra > 0 && (
            <div
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                isDark ? 'border-gray-900 bg-gray-700 text-gray-300' : 'border-white bg-gray-200 text-gray-600'
              }`}
            >
              +{extra}
            </div>
          )}
        </div>
      </div>
    )
  }

  const handleSpotClick = (spot) => {
    if (!spot?.list_id) return
    const isSharedList = sharedListIdSet.has(spot.list_id)
    navigate(isSharedList ? `/shared/tierlist/${spot.list_id}` : `/tierlist/${spot.list_id}`)
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt Profil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-20 ${
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-4 py-3">
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
            Profil
          </h1>

          <button
            onClick={() => navigate('/settings')}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            aria-label="Einstellungen"
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Hero Section */}
          <div className={`rounded-[24px] shadow-lg border p-8 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="relative">
                    <Avatar size={100} showBorder={true} />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
              </div>
                    )}
              <input
                      id="avatar-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={uploading}
              />
                  </div>
                </label>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className={`text-2xl font-bold mb-1 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {getUsername()}
                </h2>
                <p className={`text-sm mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  @{getUsername().toLowerCase().replace(/\s+/g, '')}
                </p>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Mitglied seit {getMemberSince()}
                </p>
                {isProfileVisibleToFriends() && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">
                      Für Freund:innen sichtbar
                    </span>
                  </div>
                )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                  className={`mt-4 px-4 py-2 rounded-[14px] text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${
                    isDark
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Profil bearbeiten
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center sm:justify-start">
            <div className={`inline-flex p-1 rounded-full ${
              isDark ? 'bg-gray-800' : 'bg-gray-200'
            }`}>
              <button
                onClick={() => setActiveContext('private')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeContext === 'private'
                    ? isDark
                      ? 'bg-gray-900 text-white shadow-lg'
                      : 'bg-white text-gray-900 shadow-lg'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
              >
                Meine Listen
              </button>
              <button
                onClick={() => setActiveContext('shared')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeContext === 'shared'
                    ? isDark
                      ? 'bg-gray-900 text-white shadow-lg'
                      : 'bg-white text-gray-900 shadow-lg'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
              >
                Geteilte Listen
              </button>
              <button
                onClick={() => setActiveContext('overall')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeContext === 'overall'
                    ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-lg'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
              >
                Overall
              </button>
              </div>
            </div>

          <div className={kpiGridClass}>
            {kpiCards.map(card => (
              <div
                key={card.key}
                className={`rounded-[20px] shadow-lg border p-4 relative overflow-hidden ${
                  card.accent
                    ? `${isDark ? 'bg-gray-800 border-[#FF9E5A]/60' : 'bg-white border-[#FF7E42]/40'}`
                    : isDark
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-100'
                }`}
              >
                <div className={`text-2xl font-bold mb-1 ${
                  card.accent
                    ? 'text-[#FF7E42]'
                    : isDark
                      ? 'text-white'
                      : 'text-gray-900'
                }`}>
                  {card.value}
                  {card.suffix}
                </div>
                <div className={`text-xs flex items-center gap-1 ${
                  card.accent
                    ? 'text-[#FF9E5A]'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}>
                  {card.icon && <span>{card.icon}</span>}
                  <span>{card.label}</span>
                </div>
              </div>
            ))}
          </div>

            <div className={`rounded-[20px] shadow-lg border p-4 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center gap-1 mb-1">
                {['S', 'A', 'B', 'C', 'D'].map((tier) => (
                  <div key={tier} className="flex-1 flex flex-col items-center">
                    <div className={`text-xs font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {stats.tierDistribution[tier]}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 mt-1 overflow-hidden">
                      <div 
                        className={`h-full ${
                          tier === 'S' ? 'bg-red-500' :
                          tier === 'A' ? 'bg-orange-500' :
                          tier === 'B' ? 'bg-yellow-500' :
                          tier === 'C' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}
                        style={{
                          width: stats.totalSpots > 0 
                            ? `${(stats.tierDistribution[tier] / stats.totalSpots) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className={`text-xs mt-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Tier-Verteilung
            </div>
          </div>

          {/* Category Mix */}
          {Object.keys(stats.categoryCounts).length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Kategorie-Mix
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                        isDark
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                      }`}
                    >
                      <span className="text-base">{CATEGORY_EMOJIS[category] || '🍔'}</span>
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {category}
                  </span>
                      <span className={`text-xs font-bold ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top 10 Section */}
          {stats.topSpots.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                {topSpotsTitle}
              </h3>
              <div className="space-y-3">
                {stats.topSpots.map((spot, index) => (
                  <button
                    key={`${spot.id}-${index}`}
                    onClick={() => handleSpotClick(spot)}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all active:scale-[0.98] ${
                      isDark
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-50'
                    }`}
                    style={{
                      animation: `profileFadeInUp 0.35s ease-in-out forwards`,
                      animationDelay: `${index * 40}ms`
                    }}
                  >
                    {/* Ranking Badge */}
                    <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm ${
                      spot.rank <= 3
                        ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] text-white'
                        : isDark
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                    }`}>
                      {spot.rank}
                    </div>

                    {/* Cover Photo */}
                    {spot.cover_photo_url ? (
                      <img
                        src={spot.cover_photo_url}
                        alt={spot.name}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex-shrink-0 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    )}

                    {/* Text Content - Priority: Always visible */}
                    <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                      <div className={`font-semibold text-sm truncate leading-tight ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.name}
                      </div>
                      <div className={`text-xs truncate leading-tight mt-0.5 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {spot.city}
                      </div>
                      {spot.category && (
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight ${
                            isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {spot.category}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right side: Avatars & Rating - beide immer sichtbar, adaptive Größe */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-0">
                      {/* Avatars - adaptive: 1 auf xs, 2 auf sm, 3 auf md+ */}
                      <div className="flex sm:hidden">
                        {renderParticipantAvatars(spot.participants, spot.ownerIds, 1)}
                      </div>
                      <div className="hidden sm:flex md:hidden">
                        {renderParticipantAvatars(spot.participants, spot.ownerIds, 2)}
                      </div>
                      <div className="hidden md:flex">
                        {renderParticipantAvatars(spot.participants, spot.ownerIds, 3)}
                      </div>
                      
                      {/* Rating - Always visible, priority */}
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <span className="text-xs sm:text-sm">⭐</span>
                        <span className={`font-bold text-xs sm:text-sm whitespace-nowrap ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {(() => {
                            const scoreValue = spot.avgScore ?? spot.rating
                            const formatted = formatNumber(scoreValue, 1)
                            return formatted === '–' ? '–' : `${formatted}/10`
                          })()}
                        </span>
                      </div>
                    </div>
              </button>
                ))}
            </div>
          </div>
          )}

          {/* Top Cities */}
          {stats.topCities.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Am meisten getestet in
            </h3>
            <div className="space-y-3">
                {stats.topCities.map((item, index) => (
                  <div
                    key={item.city}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(255, 157, 104, 0.1) 0%, rgba(255, 126, 66, 0.15) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 228, 195, 0.3) 0%, rgba(255, 210, 163, 0.4) 100%)'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] text-white'
                          : isDark
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-200 text-gray-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {item.city}
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {item.count} {item.count === 1 ? 'Spot' : 'Spots'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Spots */}
          {stats.recentSpots.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Zuletzt hinzugefügt
              </h3>
              <div className="space-y-2">
                {stats.recentSpots.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => handleSpotClick(spot)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all active:scale-[0.98] ${
                      isDark
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {spot.cover_photo_url ? (
                      <img
                        src={spot.cover_photo_url}
                        alt={spot.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex-shrink-0 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className={`font-medium text-sm truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.name}
                      </div>
                      <div className={`text-xs truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {spot.city}
                      </div>
                    </div>
                    <div className={`text-xs ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {new Date(spot.updated_at || spot.created_at).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </div>
              </button>
                ))}
            </div>
          </div>
          )}

          {/* Category Mix */}
          {Object.keys(stats.categoryCounts).length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Kategorie-Mix
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                        isDark
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                      }`}
                    >
                      <span className="text-base">{CATEGORY_EMOJIS[category] || '🍔'}</span>
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {category}
                      </span>
                      <span className={`text-xs font-bold ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Badges */}
          {stats.totalSpots > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.totalSpots >= 10 && (
                  <div className={`px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      🏆 {stats.totalSpots}× Spots
                    </span>
                  </div>
                )}
                {stats.totalCities >= 5 && (
                  <div className={`px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      🌍 {stats.totalCities} Städte
                    </span>
                  </div>
                )}
                {stats.averageScore >= 9.0 && (
                  <div className={`px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      ⭐ Ø {'>'} 9,0
                    </span>
                  </div>
                )}
                {Object.entries(stats.categoryCounts).map(([category, count]) => {
                  if (count >= 10) {
                    return (
                      <div key={category} className={`px-3 py-2 rounded-full ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <span className={`text-sm font-medium ${
                          isDark ? 'text-gray-200' : 'text-gray-700'
                        }`}>
                          {CATEGORY_EMOJIS[category] || '🍔'} {count}× {category}
                        </span>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <h3 className={`text-lg font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Aktionen
            </h3>
            <div className="space-y-3">
          <button
                onClick={() => navigate('/settings')}
                className={`w-full text-left py-3 px-4 rounded-[14px] transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Zu Einstellungen</span>
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
          </button>
              <button
                onClick={() => {
                  showToast('Feature kommt bald!', 'info')
                }}
                className={`w-full text-left py-3 px-4 rounded-[14px] transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Profil teilen</span>
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <button
                onClick={() => {
                  showToast('Feature kommt bald!', 'info')
                }}
                className={`w-full text-left py-3 px-4 rounded-[14px] transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Daten exportieren (CSV)</span>
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          style={{ animation: 'fadeSlideDown 0.3s ease-out' }}
        >
          <div className={`rounded-[16px] px-6 py-4 shadow-xl flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 
            toast.type === 'info' ? 'bg-blue-500 text-white' :
            'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-semibold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* CSS */}
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

export default Account