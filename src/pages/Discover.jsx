import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'

const TABS = [
  { key: 'top', label: 'Top 10' },
  { key: 'personal', label: 'Für dich' },
  { key: 'hot', label: 'Neu & Heiß' }
]

const CATEGORY_OPTIONS = [
  'Döner',
  'Burger',
  'Pizza',
  'Asiatisch',
  'Bratwurst',
  'Glühwein',
  'Sushi',
  'Steak',
  'Fast Food',
  'Streetfood',
  'Deutsche Küche',
  'Bier',
  'Café',
  'Vegan',
  'Vegetarisch'
]

const FILTER_INITIAL = { city: '', category: '' }
const DAY_MS = 24 * 60 * 60 * 1000
const NEW_BADGE_DAYS = 7
const HOT_WINDOW_DAYS = 14

const normalize = (value) => {
  if (!value) return ''
  return value.toString().trim().toLocaleLowerCase('de-DE')
}

const normalizeSpotName = (name) => {
  if (!name || typeof name !== 'string') return ''
  return name.trim().toLocaleLowerCase('de-DE')
}

const buildSpotKey = (name, city, category) =>
  `${normalizeSpotName(name)}|${normalize(city)}|${normalize(category)}`

const formatScore = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return '–'
  }
  return value.toFixed(1)
}

function Discover() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('top')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [spots, setSpots] = useState([])
  const [filters, setFilters] = useState(FILTER_INITIAL)
  const [pendingFilters, setPendingFilters] = useState(FILTER_INITIAL)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [userStats, setUserStats] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [selectedSpot, setSelectedSpot] = useState(null)
  const [photoLimit, setPhotoLimit] = useState(12)

  const fetchDiscoverData = useCallback(async ({ background = false } = {}) => {
    if (!user) {
      setLoading(false)
      setRefreshing(false)
      setSpots([])
      setUserStats(null)
      return
    }

    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const { data: spotRows, error: spotError } = await supabase
        .from('foodspots')
        .select(`
          id,
          list_id,
          user_id,
          name,
          category,
          address,
          avg_score,
          rating,
          ratings_count,
          cover_photo_url,
          created_at,
          updated_at,
          lists!inner(
            id,
            list_name,
            city,
            category,
            user_id,
            cover_image_url,
            created_at,
            updated_at
          )
        `)
        .order('avg_score', { ascending: false })
        .limit(300)

      if (spotError) {
        throw spotError
      }

      const listIds = Array.from(new Set((spotRows || []).map((row) => row?.list_id).filter(Boolean)))
      const ownerIds = Array.from(
        new Set((spotRows || []).map((row) => row?.lists?.user_id || row?.user_id).filter(Boolean))
      )

      const [memberRes, profileRes, statsRes] = await Promise.all([
        listIds.length > 0
          ? supabase.from('list_members').select('list_id, user_id').in('list_id', listIds)
          : Promise.resolve({ data: [], error: null }),
        ownerIds.length > 0
          ? supabase
              .from('user_profiles')
              .select('id, username, profile_image_url, profile_visibility')
              .in('id', ownerIds)
          : Promise.resolve({ data: [], error: null }),
        (async () => {
          try {
            return await supabase.rpc('get_user_stats', { target_user_id: user.id })
          } catch (statsErr) {
            console.warn('[Discover] get_user_stats failed:', statsErr)
            return { data: null, error: statsErr }
          }
        })()
      ])

      if (memberRes.error && memberRes.error.code !== '42P01') {
        throw memberRes.error
      }
      if (profileRes.error && profileRes.error.code !== '42P01') {
        throw profileRes.error
      }

      const memberMap = new Map()
      ;(memberRes.data || []).forEach((entry) => {
        if (!entry?.list_id || !entry?.user_id) return
        if (!memberMap.has(entry.list_id)) {
          memberMap.set(entry.list_id, new Set())
        }
        memberMap.get(entry.list_id).add(entry.user_id)
      })

      const profileMap = new Map()
      ;(profileRes.data || []).forEach((profile) => {
        if (!profile?.id) return
        profileMap.set(profile.id, profile)
      })

      const requiredProfileIds = new Set()

      const processedSpots = (spotRows || []).reduce((acc, row) => {
        if (!row?.lists?.id) return acc
        const ownerId = row.lists.user_id || row.user_id
        if (!ownerId) return acc

        const ownerProfile = profileMap.get(ownerId)
        if (!ownerProfile || ownerProfile.profile_visibility === 'private') {
          return acc
        }

        const memberSet = memberMap.get(row.lists.id) || new Set()
        const hasOtherMembers = Array.from(memberSet).some((id) => id !== ownerId)
        if (hasOtherMembers) {
          return acc
        }

        const name = (row.name || '').trim()
        const cityLabel = (row.lists.city || '').trim()
        const categoryLabel = (row.category || row.lists.category || 'Andere').trim()
        if (!name) return acc

        const key = buildSpotKey(name, cityLabel, categoryLabel)
        const createdAt = row.created_at || row.lists.created_at || null

        requiredProfileIds.add(ownerId)

        acc.push({
          id: row.id,
          key,
          name,
          cityLabel,
          categoryLabel,
          ownerId,
          createdAt
        })
        return acc
      }, [])

      const spotIds = processedSpots.map((spot) => spot.id)

      let ratingsData = []
      let photosData = []

      if (spotIds.length > 0) {
        const [{ data: ratingsRes, error: ratingsError }, { data: photosRes, error: photosError }] = await Promise.all([
          supabase
            .from('foodspot_ratings')
            .select('id, foodspot_id, user_id, score, comment, created_at')
            .in('foodspot_id', spotIds),
          supabase
            .from('spot_photos')
            .select('id, spot_id, uploader_user_id, public_url, created_at')
            .in('spot_id', spotIds)
        ])

        if (ratingsError && ratingsError.code !== '42P01' && ratingsError.code !== 'PGRST116') {
          throw ratingsError
        }
        if (photosError && photosError.code !== '42P01' && photosError.code !== 'PGRST116') {
          throw photosError
        }

        ratingsData = ratingsRes || []
        photosData = photosRes || []
      }

      const ratingsBySpot = new Map()
      ratingsData.forEach((rating) => {
        if (!rating?.foodspot_id || !rating?.user_id || typeof rating.score !== 'number') return
        if (!ratingsBySpot.has(rating.foodspot_id)) {
          ratingsBySpot.set(rating.foodspot_id, new Map())
        }
        const userMap = ratingsBySpot.get(rating.foodspot_id)
        const existing = userMap.get(rating.user_id)
        if (!existing || new Date(rating.created_at) > new Date(existing.created_at)) {
          userMap.set(rating.user_id, rating)
        }
      })

      const photosBySpot = new Map()
      photosData.forEach((photo) => {
        if (!photo?.spot_id || !photo?.public_url) return
        if (!photosBySpot.has(photo.spot_id)) {
          photosBySpot.set(photo.spot_id, [])
        }
        photosBySpot.get(photo.spot_id).push(photo)
      })

      photosBySpot.forEach((list) => {
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      })

      const aggregateMap = new Map()

      processedSpots.forEach((spot) => {
        const key = spot.key
        if (!aggregateMap.has(key)) {
          aggregateMap.set(key, {
            key,
            nameCounts: new Map(),
            nameFallback: spot.name,
            cityLabel: spot.cityLabel,
            categoryLabel: spot.categoryLabel,
            latestRatings: new Map(),
            latestRatingAt: null,
            photos: [],
            photoCount: 0,
            firstPhoto: null
          })
        }

        const entry = aggregateMap.get(key)
        entry.nameCounts.set(spot.name, (entry.nameCounts.get(spot.name) || 0) + 1)
        if (!entry.cityLabel && spot.cityLabel) entry.cityLabel = spot.cityLabel
        if (!entry.categoryLabel && spot.categoryLabel) entry.categoryLabel = spot.categoryLabel

        const ratingMap = ratingsBySpot.get(spot.id)
        if (ratingMap) {
          ratingMap.forEach((rating) => {
            if (!rating?.user_id) return
            const existing = entry.latestRatings.get(rating.user_id)
            if (!existing || new Date(rating.created_at) > new Date(existing.created_at)) {
              entry.latestRatings.set(rating.user_id, rating)
            }
            if (!entry.latestRatingAt || new Date(rating.created_at) > new Date(entry.latestRatingAt)) {
              entry.latestRatingAt = rating.created_at
            }
            requiredProfileIds.add(rating.user_id)
          })
        }

        const spotPhotos = photosBySpot.get(spot.id) || []
        entry.photoCount += spotPhotos.length
        spotPhotos.forEach((photo) => {
          entry.photos.push({ ...photo, spotId: spot.id })
          if (
            photo.public_url &&
            (!entry.firstPhoto ||
              new Date(photo.created_at || 0) < new Date(entry.firstPhoto.created_at || 0))
          ) {
            entry.firstPhoto = photo
          }
          if (photo.uploader_user_id) {
            requiredProfileIds.add(photo.uploader_user_id)
          }
        })
      })

      const missingProfileIds = Array.from(requiredProfileIds).filter(
        (id) => id && !profileMap.has(id)
      )

      if (missingProfileIds.length > 0) {
        const { data: extraProfiles, error: extraProfilesError } = await supabase
          .from('user_profiles')
          .select('id, username, profile_image_url, profile_visibility')
          .in('id', missingProfileIds)

        if (extraProfilesError && extraProfilesError.code !== '42P01') {
          throw extraProfilesError
        }

        extraProfiles?.forEach((profile) => {
          if (profile?.id) {
            profileMap.set(profile.id, profile)
          }
        })
      }

      const aggregatedArray = Array.from(aggregateMap.values()).map((entry) => {
        const nameCandidates = Array.from(entry.nameCounts.entries()).sort((a, b) => b[1] - a[1])
        const name = nameCandidates[0]?.[0] || entry.nameFallback || 'Unbenannter Spot'

        const latestRatings = Array.from(entry.latestRatings.values()).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )

        const ratingCount = latestRatings.length
        const avgScore =
          ratingCount > 0
            ? latestRatings.reduce((sum, rating) => sum + (rating.score || 0), 0) / ratingCount
            : 0

        const distributionMap = new Map()
        latestRatings.forEach((rating) => {
          const rounded = Math.round(rating.score || 0)
          if (!rounded) return
          distributionMap.set(rounded, (distributionMap.get(rounded) || 0) + 1)
        })
        const ratingDistribution = Array.from(distributionMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([score, count]) => ({ score, count }))

        const sortedPhotos = entry.photos
          .slice()
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        const detailPhotos = sortedPhotos.slice(0, 20).map((photo) => ({
          id: photo.id,
          public_url: photo.public_url,
          created_at: photo.created_at,
          uploader_user_id: photo.uploader_user_id,
          uploaderName:
            (photo.uploader_user_id && profileMap.get(photo.uploader_user_id)?.username) || 'Foodie'
        }))
        const oldestPhoto = sortedPhotos.length > 0 ? sortedPhotos[sortedPhotos.length - 1] : null
        const firstPhotoUrl = entry.firstPhoto?.public_url || oldestPhoto?.public_url || null

        return {
          key: entry.key,
          name,
          primaryCity: entry.cityLabel,
          primaryCategory: entry.categoryLabel || 'Andere',
          avgScore,
          ratingCount,
          firstPhotoUrl,
          totalPhotos: entry.photoCount,
          latestRatingAt: entry.latestRatingAt,
          detail: {
            ratingDistribution,
            photos: detailPhotos,
            latestRatingAt: entry.latestRatingAt
          }
        }
      })

      setSpots(aggregatedArray)
      setLastUpdated(Date.now())
      setUserStats(statsRes?.data || null)
    } catch (fetchError) {
      console.error('[Discover] Fehler beim Laden:', fetchError)
      setError('Daten konnten nicht geladen werden. Bitte versuche es erneut.')
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    fetchDiscoverData()
  }, [fetchDiscoverData])

  useEffect(() => {
    if (isFilterSheetOpen) {
      setPendingFilters(filters)
    }
  }, [isFilterSheetOpen, filters])

  useEffect(() => {
    if (activeTab !== 'top') {
      setIsFilterSheetOpen(false)
    }
  }, [activeTab])

  const hasActiveFilters = useMemo(() => {
    return Boolean(filters.city.trim()) || Boolean(filters.category)
  }, [filters])

  const sortByScore = useCallback((collection) => {
    return collection
      .slice()
      .sort((a, b) => {
        const scoreDiff = (b.avgScore || 0) - (a.avgScore || 0)
        if (scoreDiff !== 0) return scoreDiff
        const ratingDiff = (b.ratingCount || 0) - (a.ratingCount || 0)
        if (ratingDiff !== 0) return ratingDiff
        return (new Date(b.latestRatingAt || 0).getTime()) - (new Date(a.latestRatingAt || 0).getTime())
      })
  }, [])

  const filteredTopCandidates = useMemo(() => {
    if (spots.length === 0) return []
    const cityFilter = normalize(filters.city)
    const categoryFilter = normalize(filters.category)

    return spots.filter((spot) => {
      if (cityFilter && !normalize(spot.primaryCity).includes(cityFilter)) {
        return false
      }
      if (categoryFilter && normalize(spot.primaryCategory) !== categoryFilter) {
        return false
      }
      return true
    })
  }, [spots, filters])

  const topTenSpots = useMemo(() => {
    return sortByScore(filteredTopCandidates).slice(0, 10)
  }, [filteredTopCandidates, sortByScore])

  const preferredCategories = useMemo(() => {
    if (!userStats || !Array.isArray(userStats.top_categories)) return []
    return userStats.top_categories.map((entry) => entry?.category).filter(Boolean)
  }, [userStats])

  const personalizedSpots = useMemo(() => {
    if (spots.length === 0) return []

    const queue = []
    const seen = new Set()

    if (preferredCategories.length > 0) {
      spots
        .filter((spot) => preferredCategories.includes(spot.primaryCategory))
        .forEach((spot) => {
          if (!seen.has(spot.key)) {
            queue.push(spot)
            seen.add(spot.key)
          }
        })
    }

    if (queue.length < 10) {
      sortByScore(spots).forEach((spot) => {
        if (!seen.has(spot.key)) {
          queue.push(spot)
          seen.add(spot.key)
        }
      })
    }

    return queue.slice(0, 10)
  }, [spots, preferredCategories, sortByScore])

  const newHotSpots = useMemo(() => {
    if (spots.length === 0) return []

    const now = Date.now()
    return spots
      .filter((spot) => spot.latestRatingAt && (now - new Date(spot.latestRatingAt).getTime()) <= HOT_WINDOW_DAYS * DAY_MS)
      .sort((a, b) => {
        const ratingDiff = (b.ratingCount || 0) - (a.ratingCount || 0)
        if (ratingDiff !== 0) return ratingDiff
        const scoreDiff = (b.avgScore || 0) - (a.avgScore || 0)
        if (scoreDiff !== 0) return scoreDiff
        return new Date(b.latestRatingAt || 0) - new Date(a.latestRatingAt || 0)
      })
      .slice(0, 10)
  }, [spots])

  const handleApplyFilters = () => {
    setFilters(pendingFilters)
    setIsFilterSheetOpen(false)
  }

  const handleResetFilters = () => {
    setPendingFilters(FILTER_INITIAL)
    setFilters(FILTER_INITIAL)
    setIsFilterSheetOpen(false)
  }

  const handleOpenSpot = useCallback((spot) => {
    hapticFeedback.light()
    setSelectedSpot(spot)
    setPhotoLimit(12)
  }, [])

  const closeSpotModal = useCallback(() => {
    setSelectedSpot(null)
    setPhotoLimit(12)
  }, [])

  const renderFilterSheet = () => {
    if (activeTab !== 'top') return null

    return (
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/40" onClick={() => setIsFilterSheetOpen(false)} />
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-3xl p-6 space-y-5 ${
            isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
          }`}
        >
          <div className="w-16 h-1.5 bg-gray-400/60 rounded-full mx-auto mb-2" />
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Filter
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Verfeinere die Empfehlungen nach Ort und Kategorie.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className={`text-xs uppercase font-semibold block mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Ort
              </label>
              <input
                type="text"
                value={pendingFilters.city}
                onChange={(event) =>
                  setPendingFilters((prev) => ({
                    ...prev,
                    city: event.target.value
                  }))
                }
                placeholder="z. B. München oder Berlin"
                className={`w-full px-4 py-3 text-base rounded-[14px] border focus:outline-none focus:ring-2 transition-all ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-[#FF9357]/25'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/25'
                }`}
                autoComplete="off"
              />
            </div>

            <div>
              <label
                className={`text-xs uppercase font-semibold block mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Kategorie
              </label>
              <select
                value={pendingFilters.category}
                onChange={(event) =>
                  setPendingFilters((prev) => ({
                    ...prev,
                    category: event.target.value
                  }))
                }
                className={`w-full px-4 py-3 rounded-[14px] border focus:outline-none focus:ring-2 transition-all ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white focus:ring-[#FF9357]/25'
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-[#FF7E42]/25'
                }`}
              >
                <option value="">Alle Kategorien</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleResetFilters}
              className={`flex-1 py-3 rounded-[14px] border font-semibold transition-all active:scale-[0.98] ${
                isDark
                  ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Zurücksetzen
            </button>
            <button
              onClick={handleApplyFilters}
              className="flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg transition-all active:scale-[0.98] bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]"
            >
              Filter anwenden
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderSpotCard = (spot, index, options = {}) => {
    const { showRank = false } = options
    const firstPhotoUrl = spot.firstPhotoUrl
    const avgScoreLabel = spot.ratingCount > 0 ? `${formatScore(spot.avgScore)}/10` : '–'
    const ratingCountLabel =
      spot.ratingCount === 1 ? '1 Bewertung' : `${spot.ratingCount} Bewertungen`

    return (
      <button
        key={spot.key}
        onClick={() => handleOpenSpot(spot)}
        className={`w-full rounded-[20px] border transition-all text-left active:scale-[0.98] ${
          isDark
            ? 'bg-gray-900/70 border-gray-800 hover:border-[#FF9357]/40'
            : 'bg-white border-gray-200 hover:border-[#FF7E42]/40 hover:shadow-lg'
        }`}
        style={{ animation: 'fadeSlideUp 0.25s ease both' }}
      >
        <div className="p-4 flex items-center gap-4">
          {showRank && (
            <div
              className={`w-8 text-center font-bold text-xl ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {index + 1}
            </div>
          )}

          <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
            {firstPhotoUrl ? (
              <img src={firstPhotoUrl} alt={spot.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center text-lg ${
                  isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-500'
                }`}
              >
                🍽️
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className={`font-semibold truncate ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {spot.name}
            </p>
            <p className={`text-xs mt-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {(spot.primaryCity || 'Unbekannt') + (spot.primaryCategory ? ` • ${spot.primaryCategory}` : '')}
            </p>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className={`font-semibold ${isDark ? 'text-orange-200' : 'text-orange-600'}`}>
                ⭐ {avgScoreLabel}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {spot.ratingCount > 0 ? ratingCountLabel : 'Noch keine Bewertungen'}
              </span>
              {spot.totalPhotos > 0 && (
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>📷 {spot.totalPhotos}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end justify-between gap-2">
            {spot.latestRatingAt ? (
              <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Zuletzt: {new Date(spot.latestRatingAt).toLocaleDateString('de-DE')}
              </span>
            ) : (
              <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Noch keine Bewertungen</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  const renderSection = (title, subtitle, items, options = {}) => {
    const { showRank = false, highlightNew = false, emptyState } = options

    return (
      <section className="space-y-4">
        <div>
          <h2
            className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {title}
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{subtitle}</p>

          {title === 'Top 10' && activeTab === 'top' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setIsFilterSheetOpen(true)
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                  isDark
                    ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h12M4 12h16M8 18h12" />
                </svg>
                Filter
              </button>

              {hasActiveFilters && (
                <>
                  {filters.city && (
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700 border border-gray-200'
                      }`}
                    >
                      Ort: {filters.city}
                    </span>
                  )}
                  {filters.category && (
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700 border border-gray-200'
                      }`}
                    >
                      Kategorie: {filters.category}
                    </span>
                  )}
                  <button
                    onClick={handleResetFilters}
                    className={`text-xs underline ${
                      isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Filter löschen
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div
            className={`rounded-2xl border p-6 text-center ${
              isDark ? 'bg-gray-900/60 border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            {emptyState || 'Noch keine Einträge verfügbar.'}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((spot, index) => renderSpotCard(spot, index, { showRank, highlightNew }))}
          </div>
        )}
      </section>
    )
  }

  const renderTabContent = () => {
    if (activeTab === 'personal') {
      return renderSection(
        'Für dich',
        'Empfehlungen basierend auf deinen Lieblingskategorien',
        personalizedSpots,
        {
          highlightNew: true,
          emptyState:
            'Noch keine passenden Empfehlungen. Bewerte ein paar Spots, um personalisierte Vorschläge zu erhalten.'
        }
      )
    }

    if (activeTab === 'hot') {
      return renderSection(
        'Neu & Heiß',
        'Neue, aktuell stark bewertete Spots',
        newHotSpots,
        {
          highlightNew: true,
          emptyState: 'Keine neuen privaten Spots im angegebenen Zeitraum.'
        }
      )
    }

    return renderSection(
      'Top 10',
      'Die aktuell bestbewerteten Spots der Community',
      topTenSpots,
      {
        showRank: true,
        emptyState: 'Noch keine Bewertungshighlights verfügbar.'
      }
    )
  }

  const renderSpotModal = () => {
    if (!selectedSpot) return null

    const detail = selectedSpot.detail || {}
    const detailScoreValue = formatScore(selectedSpot.avgScore)
    const detailRatingsCount = selectedSpot.ratingCount || 0
    const detailScoreLabel = detailRatingsCount > 0 ? `${detailScoreValue}/10` : '–'
    const detailLocation = selectedSpot.primaryCity || 'Ort nicht angegeben'
    const detailCategory = selectedSpot.primaryCategory || 'Andere'
    const detailPhotos = detail.photos || []
    const ratingDistribution = detail.ratingDistribution || []
    const latestRatingAt = detail.latestRatingAt
    const visiblePhotos = detailPhotos.slice(0, photoLimit)
    const hasMorePhotos = detailPhotos.length > photoLimit

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60" onClick={closeSpotModal} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 ${
              isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}
            style={{ animation: 'fadeSlideUp 0.3s ease both' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-2xl font-bold"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {selectedSpot.name}
                </h2>
                <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {detailLocation}
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {detailCategory}
                </p>
                {latestRatingAt && (
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Zuletzt bewertet: {new Date(latestRatingAt).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
              <button
                onClick={closeSpotModal}
                className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                  isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'
                }`}
                aria-label="Schließen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <span className={`text-xl font-semibold ${isDark ? 'text-orange-200' : 'text-orange-600'}`}>
                ⭐ {detailScoreLabel}
              </span>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {detailRatingsCount > 0
                  ? `${detailRatingsCount} Bewertung${detailRatingsCount === 1 ? '' : 'en'}`
                  : 'Noch keine Bewertungen'}
              </span>
            </div>

            {ratingDistribution.length > 0 && (
              <div className="mt-6">
                <h3
                  className={`text-sm font-semibold mb-2 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Bewertungsverteilung
                </h3>
                <div className="space-y-2">
                  {ratingDistribution.map((item) => (
                    <div key={item.score} className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ minWidth: '2rem' }}>
                        {item.score}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]"
                          style={{
                            width: `${Math.min(100, detailRatingsCount > 0 ? (item.count / detailRatingsCount) * 100 : 0)}%`
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailPhotos.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className={`text-sm font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Fotos ({detailPhotos.length})
                  </h3>
                  {hasMorePhotos && (
                    <button
                      onClick={() => setPhotoLimit((prev) => prev + 12)}
                      className={`text-xs font-semibold ${
                        isDark ? 'text-orange-200 hover:text-orange-100' : 'text-orange-600 hover:text-orange-500'
                      }`}
                    >
                      Mehr anzeigen
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {visiblePhotos.map((photo) => (
                    <div key={photo.id} className="flex flex-col gap-1">
                      <img
                        src={photo.public_url}
                        alt={selectedSpot.name}
                        className="w-full h-32 sm:h-36 object-cover rounded-2xl"
                        loading="lazy"
                      />
                      <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        von {photo.uploaderName || 'Foodie'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🔍</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt Entdecken...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div
          className={`max-w-sm w-full text-center rounded-3xl border p-8 space-y-4 ${
            isDark ? 'bg-gray-900/70 border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          <div className="text-4xl">⚠️</div>
          <p>{error}</p>
          <button
            onClick={() => fetchDiscoverData({ background: false })}
            className="w-full py-3 rounded-[14px] text-white font-semibold shadow-lg transition-all active:scale-[0.98] bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <header
        className={`border-b sticky top-0 z-20 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h1
              className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Entdecken
            </h1>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Highlights aus der Community</p>
          </div>

          <div className="flex items-center gap-2" />
        </div>

        <div
          className={`px-4 pb-4 pt-2 flex items-center gap-2 rounded-full mx-4 mt-1 ${
            isDark ? 'bg-gray-800/80' : 'bg-white/80 border border-gray-200/70'
          }`}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === activeTab) return
                hapticFeedback.light()
                setActiveTab(tab.key)
              }}
              className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-sm'
                  : isDark
                    ? 'text-gray-300'
                    : 'text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {lastUpdated && (
          <div className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Aktualisiert vor {Math.max(1, Math.round((Date.now() - lastUpdated) / 60000))} Min.
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        <div
          key={activeTab}
          className="px-4 pb-24"
          style={{ animation: 'fadeSlideUp 0.25s ease both' }}
        >
          {renderTabContent()}
        </div>
      </div>

      {activeTab === 'top' && isFilterSheetOpen && renderFilterSheet()}
      {renderSpotModal()}
    </div>
  )
}

export default Discover
