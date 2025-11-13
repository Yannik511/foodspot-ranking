import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import UserAvatar from '../components/social/UserAvatar'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'
import { useProfilesStore } from '../contexts/ProfileContext'

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
  'Bier': '🍺',
  'Leberkässemmel': '🥪'
}

function FriendProfile() {
  const { id } = useParams()
  const { user: currentUser } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { ensureProfiles, upsertProfiles } = useProfilesStore()
  const [friendUser, setFriendUser] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  
  const [stats, setStats] = useState({
    totalSpots: 0,
    totalCities: 0,
    totalLists: 0,
    averageScore: 0,
    topCategory: null,
    topCategories: [],
    mostVisitedCity: null,
    tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
    categoryCounts: {},
    topCities: [],
    topSpots: [],
    recentSpots: [],
    cityHeatmap: [],
    topSharedSpots: [],
    topSharedLists: []
  })
  const [error, setError] = useState(null)
  const [isFriend, setIsFriend] = useState(false)
  const [friendProfileVisibility, setFriendProfileVisibility] = useState('private')
  const [canViewStats, setCanViewStats] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!id || !currentUser) return
    ensureProfiles([id, currentUser.id])
    fetchFriendProfile()
  }, [id, currentUser, ensureProfiles])

  const fetchFriendProfile = async () => {
    if (!refreshing) setLoading(true)
    try {
      // Check friendship status
      const { data: friendshipData } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${currentUser.id})`)
        .maybeSingle()

      const isAcceptedFriend = friendshipData?.status === 'accepted' && 
        (friendshipData.requester_id === currentUser.id || friendshipData.addressee_id === currentUser.id)
      
      setIsFriend(isAcceptedFriend)
      
      if (friendshipData) {
        setFriendship(friendshipData)
      }

      // Fetch friend user profile using function or view
      let friendProfile = null
      let visibility = 'private'
      try {
        const { data: profileData } = await supabase.rpc('get_user_profile', { user_id: id })
        if (profileData && profileData.length > 0) {
          visibility = profileData[0].profile_visibility || 'private'
          friendProfile = {
            id: profileData[0].id,
            email: profileData[0].email,
            user_metadata: {
              username: profileData[0].username,
              profileImageUrl: profileData[0].profile_image_url,
              profile_visibility: visibility
            },
            created_at: profileData[0].created_at
          }
        }
      } catch (err) {
        console.warn('Could not fetch user profile via function, trying view')
        // Fallback: try to get from user_profiles view
        try {
          const { data: viewData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', id)
            .single()
          
          if (viewData) {
            visibility = viewData.profile_visibility || 'private'
            friendProfile = {
              id: viewData.id,
              email: viewData.email,
              user_metadata: {
                username: viewData.username,
                profileImageUrl: viewData.profile_image_url,
                profile_visibility: visibility
              },
              created_at: viewData.created_at
            }
          }
        } catch (viewErr) {
          console.warn('Could not fetch user profile')
        }
      }

      if (!friendProfile) {
        friendProfile = { id, user_metadata: {} }
      }
      
      setFriendUser(friendProfile)
      upsertProfiles([{
        id: friendProfile.id,
        profile_image_url: friendProfile.user_metadata?.profileImageUrl,
        username: friendProfile.user_metadata?.username,
        profile_visibility: friendProfile.user_metadata?.profile_visibility
      }])
      setFriendProfileVisibility(visibility)
      
      // Check if we can view stats: must be accepted friend AND profile visibility must be 'friends'
      const canView = isAcceptedFriend && visibility === 'friends'
      setCanViewStats(canView)

      // Only fetch detailed stats if user is a friend AND profile is visible to friends
      if (!canView) {
        setStats({
          totalSpots: 0,
          totalCities: 0,
          totalLists: 0,
          averageScore: 0,
          topCategory: null,
          topCategories: [],
          mostVisitedCity: null,
          tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
          categoryCounts: {},
          topCities: [],
          topSpots: [],
          recentSpots: [],
          cityHeatmap: [],
          topSharedSpots: [],
          topSharedLists: []
        })
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Fetch aggregated stats using RPC function (server-side aggregation, better performance)
      const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', {
        target_user_id: id
      })

      if (statsError) {
        console.error('Error fetching user stats:', statsError)
        setError('Fehler beim Laden der Statistiken')
        throw statsError
      }
      
      setError(null)

      // Parse the aggregated stats from JSON
      const stats = statsData || {
        total_spots: 0,
        total_lists: 0,
        total_cities: 0,
        avg_score: 0,
        most_visited_city: { city: null, count: 0 },
        top_category: { category: null, count: 0, percentage: 0 },
        top_categories: [],
        recent_spots: [],
        top_spots: []
      }

      // Fetch Top 5 Shared Spots (where friend is a participant)
      let topSharedSpots = []
      try {
        const { data: sharedSpotsData, error: sharedError } = await supabase
          .from('foodspot_ratings')
          .select(`
            foodspot_id,
            score,
            foodspots!inner (
              id,
              name,
              category,
              address,
              avg_score,
              cover_photo_url,
              lists!inner (
                id,
                list_name,
                city
              )
            )
          `)
          .eq('user_id', id)
          .not('foodspots.lists.user_id', 'eq', id)
          .order('score', { ascending: false })
          .limit(5)

        if (!sharedError && sharedSpotsData) {
          topSharedSpots = sharedSpotsData
            .filter(item => item.foodspots && item.foodspots.lists)
            .map(item => ({
              id: item.foodspots.id,
              name: item.foodspots.name,
              category: item.foodspots.category,
              address: item.foodspots.address,
              city: item.foodspots.lists.city,
              avgScore: item.foodspots.avg_score || item.score,
              userScore: item.score,
              cover_photo_url: item.foodspots.cover_photo_url,
              list_name: item.foodspots.lists.list_name,
              list_id: item.foodspots.lists.id
            }))
        }
      } catch (err) {
        console.error('Error fetching shared spots:', err)
      }

      // Fetch Top 5 Shared Lists (where friend is owner or editor, but NOT private lists)
      let topSharedLists = []
      try {
        // First, get all lists where the friend is a member
        const { data: sharedListsData, error: listsError } = await supabase
          .from('list_members')
          .select(`
            list_id,
            role,
            lists!inner (
              id,
              list_name,
              city,
              cover_photo_url,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', id)
          .order('lists(updated_at)', { ascending: false })
          .limit(20) // Fetch more to filter later

        if (!listsError && sharedListsData && sharedListsData.length > 0) {
          const listIds = sharedListsData.map(item => item.lists.id)
          
          // Fetch all members for these lists to determine which are truly shared
          const { data: membersData } = await supabase
            .from('list_members')
            .select('list_id, user_id, role')
            .in('list_id', listIds)

          // Fetch spot count and avg score for each list
          const { data: spotStatsData } = await supabase
            .from('foodspots')
            .select('list_id, avg_score')
            .in('list_id', listIds)

          // Filter: Only lists with MORE than 1 member (= truly shared)
          const sharedListsOnly = sharedListsData
            .filter(item => {
              const listMembers = membersData?.filter(m => m.list_id === item.lists.id) || []
              return listMembers.length > 1 // Must have at least 2 members
            })
            .slice(0, 5) // Take top 5

          topSharedLists = sharedListsOnly.map(item => {
            const listMembers = membersData?.filter(m => m.list_id === item.lists.id) || []
            const listSpots = spotStatsData?.filter(s => s.list_id === item.lists.id) || []
            const avgScore = listSpots.length > 0
              ? listSpots.reduce((sum, s) => sum + (s.avg_score || 0), 0) / listSpots.length
              : 0

            return {
              id: item.lists.id,
              list_name: item.lists.list_name,
              city: item.lists.city,
              cover_photo_url: item.lists.cover_photo_url,
              role: item.role,
              spotCount: listSpots.length,
              avgScore: avgScore,
              members: listMembers,
              updated_at: item.lists.updated_at,
              created_at: item.lists.created_at
            }
          })
        }
      } catch (err) {
        console.error('Error fetching shared lists:', err)
      }

      // Transform server-side stats to component state format
      setStats({
        totalSpots: stats.total_spots || 0,
        totalCities: stats.total_cities || 0,
        totalLists: stats.total_lists || 0,
        averageScore: stats.avg_score || 0,
        topCategory: stats.top_category?.category || null,
        topCategories: stats.top_categories || [],
        mostVisitedCity: stats.most_visited_city || null,
        tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 }, // Not in RPC, will calculate if needed
        categoryCounts: {}, // Not in RPC, will calculate if needed
        topCities: [],
        topSpots: (stats.top_spots || []).map(spot => ({
          ...spot,
          city: spot.city || ''
        })),
        recentSpots: (stats.recent_spots || []).map(spot => ({
          ...spot,
          city: spot.city || ''
        })),
        cityHeatmap: [],
        topSharedSpots,
        topSharedLists
      })
    } catch (error) {
      console.error('Error fetching friend profile:', error)
      setError('Fehler beim Laden des Profils')
      if (!refreshing) {
        showToast('Fehler beim Laden des Profils', 'error')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  const handleRetry = () => {
    setError(null)
    fetchFriendProfile()
  }

  const handlePullToRefresh = async () => {
    setRefreshing(true)
    await fetchFriendProfile()
  }

  const getUsername = (userData) => {
    return userData?.user_metadata?.username || userData?.email?.split('@')[0] || 'Unbekannt'
  }

  const getMemberSince = (userData) => {
    if (!userData?.created_at) return ''
    const date = new Date(userData.created_at)
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const getFriendshipDate = () => {
    if (!friendship?.created_at) return ''
    const date = new Date(friendship.created_at)
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const handleRemoveFriend = async () => {
    if (!friendship) return
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendship.id)

      if (error) throw error

      hapticFeedback.light()
      showToast('Freund entfernt', 'success')
      navigate('/social')
    } catch (error) {
      console.error('Error removing friend:', error)
      showToast('Fehler beim Entfernen', 'error')
    }
  }

  const handleCompare = () => {
    if (canViewStats) {
      navigate(`/compare/${id}`)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSpotClick = (spot) => {
    if (spot.list_id) {
      navigate(`/tierlist/${spot.list_id}`)
    }
  }

  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <header className={`border-b sticky top-0 z-20 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <div className={`h-6 w-20 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <div className="w-10" />
        </div>
      </header>
      <main className="px-4 py-6 space-y-6">
        <div className={`rounded-[24px] p-8 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className={`w-24 h-24 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="flex-1 space-y-3 w-full">
              <div className={`h-8 w-32 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-4 w-24 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-4 w-40 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`rounded-[20px] p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`h-8 w-12 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <div className={`h-4 w-20 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )

  if (loading) {
    return <SkeletonLoader />
  }

  if (!friendUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Profil nicht gefunden</p>
          <button
            onClick={() => navigate('/social')}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white rounded-lg"
          >
            Zurück
          </button>
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
            onClick={() => navigate('/social')}
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

          <div className="w-10" />
        </div>
      </header>

      {/* Main Content with Pull-to-Refresh */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        {refreshing && (
          <div className="text-center py-2 sticky top-0 z-10">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
          </div>
        )}
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Hero Section */}
          <div className={`rounded-[24px] shadow-lg border p-8 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <UserAvatar user={friendUser} size={100} />
              <div className="flex-1 text-center sm:text-left">
                <h2 className={`text-2xl font-bold mb-1 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {getUsername(friendUser)}
                </h2>
                <p className={`text-sm mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  @{getUsername(friendUser).toLowerCase().replace(/\s+/g, '')}
                </p>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Mitglied seit {getMemberSince(friendUser)}
                </p>
                {friendship && (
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Freund seit {getFriendshipDate()}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mt-6">
              <button
                onClick={handleCompare}
                disabled={!canViewStats}
                className={`w-full px-4 py-3 rounded-[16px] font-semibold text-base transition-all active:scale-[0.98] ${
                  canViewStats
                    ? isDark
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    : isDark
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                }`}
              >
                Vergleichen
              </button>
              {friendship && (
                <button
                  onClick={handleRemoveFriend}
                  className={`w-full px-4 py-3 rounded-[16px] font-semibold text-base transition-all active:scale-[0.98] ${
                    isDark
                      ? 'bg-red-900/30 text-red-400 hover:bg-red-900/40'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  Freund entfernen
                </button>
              )}
            </div>
          </div>

          {/* Restricted View for Non-Friends or Private Profile */}
          {(!isFriend || !canViewStats) && (
            <div className={`rounded-[24px] shadow-lg border p-8 text-center ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="text-4xl mb-4">🔒</div>
              <h3 className={`text-lg font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {!isFriend 
                  ? 'Nur sichtbar für Freund:innen'
                  : 'Profil ist privat'}
              </h3>
              <p className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {!isFriend
                  ? 'Diese Person muss deine Freundschaftsanfrage annehmen, damit du ihre Statistiken sehen kannst.'
                  : 'Diese Person hat die Sichtbarkeit ihrer Statistiken auf privat gesetzt.'}
              </p>
            </div>
          )}

          {/* KPI Cards - Only visible if friend AND profile is visible */}
          {canViewStats && !loading && !error && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className={`rounded-[20px] shadow-lg border p-4 min-h-[88px] flex flex-col justify-center ${
                  isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className={`text-2xl font-bold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stats.totalSpots}
                  </div>
                  <div className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Gesamte Spots
                  </div>
                </div>

                <div className={`rounded-[20px] shadow-lg border p-4 min-h-[88px] flex flex-col justify-center ${
                  isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className={`text-2xl font-bold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stats.totalCities}
                  </div>
                  <div className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Städte/Orte
                  </div>
                </div>

                <div className={`rounded-[20px] shadow-lg border p-4 min-h-[88px] flex flex-col justify-center ${
                  isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className={`text-2xl font-bold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stats.totalLists}
                  </div>
                  <div className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Listen
                  </div>
                </div>

                <div className={`rounded-[20px] shadow-lg border p-4 min-h-[88px] flex flex-col justify-center ${
                  isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className={`text-2xl font-bold mb-1 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stats.averageScore.toFixed(1)}/10
                  </div>
                  <div className={`text-xs ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Ø Score
                  </div>
                </div>
              </div>

            </>
          )}

          {/* Error State */}
          {error && canViewStats && (
            <div className={`rounded-[24px] shadow-lg border p-8 text-center ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className={`text-lg font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {error}
              </h3>
              <button
                onClick={handleRetry}
                className={`mt-4 px-6 py-2 rounded-xl font-medium transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Erneut versuchen
              </button>
            </div>
          )}

          {/* Top-Kategorien Card - Only if stats are visible and not loading */}
          {canViewStats && !loading && !error && stats.topCategories && stats.topCategories.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Top-Kategorien
              </h3>
              <div className="flex flex-wrap gap-3">
                {stats.topCategories.map((categoryData) => (
                  <div
                    key={categoryData.category}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full ${
                      isDark
                        ? 'bg-gray-700'
                        : 'bg-gray-100'
                    }`}
                  >
                    <span className="text-xl">{CATEGORY_EMOJIS[categoryData.category] || '🍔'}</span>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold ${
                        isDark ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {categoryData.category}
                      </span>
                      <span className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {categoryData.percentage}% · {categoryData.count} {categoryData.count === 1 ? 'Spot' : 'Spots'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zuletzt bewertet Card - Only if stats are visible and not loading */}
          {canViewStats && !loading && !error && stats.recentSpots && stats.recentSpots.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Zuletzt bewertet
              </h3>
              <div className="space-y-3">
                {stats.recentSpots.slice(0, 5).map((spot) => {
                  const date = new Date(spot.updated_at || spot.created_at)
                  const dateStr = date.toLocaleDateString('de-DE', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  })
                  
                  return (
                    <button
                      key={spot.id}
                      onClick={() => handleSpotClick(spot)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
                        isDark
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {spot.cover_photo_url ? (
                        <img
                          src={spot.cover_photo_url}
                          alt={spot.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextElementSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} style={{ display: spot.cover_photo_url ? 'none' : 'flex' }}>
                        <span className="text-xl">{CATEGORY_EMOJIS[spot.category] || '🍔'}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className={`font-semibold text-sm truncate ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {spot.name}
                        </div>
                        <div className={`text-xs truncate ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {spot.city} · {dateStr}
                        </div>
                        {spot.category && (
                          <div className="mt-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {CATEGORY_EMOJIS[spot.category] || '🍽️'} {spot.category}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm">⭐</span>
                        <span className={`font-bold text-sm ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {spot.rating?.toFixed(1)}/10
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top Spots - Only if stats are visible and not loading (Top 10) */}
          {canViewStats && !loading && !error && stats.topSpots && stats.topSpots.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                🏆 Top 10 Spots
              </h3>
              <div className="space-y-3">
                {stats.topSpots.slice(0, 10).map((spot, index) => (
                  <button
                    key={spot.id}
                    onClick={() => handleSpotClick(spot)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
                      isDark
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      index < 3
                        ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] text-white'
                        : isDark
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                    }`}>
                      {index + 1}
                    </div>
                    {spot.cover_photo_url ? (
                      <img
                        src={spot.cover_photo_url}
                        alt={spot.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`} style={{ display: spot.cover_photo_url ? 'none' : 'flex' }}>
                      <span className="text-xl">{CATEGORY_EMOJIS[spot.category] || '🍔'}</span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className={`font-semibold text-sm truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.name}
                      </div>
                      <div className={`text-xs truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {spot.city}
                      </div>
                      {spot.category && (
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {CATEGORY_EMOJIS[spot.category] || '🍽️'} {spot.category}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-sm">⭐</span>
                      <span className={`font-bold text-sm ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.rating?.toFixed(1)}/10
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* City Heatmap - Only if stats are visible */}
          {canViewStats && stats.cityHeatmap.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Städte-Übersicht
              </h3>
              <div className="space-y-2">
                {stats.cityHeatmap.map(({ city, count }) => (
                  <div
                    key={city}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      isDark ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <span className={`font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {city}
                    </span>
                    <span className={`text-sm font-bold ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {count} {count === 1 ? 'Spot' : 'Spots'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 5 Geteilte Spots - Only if stats are visible */}
          {canViewStats && stats.topSharedSpots && stats.topSharedSpots.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                🤝 Top 5 geteilte Spots
              </h3>
              <div className="space-y-3">
                {stats.topSharedSpots.map((spot, index) => (
                  <button
                    key={spot.id}
                    onClick={() => navigate(`/shared/tierlist/${spot.list_id}`)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
                      isDark
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      index < 3
                        ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] text-white'
                        : isDark
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Cover Photo */}
                    {spot.cover_photo_url ? (
                      <img
                        src={spot.cover_photo_url}
                        alt={spot.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    )}

                    {/* Text Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className={`font-semibold text-sm truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.name}
                      </div>
                      <div className={`text-xs truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {spot.list_name} • {spot.city}
                      </div>
                      {spot.category && (
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {CATEGORY_EMOJIS[spot.category] || '🍽️'} {spot.category}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-sm">⭐</span>
                      <span className={`font-bold text-sm whitespace-nowrap ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.userScore ? `${spot.userScore.toFixed(1)}/10` : '–'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top 5 Geteilte Listen - Only if stats are visible */}
          {canViewStats && stats.topSharedLists && stats.topSharedLists.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                📋 Top 5 geteilte Listen
              </h3>
              <div className="space-y-3">
                {stats.topSharedLists.map((list, index) => {
                  // Get owner and other members
                  const owners = list.members.filter(m => m.role === 'owner')
                  const editors = list.members.filter(m => m.role === 'editor')
                  const allMembers = [...owners, ...editors]
                  const visibleMembers = allMembers.slice(0, 4)
                  const remainingCount = allMembers.length - 4

                  return (
                    <button
                      key={list.id}
                      onClick={() => navigate(`/shared/tierlist/${list.id}`)}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-xl transition-all active:scale-[0.98] ${
                        isDark
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Cover Photo */}
                      {list.cover_photo_url ? (
                        <img
                          src={list.cover_photo_url}
                          alt={list.list_name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl ${
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          📋
                        </div>
                      )}

                      {/* Text Content */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className={`font-semibold text-sm truncate ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {list.list_name}
                          </div>
                          {/* Role Badge */}
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                            list.role === 'owner'
                              ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white'
                              : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-200 text-gray-700'
                          }`}>
                            {list.role === 'owner' ? 'OWNER' : 'EDITOR'}
                          </span>
                        </div>
                        <div className={`text-xs truncate ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {list.city} • {list.spotCount} Spots
                        </div>
                        
                        {/* Members Avatars */}
                        <div className="flex items-center gap-1 mt-1.5">
                          {visibleMembers.map((member) => (
                            <UserAvatar
                              key={member.user_id}
                              userId={member.user_id}
                              size="xs"
                              showTooltip={false}
                            />
                          ))}
                          {remainingCount > 0 && (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              +{remainingCount}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Avg Score */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm">⭐</span>
                        <span className={`font-bold text-sm whitespace-nowrap ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {list.avgScore > 0 ? `${list.avgScore.toFixed(1)}/10` : '–'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Loading Skeleton - Only if stats are visible */}
          {loading && canViewStats && !error && (
            <div className="space-y-4">
              {/* KPI Cards Skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`rounded-[20px] shadow-lg border p-4 min-h-[88px] ${
                    isDark
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-100'
                  }`}>
                    <div className={`h-8 w-16 rounded-lg animate-pulse ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                    <div className={`h-4 w-24 rounded mt-2 animate-pulse ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                  </div>
                ))}
              </div>
              {/* Cards Skeleton */}
              {[1, 2].map((i) => (
                <div key={i} className={`rounded-[20px] shadow-lg border p-6 ${
                  isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-100'
                }`}>
                  <div className={`h-6 w-32 rounded-lg animate-pulse mb-4 ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                  <div className="space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className={`h-16 rounded-xl animate-pulse ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State for Friends with visible stats */}
          {!loading && canViewStats && !error && stats.totalSpots === 0 && (
            <div className={`rounded-[24px] shadow-lg border p-8 text-center ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="text-4xl mb-4">🍽️</div>
              <h3 className={`text-lg font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Noch keine öffentlichen Daten
              </h3>
              <p className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Diese Person hat noch keine Foodspots bewertet.
              </p>
            </div>
          )}

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
            <span className="font-semibold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}


      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

export default FriendProfile


