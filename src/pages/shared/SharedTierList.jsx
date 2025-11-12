import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import {
  uploadSharedSpotPhoto,
  deleteSharedSpotPhoto,
  setSharedSpotCoverPhoto,
  SUPPORTED_IMAGE_TYPES,
  MAX_SPOT_PHOTOS
} from '../../services/sharedPhotos'
import { useProfilesStore } from '../../contexts/ProfileContext'

const TIER_COLORS = {
  S: { 
    color: '#E53935',
    gradient: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)',
    emoji: '🍕'
  },
  A: { 
    color: '#FB8C00',
    gradient: 'linear-gradient(135deg, #FB8C00 0%, #E65100 100%)',
    emoji: '🍔'
  },
  B: { 
    color: '#FDD835',
    gradient: 'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)',
    emoji: '🌮'
  },
  C: { 
    color: '#43A047',
    gradient: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)',
    emoji: '🍣'
  },
  D: { 
    color: '#1E88E5',
    gradient: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
    emoji: '🍜'
  }
}

const TIERS = ['S', 'A', 'B', 'C', 'D']

function SharedTierList() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [list, setList] = useState(null)
  const [foodspots, setFoodspots] = useState([])
  const [spotRatings, setSpotRatings] = useState({})
  const [spotPhotos, setSpotPhotos] = useState({})
  const [loading, setLoading] = useState(true)
  const [showTierModal, setShowTierModal] = useState(null)
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [showSpotDetails, setShowSpotDetails] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [descriptionSaving, setDescriptionSaving] = useState(false)
  const [userRole, setUserRole] = useState('viewer')
  const [toast, setToast] = useState(null)
  const selectedSpotIdRef = useRef(null)
  const fileInputRef = useRef(null)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [photoUploadQueue, setPhotoUploadQueue] = useState([])
  const [photoActionLoading, setPhotoActionLoading] = useState(null)
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  const canEditSpots = userRole === 'owner' || userRole === 'editor'
  const canUploadPhotos = canEditSpots
  const isOwner = userRole === 'owner'
  const spotPhotosRef = useRef({})
  const { ensureProfiles, getProfile } = useProfilesStore()
  const fetchRequestIdRef = useRef(0)
  const refreshTimeoutRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    spotPhotosRef.current = spotPhotos
  }, [spotPhotos])

  useEffect(() => {
    if (selectedSpot?.id) {
      setSelectedPhotoIndex(0)
    }
  }, [selectedSpot?.id])

  useEffect(() => {
    if (!selectedSpot?.id) return
    const photos = spotPhotos[selectedSpot.id] || []
    if (photos.length === 0 && selectedPhotoIndex !== 0) {
      setSelectedPhotoIndex(0)
    } else if (selectedPhotoIndex >= photos.length) {
      setSelectedPhotoIndex(Math.max(photos.length - 1, 0))
    }
  }, [spotPhotos, selectedSpot, selectedPhotoIndex])


  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchProfilesForIds = useCallback(async (ids, retryCount = 0) => {
    if (!ids || ids.length === 0) return {}
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return {}

    try {
      // Add a small delay on first load to prevent race conditions
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      await ensureProfiles(uniqueIds)

      const result = {}
      const missingProfiles = []
      
      uniqueIds.forEach(id => {
        const profile = getProfile(id)
        if (profile) {
          result[id] = profile
        } else {
          missingProfiles.push(id)
        }
      })

      // Retry logic: if some profiles are missing and we haven't exceeded retry limit
      if (missingProfiles.length > 0 && retryCount < 2) {
        // Wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, 1000))
        const retryResult = await fetchProfilesForIds(missingProfiles, retryCount + 1)
        Object.assign(result, retryResult)
      }

      return result
    } catch (error) {
      console.warn('[SharedTierList] Error fetching profiles:', error)
      // Return partial result instead of failing completely
      const result = {}
      uniqueIds.forEach(id => {
        const profile = getProfile(id)
        if (profile) {
          result[id] = profile
        }
      })
      return result
    }
  }, [ensureProfiles, getProfile])

  const fetchTierData = useCallback(async ({ background = false } = {}) => {
    if (!user || !id) return

    const requestId = ++fetchRequestIdRef.current

    if (!background) {
      setLoading(true)
    }

    try {
      const [{ data: listData, error: listError }, { data: membership, error: membershipError }] = await Promise.all([
        supabase
          .from('lists')
          .select('id, list_name, user_id, city, category, cover_image_url, updated_at')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('list_members')
          .select('role')
          .eq('list_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
      ])

      if (fetchRequestIdRef.current !== requestId) return

      if (listError || !listData) {
        console.error('[SharedTierList] Error fetching list:', listError)
        if (!background) {
          navigate('/dashboard')
        }
        return
      }

      setList(listData)

      let role = 'viewer'
      if (listData.user_id === user.id) {
        role = 'owner'
      } else if (membershipError && membershipError.code !== 'PGRST116') {
        throw membershipError
      } else if (membership?.role) {
        role = membership.role
      }

      setUserRole(role)

      const { data: spotsData, error: spotsError } = await supabase
        .from('foodspots')
        .select('id, list_id, user_id, first_uploader_id, name, category, description, address, latitude, longitude, tier, avg_score, rating, ratings_count, cover_photo_url, created_at, updated_at')
        .eq('list_id', id)
        .order('tier', { ascending: true, nullsLast: false })

      if (spotsError) {
        throw spotsError
      }

      const spotIds = (spotsData || []).map(spot => spot.id).filter(Boolean)
      let ratingsMap = {}
      let photosMap = {}
      const userIdSet = new Set(spotsData.map(s => s.first_uploader_id).filter(Boolean))
      if (listData?.user_id) {
        userIdSet.add(listData.user_id)
      }

      if (spotIds.length > 0) {
        const [{ data: ratingsData, error: ratingsError }, { data: photosData, error: photosError }] = await Promise.all([
          supabase
            .from('foodspot_ratings')
            .select('id, foodspot_id, user_id, score, comment, criteria, created_at')
            .in('foodspot_id', spotIds),
          supabase
            .from('spot_photos')
            .select('id, list_id, spot_id, uploader_user_id, public_url, storage_path, width, height, size_bytes, mime_type, created_at')
            .in('spot_id', spotIds)
            .order('created_at', { ascending: true })
        ])

        if (ratingsError && ratingsError.code !== 'PGRST116') {
          throw ratingsError
        }

        if (photosError && photosError.code !== 'PGRST116') {
          throw photosError
        }

        ratingsData?.forEach(rating => {
          if (!ratingsMap[rating.foodspot_id]) {
            ratingsMap[rating.foodspot_id] = []
          }
          ratingsMap[rating.foodspot_id].push(rating)
          if (rating.user_id) {
            userIdSet.add(rating.user_id)
          }
        })

        photosData?.forEach(photo => {
          if (!photosMap[photo.spot_id]) {
            photosMap[photo.spot_id] = []
          }
          photosMap[photo.spot_id].push(photo)
          if (photo.uploader_user_id) {
            userIdSet.add(photo.uploader_user_id)
          }
        })

        Object.keys(ratingsMap).forEach(key => {
          ratingsMap[key].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        })
      }

      if (fetchRequestIdRef.current !== requestId) return

      setSpotRatings(ratingsMap)
      setSpotPhotos(photosMap)

      if (userIdSet.size > 0) {
        await fetchProfilesForIds(Array.from(userIdSet))
      }

      const sortedSpots = (spotsData || []).sort((a, b) => {
        const aTier = a.tier || 'D'
        const bTier = b.tier || 'D'
        if (aTier !== bTier) {
          return TIERS.indexOf(aTier) - TIERS.indexOf(bTier)
        }
        const aRating = a.avg_score || a.rating || 0
        const bRating = b.avg_score || b.rating || 0
        return bRating - aRating
      })

      if (fetchRequestIdRef.current !== requestId) return

      setFoodspots(sortedSpots)

      if (selectedSpotIdRef.current) {
        const updated = sortedSpots.find(s => s.id === selectedSpotIdRef.current)
        if (updated) {
          setSelectedSpot(prev => {
            if (prev && prev.id === updated.id) {
              return { ...prev, ...updated }
            }
            return updated
          })
          setDescriptionDraft(updated.description || '')
        }
      }
    } catch (error) {
      console.error('Error loading shared tier data:', error)
      showToast(error?.message || 'Liste konnte nicht geladen werden', 'error')
    } finally {
      if (fetchRequestIdRef.current === requestId && !background) {
        setLoading(false)
      }
    }
  }, [id, user, navigate, fetchProfilesForIds])

  const scheduleBackgroundRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) return
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null
      fetchTierData({ background: true })
    }, 200)
  }, [fetchTierData])

  useEffect(() => {
    selectedSpotIdRef.current = selectedSpot ? selectedSpot.id : null
  }, [selectedSpot])

  useEffect(() => {
    fetchTierData()

    const channel = supabase
      .channel(`shared_tierlist_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspots',
        filter: `list_id=eq.${id}`
      }, () => {
        scheduleBackgroundRefresh()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspot_ratings',
        filter: `list_id=eq.${id}`
      }, () => {
        scheduleBackgroundRefresh()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'spot_photos',
        filter: `list_id=eq.${id}`
      }, () => {
        scheduleBackgroundRefresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    }
  }, [fetchTierData, id, scheduleBackgroundRefresh])

  const foodspotsByTier = useMemo(() => {
    return TIERS.reduce((acc, tier) => {
      acc[tier] = foodspots.filter(spot => (spot.tier || 'D') === tier)
      return acc
    }, {})
  }, [foodspots])

  const getProfileForUser = useCallback((userId) => {
    if (!userId) return null
    return getProfile(userId)
  }, [getProfile])

  const renderSpotAvatars = (spot) => {
    const participants = []

    if (spot.first_uploader_id) {
      participants.push(spot.first_uploader_id)
    }

    const ratingEntries = spotRatings[spot.id] || []
    ratingEntries.forEach(rating => {
      if (rating.user_id && !participants.includes(rating.user_id)) {
        participants.push(rating.user_id)
      }
    })

    const photoEntries = spotPhotos[spot.id] || []
    photoEntries.forEach(photo => {
      if (photo.uploader_user_id && !participants.includes(photo.uploader_user_id)) {
        participants.push(photo.uploader_user_id)
      }
    })

    const ownerId = list?.user_id || null
    if (ownerId && !participants.includes(ownerId)) {
      participants.push(ownerId)
    }
    const uniqueParticipants = Array.from(new Set(participants))
    uniqueParticipants.sort((a, b) => {
      if (ownerId) {
        if (a === ownerId && b !== ownerId) return -1
        if (b === ownerId && a !== ownerId) return 1
      }
      const profileA = getProfile(a)
      const profileB = getProfile(b)
      const nameA = (profileA?.username || '').toLowerCase()
      const nameB = (profileB?.username || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

    const displayUsers = uniqueParticipants.slice(0, 5)
    const extraCount = uniqueParticipants.length - displayUsers.length

    if (displayUsers.length === 0) {
      return null
    }

    return (
      <div className="flex items-center gap-1 mt-1.5">
        {displayUsers.map((userId, index) => {
          const profile = getProfileForUser(userId)
          const size = index === 0 ? 26 : 20
          const isOwner = ownerId ? userId === ownerId && index === 0 : index === 0
          const displayInitial = profile?.username?.charAt(0)?.toUpperCase() || '🍽️'
          const avatarUrl = profile?.profile_visibility === 'private' ? null : profile?.avatar_url

          return (
            <div
              key={`${spot.id}-${userId}-${index}`}
              className={`flex items-center justify-center rounded-full overflow-hidden ${
                isOwner ? 'ring-2 ring-offset-2 ring-[#FF7E42]' : ''
              } ${isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100 border border-gray-300'}`}
              style={{ width: size, height: size }}
              title={profile?.username || 'Mitglied'}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.username || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs">
                  {displayInitial}
                </span>
              )}
            </div>
          )
        })}
        {extraCount > 0 && (
          <div
            className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
            }`}
          >
            +{extraCount}
          </div>
        )}
      </div>
    )
  }

  const canDeletePhoto = useCallback((photo) => {
    if (!photo) return false
    if (isOwner) return true
    return photo.uploader_user_id === user?.id
  }, [isOwner, user])

  const userHasRating = useCallback((spotId) => {
    const ratings = spotRatings[spotId] || []
    return ratings.some(rating => rating.user_id === user?.id)
  }, [spotRatings, user?.id])

  const generateTempId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const attemptUpload = useCallback(async (entry) => {
    if (!entry) return

    if (isOffline) {
      setPhotoUploadQueue(prev => prev.map(item => (
        item.id === entry.id
          ? { ...item, status: 'queued', error: 'Wartet auf Verbindung' }
          : item
      )))
      return
    }

    setPhotoUploadQueue(prev => prev.map(item => (
      item.id === entry.id
        ? { ...item, status: 'uploading', error: null, progress: 0 }
        : item
    )))

    try {
      const photo = await uploadSharedSpotPhoto({
        listId: entry.listId,
        spotId: entry.spotId,
        file: entry.originalFile,
        setAsCover: entry.setAsCover,
        onProgress: (progress) => {
          setPhotoUploadQueue(prev => prev.map(item => (
            item.id === entry.id
              ? { ...item, progress }
              : item
          )))
        }
      })

      setPhotoUploadQueue(prev => prev.map(item => (
        item.id === entry.id
          ? { ...item, status: 'success', progress: 100 }
          : item
      )))

      let updatedPhotosForSpot = []
      setSpotPhotos(prev => {
        const existing = prev[entry.spotId] || []
        updatedPhotosForSpot = [...existing, photo].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        return { ...prev, [entry.spotId]: updatedPhotosForSpot }
      })

      if (entry.setAsCover) {
        setFoodspots(prev => prev.map(spot => (
          spot.id === entry.spotId
            ? { ...spot, cover_photo_url: photo.public_url, cover_image_id: photo.id }
            : spot
        )))

        setSelectedSpot(prev => {
          if (!prev || prev.id !== entry.spotId) return prev
          return { ...prev, cover_photo_url: photo.public_url, cover_image_id: photo.id }
        })
        setSelectedPhotoIndex(0)
      } else if (selectedSpot?.id === entry.spotId && updatedPhotosForSpot.length > 0) {
        setSelectedPhotoIndex(updatedPhotosForSpot.length - 1)
      }

      setTimeout(() => {
        setPhotoUploadQueue(prev => prev.filter(item => item.id !== entry.id))
      }, 1500)
    } catch (error) {
      console.error('[SharedTierList] Foto-Upload fehlgeschlagen:', error)
      setPhotoUploadQueue(prev => prev.map(item => (
        item.id === entry.id
          ? {
              ...item,
              status: 'error',
              progress: 0,
              error: error?.message || 'Upload fehlgeschlagen'
            }
          : item
      )))
    }
  }, [isOffline, selectedSpot?.id])

  useEffect(() => {
    if (isOffline) return
    const queued = photoUploadQueue.filter(item => item.status === 'queued')
    queued.forEach(item => attemptUpload(item))
  }, [isOffline, photoUploadQueue, attemptUpload])

  const handlePhotoInputChange = async (event) => {
    if (!selectedSpot?.id) return

    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (files.length === 0) return

    const currentPhotos = spotPhotosRef.current[selectedSpot.id] || []
    const inFlight = photoUploadQueue.filter(item =>
      item.spotId === selectedSpot.id && (item.status === 'uploading' || item.status === 'queued')
    ).length

    const availableSlots = MAX_SPOT_PHOTOS - (currentPhotos.length + inFlight)
    if (availableSlots <= 0) {
      showToast('Maximal 8 Fotos pro Spot erlaubt.', 'info')
      return
    }

    const usableFiles = files.slice(0, availableSlots)
    if (usableFiles.length < files.length) {
      showToast('Es konnten nicht alle Dateien übernommen werden (Limit erreicht).', 'info')
    }

    usableFiles.forEach((file, index) => {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        setPhotoUploadQueue(prev => [
          ...prev,
          {
            id: generateTempId(),
            fileName: file.name,
            status: 'error',
            error: 'Ungültiger Dateityp (nur JPG, PNG, HEIC)',
            spotId: selectedSpot.id
          }
        ])
        return
      }

      const entry = {
        id: generateTempId(),
        fileName: file.name,
        status: 'queued',
        progress: 0,
        error: null,
        listId: id,
        spotId: selectedSpot.id,
        originalFile: file,
        setAsCover: currentPhotos.length === 0 && inFlight === 0 && index === 0
      }

      setPhotoUploadQueue(prev => [...prev, entry])
      attemptUpload(entry)
    })
  }

  const retryUpload = (entryId) => {
    const entry = photoUploadQueue.find(item => item.id === entryId)
    if (!entry) return

    setPhotoUploadQueue(prev => prev.map(item => (
      item.id === entryId
        ? { ...item, status: 'queued', error: null }
        : item
    )))

    attemptUpload(entry)
  }

  const activeSpotPhotos = useMemo(() => {
    if (!selectedSpot?.id) return []
    return spotPhotos[selectedSpot.id] || []
  }, [spotPhotos, selectedSpot])

  const activePhoto = useMemo(() => {
    if (!activeSpotPhotos.length) return null
    return activeSpotPhotos[Math.min(selectedPhotoIndex, activeSpotPhotos.length - 1)] || null
  }, [activeSpotPhotos, selectedPhotoIndex])

  const selectedSpotHasRating = useMemo(() => {
    if (!selectedSpot) return false
    return userHasRating(selectedSpot.id)
  }, [selectedSpot, userHasRating])

  const handleSetCoverPhoto = async (photo) => {
    if (!photo || !canUploadPhotos) return
    setPhotoActionLoading(`cover-${photo.id}`)
    try {
      const updatedPhoto = await setSharedSpotCoverPhoto({ photoId: photo.id })
      const coverUrl = updatedPhoto?.public_url || photo.public_url

      setFoodspots(prev => prev.map(spot => (
        spot.id === photo.spot_id
          ? { ...spot, cover_photo_url: coverUrl, cover_image_id: photo.id }
          : spot
      )))

      setSelectedSpot(prev => {
        if (!prev || prev.id !== photo.spot_id) return prev
        return { ...prev, cover_photo_url: coverUrl, cover_image_id: photo.id }
      })

      showToast('Titelbild aktualisiert', 'success')
    } catch (error) {
      console.error('[SharedTierList] Titelbild setzen fehlgeschlagen:', error)
      showToast(error?.message || 'Titelbild konnte nicht gesetzt werden.', 'error')
    } finally {
      setPhotoActionLoading(null)
    }
  }

  const handleDeletePhoto = async (photo) => {
    if (!photo) return
    if (!canDeletePhoto(photo)) {
      showToast('Keine Berechtigung zum Löschen dieses Fotos', 'error')
      return
    }

    setPhotoActionLoading(`delete-${photo.id}`)
    try {
      const result = await deleteSharedSpotPhoto({ photoId: photo.id })
      const newCoverUrl = result?.new_cover_url || null
      const newCoverId = result?.new_cover_id || null
      const targetSpotId = result?.spot_id || photo.spot_id

      setSpotPhotos(prev => {
        const existing = prev[targetSpotId] || []
        const filtered = existing.filter(item => item.id !== photo.id)
        return { ...prev, [targetSpotId]: filtered }
      })

      setFoodspots(prev => prev.map(spot => (
        spot.id === targetSpotId
          ? { ...spot, cover_photo_url: newCoverUrl, cover_image_id: newCoverId }
          : spot
      )))

      setSelectedSpot(prev => {
        if (!prev || prev.id !== targetSpotId) return prev
        return { ...prev, cover_photo_url: newCoverUrl, cover_image_id: newCoverId }
      })

      showToast('Foto gelöscht', 'success')
    } catch (error) {
      console.error('[SharedTierList] Foto löschen fehlgeschlagen:', error)
      showToast(error?.message || 'Foto konnte nicht gelöscht werden.', 'error')
    } finally {
      setPhotoActionLoading(null)
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ''
    try {
      return new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(timestamp))
    } catch (error) {
      return new Date(timestamp).toLocaleString()
    }
  }

  const openSpotDetails = (spot) => {
    setSelectedSpot(spot)
    setDescriptionDraft(spot?.description || '')
    setShowSpotDetails(true)
  }

  const closeSpotDetails = () => {
    setShowSpotDetails(false)
    setSelectedSpot(null)
    setSelectedPhotoIndex(0)
  }

  const handleDescriptionSave = async () => {
    if (!selectedSpot || !canEditSpots) return
    setDescriptionSaving(true)
    try {
      const { error } = await supabase.rpc('merge_foodspot', {
        p_list_id: id,
        p_name: selectedSpot.name,
        p_score: null,
        p_description: descriptionDraft.trim() ? descriptionDraft.trim() : null,
        p_category: selectedSpot.category,
        p_address: selectedSpot.address || null,
        p_latitude: selectedSpot.latitude,
        p_longitude: selectedSpot.longitude,
        p_cover_photo: selectedSpot.cover_photo_url || null,
        p_phone: selectedSpot.phone || null,
        p_website: selectedSpot.website || null
      })

      if (error) throw error

      showToast('Beschreibung gespeichert', 'success')
      fetchTierData({ background: true })
      closeSpotDetails()
    } catch (error) {
      console.error('Error saving description:', error)
      showToast(error?.message || 'Beschreibung konnte nicht gespeichert werden.', 'error')
    } finally {
      setDescriptionSaving(false)
    }
  }

  const handleAddFoodspot = () => {
    navigate(`/shared/add-foodspot/${id}`)
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🤝</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt geteilte Liste...</p>
        </div>
      </div>
    )
  }

  if (!list) {
    return null
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-[16px] border-b border-gray-200/40 dark:border-gray-800/60 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard?view=geteilt')}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-200/40 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Geteilte Liste · {userRole === 'owner' ? 'Owner' : userRole === 'editor' ? 'Editor' : 'Viewer'}
            </p>
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {list.list_name}
            </h1>
          </div>
          <div className="flex items-center gap-2" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-12">
          {TIERS.map((tier) => {
            const tierSpots = foodspotsByTier[tier] || []
            const tierColor = TIER_COLORS[tier]

            return (
              <section key={tier}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl"
                      style={{ background: tierColor.gradient }}
                    >
                      {tierColor.emoji}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {tier}-Tier
                      </h2>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {tierSpots.length} Spot{tierSpots.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  {tierSpots.length > 0 && (
                    <button
                      onClick={() => setShowTierModal(tier)}
                      className={`px-4 py-2 rounded-[16px] text-sm font-semibold transition-all ${
                        isDark
                          ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Alle ansehen
                    </button>
                  )}
                </div>

                {tierSpots.length === 0 ? (
                  <div className={`rounded-3xl border-2 border-dashed px-6 py-16 text-center ${
                    isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="text-4xl mb-3">🚧</div>
                    <p className="text-sm text-gray-500">Hier sind noch keine Spots gelandet.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {tierSpots.slice(0, 3).map((spot) => {
                        const photos = spotPhotos[spot.id] || []
                        const displayPhotos = photos.slice(0, 3)
                        
                        return (
                          <div
                            key={spot.id}
                            onClick={() => openSpotDetails(spot)}
                            className={`rounded-2xl p-4 border shadow-sm cursor-pointer hover:shadow-lg active:scale-[0.99] transition-all ${
                              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Left Column: Text Content */}
                              <div className="flex-1 min-w-0">
                                {/* Row 1: Spot Name */}
                                <h3 className="font-bold text-base truncate mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                                  {spot.name}
                                </h3>
                                
                                {/* Address (if available) */}
                                {spot.address && (
                                  <p className={`text-xs truncate mb-1 ${
                                    isDark ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                    📍 {spot.address}
                                  </p>
                                )}
                                
                                {/* Row 2: Rating, Category, Badge */}
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <span className="text-sm">
                                    ⭐ {spot.ratings_count > 0
                                      ? (spot.avg_score || spot.rating || 0).toFixed(1)
                                      : '—'}
                                  </span>
                                  {spot.category && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {spot.category}
                                    </span>
                                  )}
                                  {spot.ratings_count > 0 && (
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                      isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                      {spot.ratings_count}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Row 3: Avatars */}
                                {renderSpotAvatars(spot)}
                              </div>
                              
                              {/* Right Column: Photo Thumbnails */}
                              {photos.length > 0 && (
                                <div className="relative flex-shrink-0">
                                  {photos.length === 1 ? (
                                    // 1 Bild: Größeres einzelnes Thumbnail
                                    <div className="relative">
                                      <img
                                        src={displayPhotos[0].public_url}
                                        alt={spot.name}
                                        loading="lazy"
                                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border ${
                                          isDark ? 'border-gray-600' : 'border-gray-200'
                                        }`}
                                      />
                                    </div>
                                  ) : photos.length === 2 ? (
                                    // 2 Bilder: Zwei Thumbnails nebeneinander
                                    <div className="flex gap-2">
                                      {displayPhotos.map((photo) => (
                                        <img
                                          key={photo.id}
                                          src={photo.public_url}
                                          alt={spot.name}
                                          loading="lazy"
                                          className={`w-16 h-16 sm:w-18 sm:h-18 rounded-lg object-cover border ${
                                            isDark ? 'border-gray-600' : 'border-gray-200'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    // 3+ Bilder: Max 3 Thumbnails mit Badge
                                    <div className="relative">
                                      <div className="flex gap-1.5">
                                        {displayPhotos.map((photo) => (
                                          <img
                                            key={photo.id}
                                            src={photo.public_url}
                                            alt={spot.name}
                                            loading="lazy"
                                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border ${
                                              isDark ? 'border-gray-600' : 'border-gray-200'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                      {/* Photo counter badge */}
                                      <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-lg ${
                                        isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'
                                      }`}>
                                        📷 {photos.length}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* "Alle ansehen" Button - ab 4 Spots */}
                    {tierSpots.length >= 4 && (
                      <button
                        onClick={() => setShowTierModal(tier)}
                        className={`w-full mt-4 py-3 px-4 rounded-2xl border-2 border-dashed font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] ${
                          isDark 
                            ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-[#FF9357] hover:bg-[#FF9357]/10' 
                            : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-[#FF7E42] hover:bg-[#FFE4C3]/30'
                        }`}
                      >
                        Alle ansehen ({tierSpots.length} Spots)
                      </button>
                    )}
                  </>
                )}
              </section>
            )
          })}
        </div>
      </main>

      {/* Tier modal for full list */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className={`rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col ${
              isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-xl font-bold">{showTierModal}-Tier · Alle Spots</h2>
              <button
                onClick={() => setShowTierModal(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {(foodspotsByTier[showTierModal] || []).map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => {
                      setShowTierModal(null)
                      openSpotDetails(spot)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-2xl border transition-all ${
                      isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{spot.name}</p>
                        <p className="text-xs text-gray-500">
                          ⭐ {spot.ratings_count > 0 ? (spot.avg_score || spot.rating || 0).toFixed(1) : '—'} · {spot.ratings_count} Bewertung{spot.ratings_count === 1 ? '' : 'en'}
                        </p>
                      </div>
                      <span className="text-sm text-gray-500">{spot.category}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spot detail bottom sheet */}
      {showSpotDetails && selectedSpot && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSpotDetails}
          />
          <div
            className={`relative rounded-t-[32px] shadow-2xl max-h-[85vh] w-full max-w-3xl mx-auto overflow-hidden ${
              isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {selectedSpot.name}
                </h2>
                <p className="text-sm text-gray-400">
                  {selectedSpot.category || list?.category || 'Kategorie'}
                </p>
              </div>
              <button
                onClick={closeSpotDetails}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 70px)' }}>
              <div className="mb-6">
                <div
                  className={`relative w-full overflow-hidden rounded-3xl ${
                    isDark ? 'bg-gray-800/60 border border-gray-700' : 'bg-gray-100 border border-gray-200'
                  }`}
                  style={{ aspectRatio: '16 / 10' }}
                >
                  {activePhoto ? (
                    <>
                      <img
                        src={activePhoto.public_url}
                        alt={selectedSpot.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${
                        isDark ? 'bg-black/50 text-gray-100' : 'bg-white/80 text-gray-800'
                      }`}>
                        {selectedPhotoIndex + 1} / {activeSpotPhotos.length}
                      </div>
                      {activeSpotPhotos.length > 1 && (
                        <>
                          <button
                            onClick={() => setSelectedPhotoIndex(prev => (prev - 1 + activeSpotPhotos.length) % activeSpotPhotos.length)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center bg-black/40 text-white hover:bg-black/60 transition-all"
                            aria-label="Vorheriges Foto"
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => setSelectedPhotoIndex(prev => (prev + 1) % activeSpotPhotos.length)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center bg-black/40 text-white hover:bg-black/60 transition-all"
                            aria-label="Nächstes Foto"
                          >
                            ›
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      <div className="text-4xl">📸</div>
                      <p className={`text-sm text-center max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Noch keine Fotos. Lade welche hoch, um diesen Spot lebendig zu machen!
                      </p>
                      {canUploadPhotos && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all"
                        >
                          Foto hinzufügen
                        </button>
                      )}
                    </div>
                  )}
                  {canUploadPhotos && activePhoto && (
                    <div className="absolute top-3 right-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSetCoverPhoto(activePhoto)}
                        disabled={photoActionLoading === `cover-${activePhoto.id}` || selectedSpot.cover_image_id === activePhoto.id}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur ${
                          photoActionLoading === `cover-${activePhoto.id}` || selectedSpot.cover_image_id === activePhoto.id
                            ? 'bg-black/20 text-gray-300 cursor-not-allowed'
                            : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                      >
                        {selectedSpot.cover_image_id === activePhoto.id ? 'Titelbild aktiv' : 'Als Titelbild setzen'}
                      </button>
                      {canDeletePhoto(activePhoto) && (
                        <button
                          onClick={() => handleDeletePhoto(activePhoto)}
                          disabled={photoActionLoading === `delete-${activePhoto.id}`}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur ${
                            photoActionLoading === `delete-${activePhoto.id}`
                              ? 'bg-red-500/30 text-red-100 cursor-not-allowed'
                              : 'bg-red-500/80 text-white hover:bg-red-600/90'
                          }`}
                        >
                          Foto löschen
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {activeSpotPhotos.length > 0 && (
                  <>
                    <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                      {activeSpotPhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => setSelectedPhotoIndex(index)}
                          className={`relative rounded-2xl overflow-hidden border transition-all ${
                            index === selectedPhotoIndex
                              ? isDark ? 'border-[#FF9357]' : 'border-[#FF7E42]'
                              : isDark ? 'border-transparent opacity-70 hover:opacity-100' : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                          style={{ flex: '0 0 96px', height: '72px' }}
                        >
                          <img
                            src={photo.public_url}
                            alt={`Foto ${index + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          {photo.uploader_user_id && (
                            <span className={`absolute bottom-1 left-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isDark ? 'bg-black/50 text-gray-100' : 'bg-white/80 text-gray-800'
                            }`}>
                              {getProfile(photo.uploader_user_id)?.username || 'Member'}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canUploadPhotos && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                            isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-100' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          }`}
                        >
                          Foto hinzufügen
                        </button>
                      )}
                    </div>
                  </>
                )}

                {photoUploadQueue.filter(item => item.spotId === selectedSpot.id).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {photoUploadQueue.filter(item => item.spotId === selectedSpot.id).map(item => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          isDark ? 'border-gray-800 bg-gray-900/70' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-2">
                          <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{item.fileName}</span>
                          <span className={
                            item.status === 'success' ? 'text-green-500' :
                            item.status === 'error' ? 'text-red-500' :
                            isDark ? 'text-gray-300' : 'text-gray-600'
                          }>
                            {item.status === 'uploading' && `${item.progress}%`}
                            {item.status === 'queued' && 'wartet...'}
                            {item.status === 'success' && 'fertig'}
                            {item.status === 'error' && 'Fehler'}
                          </span>
                        </div>
                        <div className={`h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                          <div
                            className={`h-full rounded-full ${
                              item.status === 'error'
                                ? 'bg-red-500'
                                : item.status === 'success'
                                  ? 'bg-green-500'
                                  : 'bg-[#FF7E42]'
                            }`}
                            style={{ width: `${Math.min(item.progress || (item.status === 'success' ? 100 : 5), 100)}%` }}
                          />
                        </div>
                        {item.status === 'error' && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-red-500">{item.error}</span>
                            <button
                              onClick={() => retryUpload(item.id)}
                              className="text-[11px] font-semibold text-[#FF7E42]"
                            >
                              Erneut versuchen
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isOffline && (
                  <div className={`mt-3 text-xs flex items-center gap-2 ${
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    <span>⚠️</span>
                    <span>Offline – neue Uploads warten, bis wieder eine Verbindung besteht.</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div>
                  <p className="text-sm text-gray-400">Ø Bewertung</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-4xl font-bold">
                      {selectedSpot.ratings_count > 0 ? (selectedSpot.avg_score || selectedSpot.rating || 0).toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {selectedSpot.ratings_count > 0
                        ? `${selectedSpot.ratings_count} Bewertung${selectedSpot.ratings_count === 1 ? '' : 'en'}`
                        : 'Noch keine Bewertungen'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start sm:items-end">
                  <span className="text-sm font-semibold text-gray-400">Mitglieder</span>
                  {renderSpotAvatars(selectedSpot)}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 mb-5 ${
                isDark ? 'border-gray-800 bg-gray-900/70' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Gemeinsame Beschreibung</h3>
                  {canEditSpots && (
                    <span className="text-xs px-2 py-1 rounded-full bg-[#FF7E42]/10 text-[#FF7E42] font-semibold">
                      Owner / Editor
                    </span>
                  )}
                </div>
                {canEditSpots ? (
                  <div className="space-y-3">
                    <textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      rows="4"
                      className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 resize-none ${
                        isDark
                          ? 'bg-gray-900 border-gray-700 text-white focus:ring-[#FF9357]/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-[#FF7E42]/20'
                      }`}
                      placeholder="Beschreibe diesen Spot für alle Mitglieder..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setDescriptionDraft(selectedSpot.description || '')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium ${
                          isDark ? 'bg-gray-900 text-gray-300 hover:bg-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Zurücksetzen
                      </button>
                      <button
                        onClick={handleDescriptionSave}
                        disabled={descriptionSaving}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all ${
                          descriptionSaving
                            ? 'opacity-60 cursor-not-allowed'
                            : isDark
                              ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C] hover:shadow-xl'
                              : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] hover:shadow-xl'
                        }`}
                      >
                        {descriptionSaving ? 'Speichert...' : 'Speichern'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {selectedSpot.description || 'Noch keine Beschreibung vorhanden.'}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⭐</span>
                  <h3 className="text-lg font-semibold">Einzelbewertungen</h3>
                </div>
                {spotRatings[selectedSpot.id]?.length > 0 ? (
                  <div className="space-y-4">
                    {spotRatings[selectedSpot.id].map(rating => {
                      const profile = getProfileForUser(rating.user_id)
                      return (
                        <div
                          key={rating.id}
                          className={`rounded-2xl border px-4 py-3 ${
                            isDark ? 'border-gray-800 bg-gray-900/70' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isDark ? 'bg-gray-800' : 'bg-gray-200'
                              }`}>
                                {profile?.avatar_url ? (
                                  <img
                                    src={profile.avatar_url}
                                    alt={profile?.username || 'Avatar'}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm">
                                    {profile?.food_emoji || profile?.username?.charAt(0)?.toUpperCase() || '🍽️'}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">
                                  {profile?.username || 'Mitglied'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatTimestamp(rating.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">
                                {rating.score.toFixed(1)}
                              </p>
                              <p className="text-xs text-gray-500">
                                persönlich
                              </p>
                            </div>
                          </div>

                          {rating.comment && (
                            <p className={`text-sm mt-3 ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {rating.comment}
                            </p>
                          )}

                          {rating.criteria && Object.keys(rating.criteria).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(rating.criteria).map(([criterion, value]) => (
                                <span
                                  key={criterion}
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    isDark ? 'bg-gray-900 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-200'
                                  }`}
                                >
                                  {criterion}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Noch keine Bewertungen vorhanden.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    closeSpotDetails()
                    navigate(`/shared/add-foodspot/${id}?spotId=${selectedSpot.id}`)
                  }}
                  className={`flex-1 py-3 rounded-2xl font-semibold text-base shadow-lg transition-all ${
                    isDark
                      ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C] text-white hover:shadow-xl'
                      : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white hover:shadow-xl'
                  }`}
                >
                  {selectedSpotHasRating ? 'Meine Bewertung ändern' : 'Meine Bewertung hinzufügen'}
                </button>
                {canEditSpots && (
                  <button
                    onClick={() => {
                      closeSpotDetails()
                      navigate(`/shared/add-foodspot/${id}?spotId=${selectedSpot.id}`)
                    }}
                    className={`flex-1 py-3 rounded-2xl font-semibold text-base border transition-all ${
                      isDark
                        ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Spot bearbeiten
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={handlePhotoInputChange}
      />

      {canEditSpots && (
        <button
          onClick={handleAddFoodspot}
          className={`fixed bottom-6 right-6 w-auto px-5 h-14 text-white rounded-full shadow-xl flex items-center gap-2 justify-center hover:shadow-2xl hover:scale-105 transition-all active:scale-95 z-30 ${
            isDark
              ? 'bg-gradient-to-br from-[#FF9357] to-[#B85C2C]'
              : 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
          }`}
          style={{ boxShadow: '0 8px 24px rgba(255, 125, 66, 0.35)' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          <span className="font-semibold">Spot hinzufügen</span>
        </button>
      )}

      {toast && (
        <div 
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-2xl shadow-lg z-50 ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-gray-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

    </div>
  )
}

export default SharedTierList


