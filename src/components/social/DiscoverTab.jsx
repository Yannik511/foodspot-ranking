import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useProfilesStore } from '../../contexts/ProfileContext'
import { supabase } from '../../services/supabase'
import UserAvatar from './UserAvatar'
import { hapticFeedback } from '../../utils/haptics'

const SECTION_CONFIG = [
  { key: 'trending', label: 'Trending', icon: '🔥' },
  { key: 'highlights', label: 'Highlights', icon: '✨' },
  { key: 'map', label: 'Map', icon: '🗺️' },
  { key: 'challenges', label: 'Challenges', icon: '🎯' }
]

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

const STALE_TIME_MS = 5 * 60 * 1000
const DEBOUNCE_MS = 250
const MAP_FEATURE = { enabled: true, provider: 'static' }
const DEFAULT_CITY_LABEL = 'deiner Stadt'

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max)
const formatScore = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–'
  return value.toFixed(1)
}

const toCityLabel = (value) => {
  if (!value || typeof value !== 'string') return 'Unbekannt'
  const trimmed = value.trim()
  return trimmed.length === 0 ? 'Unbekannt' : trimmed
}

const buildChallengeDefinitions = (primaryCity) => [
  {
    id: 'weekly-doner',
    title: `Bewerte 3 neue Döner in ${primaryCity || DEFAULT_CITY_LABEL}`,
    description: 'Finde lokale Klassiker und teile deine Bewertungen mit der Community.',
    target: 3,
    action: { section: 'trending', category: 'Döner', city: primaryCity || 'all' }
  },
  {
    id: 'photo-plus',
    title: 'Füge 1 Foto zu einem bestehenden Spot hinzu',
    description: 'Visualisiere deine Lieblingsspots – Bilder sagen mehr als Worte.',
    target: 1,
    action: { section: 'trending', category: 'all', city: primaryCity || 'all', intent: 'photos' }
  },
  {
    id: 'category-mix',
    title: 'Erkunde 2 neue Kategorien diese Woche',
    description: 'Stelle deinen Geschmackssinn auf die Probe und probiere neue Kategorien aus.',
    target: 2,
    action: { section: 'trending', category: 'all', city: 'all' }
  }
]

function DiscoverTab() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { ensureProfiles, getProfile } = useProfilesStore()

  const [activeSection, setActiveSection] = useState('trending')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [trendingData, setTrendingData] = useState([])
  const [trendingAllData, setTrendingAllData] = useState([])
  const [availableCategories, setAvailableCategories] = useState(['all'])
  const [availableCities, setAvailableCities] = useState(['all'])

  const [highlightsData, setHighlightsData] = useState(null)
  const [mapData, setMapData] = useState([])
  const [challengesData, setChallengesData] = useState([])
  const [primaryCity, setPrimaryCity] = useState(null)

  const cacheRef = useRef({ base: null })
  const fetchingRef = useRef(false)
  const debounceRef = useRef(null)
  const listsMapRef = useRef(new Map())
  const spotsMapRef = useRef(new Map())
  const isMountedRef = useRef(true)

  const applyPayload = useCallback((payload) => {
    spotsMapRef.current = payload.spotsMap || new Map()
    listsMapRef.current = payload.listsMap || new Map()

    const categories = payload.trendingMeta?.categories || []
    const cities = payload.trendingMeta?.cities || []

    setTrendingData(payload.trending || [])
    setTrendingAllData(payload.trendingAll || [])
    setAvailableCategories(['all', ...categories])
    setAvailableCities(['all', ...cities])
    setHighlightsData(payload.highlights || null)
    setMapData(payload.map || [])
    setChallengesData(payload.challenges?.list || [])
    setPrimaryCity(payload.challenges?.primaryCity || null)

    setCategoryFilter((prev) => {
      if (prev === 'all') return 'all'
      return categories.includes(prev) ? prev : 'all'
    })
    setCityFilter((prev) => {
      if (prev === 'all') return 'all'
      return cities.includes(prev) ? prev : 'all'
    })
  }, [])

  const fetchDiscoverData = useCallback(async ({ background = false, force = false } = {}) => {
    if (!user || fetchingRef.current) return

    const cached = cacheRef.current.base
    const now = Date.now()

    if (!force && cached && now - cached.fetchedAt < STALE_TIME_MS) {
      applyPayload(cached.payload)
      setLoading(false)
      return
    }

    fetchingRef.current = true
    if (!background) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const nowDate = new Date()
      const weekAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      const weekIso = weekAgo.toISOString()
      const monthIso = monthAgo.toISOString()

      const [
        weekRatingsRes,
        weekPhotosRes,
        monthRatingsRes,
        monthPhotosRes,
        createdSpotsRes,
        membershipRes
      ] = await Promise.all([
        supabase
          .from('foodspot_ratings')
          .select('id, foodspot_id, user_id, score, created_at')
          .gte('created_at', weekIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('spot_photos')
          .select('id, spot_id, uploader_user_id, created_at')
          .gte('created_at', weekIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('foodspot_ratings')
          .select('id, foodspot_id, user_id, score, created_at')
          .gte('created_at', monthIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('spot_photos')
          .select('id, spot_id, uploader_user_id, created_at')
          .gte('created_at', monthIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('foodspots')
          .select('id, list_id, user_id, name, category, avg_score, rating, updated_at, created_at, cover_photo_url')
          .gte('created_at', weekIso),
        supabase
          .from('list_members')
          .select('list_id')
          .eq('user_id', user.id)
      ])

      const weekRatings = weekRatingsRes.data || []
      const weekPhotos = weekPhotosRes.data || []
      const monthRatings = monthRatingsRes.data || []
      const monthPhotos = monthPhotosRes.data || []
      const createdSpots = createdSpotsRes.data || []
      const membershipListIds = new Set(membershipRes.data?.map((entry) => entry.list_id) || [])

      const spotIdSet = new Set()
      weekRatings.forEach((rating) => rating.foodspot_id && spotIdSet.add(rating.foodspot_id))
      weekPhotos.forEach((photo) => photo.spot_id && spotIdSet.add(photo.spot_id))
      monthRatings.forEach((rating) => rating.foodspot_id && spotIdSet.add(rating.foodspot_id))
      monthPhotos.forEach((photo) => photo.spot_id && spotIdSet.add(photo.spot_id))
      createdSpots.forEach((spot) => spot.id && spotIdSet.add(spot.id))

      const spotIds = Array.from(spotIdSet)
      let spots = []
      if (spotIds.length > 0) {
        const { data: spotsRes } = await supabase
          .from('foodspots')
          .select('id, list_id, user_id, name, category, avg_score, rating, updated_at, created_at, cover_photo_url')
          .in('id', spotIds)

        spots = spotsRes || []
      }

      const spotsMap = new Map()
      spots.forEach((spot) => spotsMap.set(spot.id, spot))
      createdSpots.forEach((spot) => spotsMap.set(spot.id, spot))

      const listIdSet = new Set()
      spotsMap.forEach((spot) => spot.list_id && listIdSet.add(spot.list_id))
      const listIds = Array.from(listIdSet)
      let lists = []
      if (listIds.length > 0) {
        const { data: listsRes } = await supabase
          .from('lists')
          .select('id, list_name, user_id, city, category, cover_image_url, updated_at, created_at')
          .in('id', listIds)
        lists = listsRes || []
      }
      const listsMap = new Map()
      lists.forEach((list) => listsMap.set(list.id, list))

      const profileIdSet = new Set()
      weekRatings.forEach((rating) => rating.user_id && profileIdSet.add(rating.user_id))
      monthRatings.forEach((rating) => rating.user_id && profileIdSet.add(rating.user_id))
      weekPhotos.forEach((photo) => photo.uploader_user_id && profileIdSet.add(photo.uploader_user_id))
      monthPhotos.forEach((photo) => photo.uploader_user_id && profileIdSet.add(photo.uploader_user_id))
      lists.forEach((list) => list.user_id && profileIdSet.add(list.user_id))

      if (profileIdSet.size > 0) {
        await ensureProfiles(Array.from(profileIdSet))
      }

      const ratingsBySpot = new Map()
      weekRatings.forEach((rating) => {
        if (!rating.foodspot_id) return
        if (!ratingsBySpot.has(rating.foodspot_id)) {
          ratingsBySpot.set(rating.foodspot_id, [])
        }
        ratingsBySpot.get(rating.foodspot_id).push(rating)
      })

      const photosBySpot = new Map()
      weekPhotos.forEach((photo) => {
        if (!photo.spot_id) return
        if (!photosBySpot.has(photo.spot_id)) {
          photosBySpot.set(photo.spot_id, [])
        }
        photosBySpot.get(photo.spot_id).push(photo)
      })

      const trendingEntriesFull = []
      const categorySet = new Set()
      const citySet = new Set()

      const spotKeys = new Set([...ratingsBySpot.keys(), ...photosBySpot.keys()])
      spotKeys.forEach((spotId) => {
        const spot = spotsMap.get(spotId)
        if (!spot) return
        const list = listsMap.get(spot.list_id) || null

        const ratings = (ratingsBySpot.get(spotId) || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        const photos = photosBySpot.get(spotId) || []
        const newRatingCount = ratings.length
        const newPhotoCount = photos.length

        if (newRatingCount === 0 && newPhotoCount === 0) return

        const avgScore = typeof spot.avg_score === 'number'
          ? spot.avg_score
          : (typeof spot.rating === 'number' ? spot.rating : 0)
        const normalizedScore = clamp(avgScore / 10, 0, 1)

        /**
         * Weighted score heuristic:
         * - Neue Bewertungen (letzte 7 Tage) zählen 4 Punkte je Bewertung
         * - Ø-Score (0-10) wird auf 0-1 normalisiert und mit 30 gewichtet
         * - Neue Fotos zählen 2 Punkte je Upload
         * Diese Gewichtung priorisiert aktive Spots mit hoher Qualität + Medien.
         */
        const trendingScore = (newRatingCount * 4) + (normalizedScore * 30) + (newPhotoCount * 2)

        const latestRaters = []
        ratings.forEach((rating) => {
          if (!rating.user_id) return
          if (!latestRaters.includes(rating.user_id)) {
            latestRaters.push(rating.user_id)
          }
        })

        const categoryLabel = spot.category || list?.category || 'Andere'
        const cityLabel = toCityLabel(spot.city || list?.city || null)

        categorySet.add(categoryLabel)
        citySet.add(cityLabel)

        trendingEntriesFull.push({
          spot,
          list,
          avgScore,
          trendingScore,
          newRatingCount,
          newPhotoCount,
          latestRaters,
          categoryLabel,
          cityLabel,
          ratings
        })
      })

      trendingEntriesFull.sort((a, b) => b.trendingScore - a.trendingScore)
      const trendingEntriesTop = trendingEntriesFull.slice(0, 10)

      const contributionsWeek = new Map()
      weekRatings.forEach((rating) => {
        if (!rating.user_id) return
        contributionsWeek.set(rating.user_id, (contributionsWeek.get(rating.user_id) || 0) + 1)
      })
      weekPhotos.forEach((photo) => {
        if (!photo.uploader_user_id) return
        contributionsWeek.set(photo.uploader_user_id, (contributionsWeek.get(photo.uploader_user_id) || 0) + 0.5)
      })

      const contributionsMonth = new Map()
      monthRatings.forEach((rating) => {
        if (!rating.user_id) return
        contributionsMonth.set(rating.user_id, (contributionsMonth.get(rating.user_id) || 0) + 1)
      })
      monthPhotos.forEach((photo) => {
        if (!photo.uploader_user_id) return
        contributionsMonth.set(photo.uploader_user_id, (contributionsMonth.get(photo.uploader_user_id) || 0) + 0.5)
      })

      const getTopContributor = (map) => {
        let maxValue = -Infinity
        let maxUserId = null
        map.forEach((value, key) => {
          if (value > maxValue) {
            maxValue = value
            maxUserId = key
          }
        })
        return maxUserId ? { userId: maxUserId, value: maxValue } : null
      }

      const pickTopSpotsForUser = (userId, sourceRatings, limit = 3) => {
        if (!userId) return []
        const seen = new Set()
        const picks = []
        sourceRatings
          .filter((rating) => rating.user_id === userId)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .forEach((rating) => {
            if (picks.length >= limit) return
            const spot = spotsMap.get(rating.foodspot_id)
            if (!spot || seen.has(spot.id)) return
            const list = listsMap.get(spot.list_id) || null
            seen.add(spot.id)
            picks.push({
              spot,
              score: rating.score,
              cityLabel: toCityLabel(spot.city || list?.city || null),
              categoryLabel: spot.category || list?.category || 'Andere'
            })
          })
        return picks
      }

      const spotlightUser = getTopContributor(contributionsWeek)
      const foodieUser = getTopContributor(contributionsMonth)

      const highlights = {
        spotlight: spotlightUser
          ? {
              userId: spotlightUser.userId,
              contributions: Math.round(spotlightUser.value),
              topSpots: pickTopSpotsForUser(spotlightUser.userId, monthRatings),
              teaser: `${Math.round(spotlightUser.value)} neue Beiträge in dieser Woche.`
            }
          : null,
        foodie: foodieUser
          ? {
              userId: foodieUser.userId,
              contributions: Math.round(foodieUser.value),
              topSpots: pickTopSpotsForUser(foodieUser.userId, monthRatings),
              teaser: `${Math.round(foodieUser.value)} Aktivitäten in den letzten 30 Tagen.`
            }
          : null,
        topLists: (() => {
          const growthMap = new Map()
          weekRatings.forEach((rating) => {
            const spot = spotsMap.get(rating.foodspot_id)
            if (!spot?.list_id) return
            if (!growthMap.has(spot.list_id)) {
              growthMap.set(spot.list_id, { ratings: 0, newSpots: 0 })
            }
            growthMap.get(spot.list_id).ratings += 1
          })
          createdSpots.forEach((spot) => {
            if (!spot.list_id) return
            if (!growthMap.has(spot.list_id)) {
              growthMap.set(spot.list_id, { ratings: 0, newSpots: 0 })
            }
            growthMap.get(spot.list_id).newSpots += 1
          })
          return Array.from(growthMap.entries())
            .map(([listId, stats]) => {
              const list = listsMap.get(listId)
              if (!list) return null
              const growthScore = stats.ratings + stats.newSpots * 1.5
              return {
                list,
                stats,
                growthScore
              }
            })
            .filter(Boolean)
            .sort((a, b) => b.growthScore - a.growthScore)
            .slice(0, 5)
        })()
      }

      const activeCityBuckets = new Map()
      spotKeys.forEach((spotId) => {
        const spot = spotsMap.get(spotId)
        if (!spot) return
        const list = listsMap.get(spot.list_id) || null
        const cityLabel = toCityLabel(spot.city || list?.city || null)
        if (!activeCityBuckets.has(cityLabel)) {
          activeCityBuckets.set(cityLabel, {
            city: cityLabel,
            spots: [],
            categories: new Map()
          })
        }
        const bucket = activeCityBuckets.get(cityLabel)
        bucket.spots.push(spot)
        const categoryLabel = spot.category || list?.category || 'Andere'
        bucket.categories.set(categoryLabel, (bucket.categories.get(categoryLabel) || 0) + 1)
      })

      const mapCards = Array.from(activeCityBuckets.values())
        .map((bucket) => {
          const categoriesSorted = Array.from(bucket.categories.entries()).sort((a, b) => b[1] - a[1])
          return {
            city: bucket.city,
            spotCount: bucket.spots.length,
            topCategories: categoriesSorted.slice(0, 3),
            sampleSpots: bucket.spots.slice(0, 3)
          }
        })
        .sort((a, b) => b.spotCount - a.spotCount)
        .slice(0, 6)

      const userWeekRatings = weekRatings.filter((rating) => rating.user_id === user.id)
      const userWeekPhotos = weekPhotos.filter((photo) => photo.uploader_user_id === user.id)

      const cityCounts = new Map()
      userWeekRatings.forEach((rating) => {
        const spot = spotsMap.get(rating.foodspot_id)
        if (!spot) return
        const list = listsMap.get(spot.list_id) || null
        const label = toCityLabel(spot.city || list?.city || null)
        cityCounts.set(label, (cityCounts.get(label) || 0) + 1)
      })
      const mostActiveCity = Array.from(cityCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null

      const challengeBase = buildChallengeDefinitions(mostActiveCity)

      const challengeProgress = challengeBase.map((challenge) => {
        if (challenge.id === 'weekly-doner') {
          const uniqueDonerSpots = new Set()
          userWeekRatings.forEach((rating) => {
            const spot = spotsMap.get(rating.foodspot_id)
            if (!spot) return
            const list = listsMap.get(spot.list_id) || null
            const categoryLabel = spot.category || list?.category || null
            if (categoryLabel !== 'Döner') return
            const cityLabel = toCityLabel(spot.city || list?.city || null)
            if (challenge.action.city !== 'all' && cityLabel !== challenge.action.city) return
            uniqueDonerSpots.add(spot.id)
          })
          return { ...challenge, current: uniqueDonerSpots.size }
        }
        if (challenge.id === 'photo-plus') {
          return { ...challenge, current: userWeekPhotos.length }
        }
        if (challenge.id === 'category-mix') {
          const visitedCategories = new Set()
          userWeekRatings.forEach((rating) => {
            const spot = spotsMap.get(rating.foodspot_id)
            if (!spot) return
            const list = listsMap.get(spot.list_id) || null
            const categoryLabel = spot.category || list?.category
            if (!categoryLabel) return
            visitedCategories.add(categoryLabel)
          })
          return { ...challenge, current: visitedCategories.size }
        }
        return { ...challenge, current: 0 }
      })

      const payload = {
        trending: trendingEntriesTop,
        trendingAll: trendingEntriesFull,
        trendingMeta: {
          categories: Array.from(categorySet).sort(),
          cities: Array.from(citySet).sort()
        },
        highlights,
        map: mapCards,
        challenges: {
          list: challengeProgress,
          primaryCity: mostActiveCity
        },
        listsMap,
        spotsMap
      }

      cacheRef.current.base = {
        fetchedAt: Date.now(),
        payload
      }

      if (isMountedRef.current) {
        applyPayload(payload)
        setLoading(false)
      }
    } catch (error) {
      console.error('[DiscoverTab] Fehler beim Laden der Daten:', error)
    } finally {
      fetchingRef.current = false
      if (isMountedRef.current) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [user, ensureProfiles, applyPayload])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const cached = cacheRef.current.base
    const now = Date.now()

    if (cached && now - cached.fetchedAt < STALE_TIME_MS) {
      applyPayload(cached.payload)
      setLoading(false)
      fetchDiscoverData({ background: true, force: true })
    } else {
      fetchDiscoverData()
    }
  }, [user, fetchDiscoverData, applyPayload])

  useEffect(() => {
    if (!user) return
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      fetchDiscoverData({ background: true, force: true })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [categoryFilter, cityFilter, user, fetchDiscoverData])

  const filteredTrending = useMemo(() => {
    return trendingData.filter((entry) => {
      const categoryMatch = categoryFilter === 'all' || entry.categoryLabel === categoryFilter
      const cityMatch = cityFilter === 'all' || entry.cityLabel === cityFilter
      return categoryMatch && cityMatch
    })
  }, [trendingData, categoryFilter, cityFilter])

  const handleNavigateToSpot = useCallback((spot) => {
    if (!spot?.list_id) return
    const list = listsMapRef.current.get(spot.list_id)
    const isSharedList = list?.user_id && user && list.user_id !== user.id
    const basePath = isSharedList ? '/shared/tierlist' : '/tierlist'
    navigate(`${basePath}/${spot.list_id}`, { state: { focusSpotId: spot.id } })
  }, [navigate, user])

  const handleListNavigate = useCallback((listId) => {
    const list = listsMapRef.current.get(listId)
    if (!list) return
    const isSharedList = list.user_id && user && list.user_id !== user.id
    const basePath = isSharedList ? '/shared/tierlist' : '/tierlist'
    navigate(`${basePath}/${listId}`)
  }, [navigate, user])

  const handleChallengeNavigate = (challenge) => {
    if (!challenge?.action) return
    hapticFeedback.light()
    if (challenge.action.section) {
      setActiveSection(challenge.action.section)
    }
    if (typeof challenge.action.category === 'string') {
      setCategoryFilter(challenge.action.category)
    }
    if (typeof challenge.action.city === 'string') {
      setCityFilter(challenge.action.city)
    }
  }

  const renderLoadingState = (label = 'Lädt Entdecken...') => (
    <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="text-center">
        <div className="text-4xl mb-4 animate-bounce">🔍</div>
        <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>{label}</p>
      </div>
    </div>
  )

  const renderEmptyState = (icon, title, description) => (
    <div className={`text-center py-12 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
      <div className="text-4xl mb-4">{icon}</div>
      <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
      <p className="text-xs">{description}</p>
    </div>
  )

  const renderAvatarStack = (userIds) => {
    if (!userIds || userIds.length === 0) {
      return (
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Noch keine Bewertungen
        </span>
      )
    }
    const maxVisible = 4
    const visibleIds = userIds.slice(0, maxVisible)
    const overflow = userIds.length - visibleIds.length
    return (
      <div className="flex items-center gap-1">
        <div className="flex -space-x-2">
          {visibleIds.map((id) => (
            <UserAvatar
              key={id}
              userId={id}
              size={28}
              className="border-2 border-gray-900/80 dark:border-gray-900"
            />
          ))}
        </div>
        {overflow > 0 && (
          <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-700'
          }`}>
            +{overflow}
          </div>
        )}
      </div>
    )
  }

  const renderTrending = () => {
    if (loading) return renderLoadingState()

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => (
            <button
              key={`category-${category}`}
              onClick={() => {
                hapticFeedback.light()
                setCategoryFilter(category)
              }}
              className={`px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                categoryFilter === category
                  ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-md'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'Alle Kategorien' : `${CATEGORY_EMOJIS[category] || '🍽️'} ${category}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {availableCities.map((city) => (
            <button
              key={`city-${city}`}
              onClick={() => {
                hapticFeedback.light()
                setCityFilter(city)
              }}
              className={`px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                cityFilter === city
                  ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-md'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {city === 'all' ? 'Alle Städte' : city}
            </button>
          ))}
        </div>

        {isRefreshing && (
          <div className={`text-xs flex items-center gap-2 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <span className="inline-block w-2 h-2 rounded-full bg-[#FF7E42] animate-pulse" />
            Aktualisiere Daten...
          </div>
        )}

        {filteredTrending.length === 0
          ? renderEmptyState('🍽️', 'Noch keine Trends', 'Sobald neue Bewertungen eintreffen, erscheinen sie hier.')
          : (
            <div className="space-y-4">
              {filteredTrending.map((entry) => (
                <div
                  key={entry.spot.id}
                  className={`rounded-[20px] border transition-all hover:translate-y-[-2px] ${
                    isDark
                      ? 'bg-gray-900/70 border-gray-800 hover:border-[#FF9357]/40'
                      : 'bg-white border-gray-200 hover:border-[#FF7E42]/40 hover:shadow-lg'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-base font-semibold truncate ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                          {entry.spot.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-full ${
                            isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {CATEGORY_EMOJIS[entry.spot.category] || '🍽️'} {entry.categoryLabel}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {entry.cityLabel}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            isDark ? 'bg-gray-800 text-orange-300' : 'bg-orange-100 text-orange-600'
                          }`}>
                            Ø {formatScore(entry.avgScore)}/10
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-semibold uppercase tracking-wide ${
                          isDark ? 'text-orange-300' : 'text-orange-500'
                        }`}>
                          diese Woche
                        </div>
                        <div className={`text-lg font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          🔥 {Math.round(entry.trendingScore)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-600'
                      }`}>
                        +{entry.newRatingCount} neue Bewertungen
                      </span>
                      {entry.newPhotoCount > 0 && (
                        <span className={`px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-600'
                        }`}>
                          📷 +{entry.newPhotoCount} Fotos
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      {renderAvatarStack(entry.latestRaters)}
                      <button
                        onClick={() => {
                          hapticFeedback.light()
                          handleNavigateToSpot(entry.spot)
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
                          isDark
                            ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C] text-white'
                            : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white'
                        }`}
                      >
                        Spot öffnen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    )
  }

  const renderHighlights = () => {
    if (loading) return renderLoadingState('Highlights werden geladen...')

    if (!highlightsData) {
      return renderEmptyState('✨', 'Noch keine Highlights', 'Sobald genügend Daten vorliegen, werden Highlights angezeigt.')
    }

    const { spotlight, foodie, topLists } = highlightsData

    const renderHighlightCard = (highlight, label, accentIcon) => {
      if (!highlight) return null
      const profile = getProfile(highlight.userId)
      const username = profile?.username || 'Foodie'
      return (
        <div
          className={`rounded-[20px] border transition-all hover:translate-y-[-2px] ${
            isDark
              ? 'bg-gray-900/70 border-gray-800 hover:border-[#FF9357]/40'
              : 'bg-white border-gray-200 hover:border-[#FF7E42]/40 hover:shadow-lg'
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar userId={highlight.userId} size={44} />
                <div>
                  <p className={`text-sm font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {username}
                  </p>
                  <p className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {label}
                  </p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isDark ? 'bg-gray-800 text-orange-300' : 'bg-orange-100 text-orange-600'
              }`}>
                {accentIcon} {Math.round(highlight.contributions)} Punkte
              </div>
            </div>

            <p className={`text-xs mt-3 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {highlight.teaser}
            </p>

            {highlight.topSpots.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {highlight.topSpots.map((item) => (
                  <button
                    key={item.spot.id}
                    onClick={() => {
                      hapticFeedback.light()
                      handleNavigateToSpot(item.spot)
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {item.spot.cover_photo_url ? (
                      <img
                        src={item.spot.cover_photo_url}
                        alt={item.spot.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`}>
                        <span>{CATEGORY_EMOJIS[item.spot.category] || '🍽️'}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {item.spot.name}
                      </p>
                      <p className={`text-[11px] truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {item.cityLabel} • Ø {formatScore(item.score)}/10
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {renderHighlightCard(spotlight, 'Spotlight der Woche', '⭐')}
        {renderHighlightCard(foodie, 'Foodie des Monats', '🏆')}

        <div>
          <h3 className={`text-sm font-semibold mb-3 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Neue Top-Listen
          </h3>
          {topLists && topLists.length > 0 ? (
            <div className="space-y-3">
              {topLists.map(({ list, stats }) => (
                <button
                  key={list.id}
                  onClick={() => {
                    hapticFeedback.light()
                    handleListNavigate(list.id)
                  }}
                  className={`w-full text-left p-4 rounded-[16px] transition-all ${
                    isDark ? 'bg-gray-900/70 hover:bg-gray-800' : 'bg-white hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {list.list_name}
                      </p>
                      <p className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {toCityLabel(list.city)} • {list.category || 'Gemischt'}
                      </p>
                    </div>
                    <div className={`text-xs px-3 py-1 rounded-full ${
                      isDark ? 'bg-gray-800 text-orange-300' : 'bg-orange-100 text-orange-600'
                    }`}>
                      +{stats.newSpots} neue Spots • +{stats.ratings} Bewertungen
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            renderEmptyState('📝', 'Keine neuen Listen', 'Sobald neue Listen durchstarten, erscheinen sie hier.')
          )}
        </div>
      </div>
    )
  }

  const renderMap = () => {
    if (!MAP_FEATURE.enabled) {
      return renderEmptyState('🗺️', 'Map deaktiviert', 'Die Map-Funktion ist aktuell ausgeschaltet.')
    }

    if (loading) return renderLoadingState('Map wird vorbereitet...')

    if (!mapData || mapData.length === 0) {
      return renderEmptyState('🗺️', 'Noch keine Hotspots', 'Sobald neue Aktivitäten vorliegen, erscheinen hier Karten.')
    }

    return (
      <div className="space-y-4">
        {mapData.map((entry) => (
          <button
            key={entry.city}
            onClick={() => {
              hapticFeedback.light()
              setActiveSection('trending')
              setCityFilter(entry.city)
              setCategoryFilter('all')
            }}
            className={`w-full rounded-[20px] overflow-hidden border transition-all text-left ${
              isDark ? 'border-gray-800 bg-gray-900/70 hover:border-[#FF9357]/40' : 'border-gray-200 bg-white hover:border-[#FF7E42]/40 hover:shadow-lg'
            }`}
          >
            <div className="relative h-44">
              <div className={`absolute inset-0 ${
                isDark
                  ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800'
                  : 'bg-gradient-to-br from-[#EEF2FF] via-[#FFE4C3] to-[#FFD4A3]'
              }`} />
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    isDark ? 'bg-gray-900/70 text-orange-200' : 'bg-white/80 text-orange-600'
                  }`}>
                    {MAP_FEATURE.provider === 'static' ? 'Static Preview' : MAP_FEATURE.provider}
                  </div>
                  <h3 className={`mt-4 text-xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {entry.city}
                  </h3>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {entry.spotCount} aktive Top-Spots • Top Kategorien: {entry.topCategories.map(([category]) => category).join(', ')}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {entry.sampleSpots.map((spot) => (
                      <div
                        key={spot.id}
                        className={`w-10 h-10 rounded-full border ${
                          isDark ? 'border-gray-900 bg-gray-800' : 'border-white bg-white'
                        } flex items-center justify-center`}
                      >
                        {spot.cover_photo_url ? (
                          <img
                            src={spot.cover_photo_url}
                            alt={spot.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span>{CATEGORY_EMOJIS[spot.category] || '🍽️'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className={`text-xs font-semibold ${
                    isDark ? 'text-orange-200' : 'text-orange-600'
                  }`}>
                    Tippen für Filter →
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  const renderChallenges = () => {
    if (loading) return renderLoadingState('Challenges werden geladen...')

    if (!challengesData || challengesData.length === 0) {
      return renderEmptyState('🎯', 'Keine Challenges verfügbar', 'Bald gibt es neue Aufgaben für dich.')
    }

    return (
      <div className="space-y-4">
        {challengesData.map((challenge) => {
          const progressRatio = clamp(challenge.current / challenge.target)
          return (
            <div
              key={challenge.id}
              className={`rounded-[20px] border p-4 ${
                isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sm font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {challenge.title}
                  </h3>
                  <p className={`text-xs mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {challenge.description}
                  </p>
                </div>
                <div className={`text-xs font-semibold ${
                  isDark ? 'text-orange-200' : 'text-orange-600'
                }`}>
                  {challenge.current}/{challenge.target}
                </div>
              </div>

              <div className="mt-3">
                <div className={`h-2 rounded-full overflow-hidden ${
                  isDark ? 'bg-gray-800' : 'bg-gray-200'
                }`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]"
                    style={{ width: `${progressRatio * 100}%`, transition: 'width 200ms ease-out' }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className={`text-[11px] ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Fortschritt lokal gespeichert · Kein Einfluss auf RLS
                </p>
                <button
                  onClick={() => handleChallengeNavigate(challenge)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Fortschritt anzeigen
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'trending':
        return renderTrending()
      case 'highlights':
        return renderHighlights()
      case 'map':
        return renderMap()
      case 'challenges':
        return renderChallenges()
      default:
        return null
    }
  }

  if (loading && (!cacheRef.current.base || !cacheRef.current.base.payload)) {
    return renderLoadingState()
  }

  return (
    <div className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="px-4 pt-4 pb-24 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Entdecken
            </h2>
            <p className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Inspiration aus Trending-Spots, Highlights und Community-Challenges
            </p>
          </div>
          <button
            onClick={() => {
              hapticFeedback.light()
              fetchDiscoverData({ force: true })
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all ${
              isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Daten aktualisieren"
          >
            ⟲
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {SECTION_CONFIG.map((section) => (
            <button
              key={section.key}
              onClick={() => {
                hapticFeedback.light()
                setActiveSection(section.key)
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSection === section.key
                  ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-md'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#FF7E42]/40'
              }`}
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>

        {renderSection()}
      </div>
    </div>
  )
}

export default DiscoverTab
