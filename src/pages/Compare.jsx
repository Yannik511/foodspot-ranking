import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import UserAvatar from '../components/social/UserAvatar'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'
import { useProfilesStore } from '../contexts/ProfileContext'
import { useHeaderHeight, getContentPaddingTop } from '../hooks/useHeaderHeight'

function Compare() {
  const { id: friendId } = useParams()
  const { user: currentUser } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { ensureProfiles, upsertProfiles } = useProfilesStore()
  const { headerRef, headerHeight } = useHeaderHeight()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [myStats, setMyStats] = useState(null)
  const [friendStats, setFriendStats] = useState(null)
  const [friendUser, setFriendUser] = useState(null)
  const [friendProfileVisibility, setFriendProfileVisibility] = useState('private')
  const [canCompare, setCanCompare] = useState(false)
  const cacheRef = useRef({})
  const cacheTimeoutRef = useRef({})

  useEffect(() => {
    if (!friendId || !currentUser) return
    ensureProfiles([friendId, currentUser.id])
    fetchComparisonData()
  }, [friendId, currentUser, ensureProfiles])

  // Helper function to get cached or fetch stats
  const getCachedStats = async (userId) => {
    const cacheKey = `stats_${userId}`
    const cached = cacheRef.current[cacheKey]
    const now = Date.now()

    // Check if cached and still valid (60 seconds)
    if (cached && (now - cached.timestamp) < 60000) {
      return cached.data
    }

    // Fetch from RPC
    const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', {
      target_user_id: userId
    })

    if (statsError) {
      throw statsError
    }

    // Cache the result
    cacheRef.current[cacheKey] = {
      data: statsData,
      timestamp: now
    }

    // Clear cache after 60 seconds
    if (cacheTimeoutRef.current[cacheKey]) {
      clearTimeout(cacheTimeoutRef.current[cacheKey])
    }
    cacheTimeoutRef.current[cacheKey] = setTimeout(() => {
      delete cacheRef.current[cacheKey]
      delete cacheTimeoutRef.current[cacheKey]
    }, 60000)

    return statsData
  }

  const fetchComparisonData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Check friendship status and profile visibility
      const { data: friendshipData } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUser.id})`)
        .maybeSingle()

      const isAcceptedFriend = friendshipData?.status === 'accepted' && 
        (friendshipData.requester_id === currentUser.id || friendshipData.addressee_id === currentUser.id)

      if (!isAcceptedFriend) {
        setError('Nur für bestätigte Freund:innen verfügbar')
        setLoading(false)
        return
      }

      // Fetch friend profile with visibility
      let friendProfile = null
      let visibility = 'private'
      try {
        const { data: profileData } = await supabase.rpc('get_user_profile', { user_id: friendId })
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
        try {
          const { data: viewData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', friendId)
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
          console.warn('Could not fetch friend profile')
        }
      }

      if (!friendProfile) {
        setError('Profil nicht gefunden')
        setLoading(false)
        return
      }

      setFriendUser(friendProfile)
      upsertProfiles([{
        id: friendProfile.id,
        profile_image_url: friendProfile.user_metadata?.profileImageUrl,
        username: friendProfile.user_metadata?.username,
        profile_visibility: friendProfile.user_metadata?.profile_visibility
      }])
      setFriendProfileVisibility(visibility)

      // Check if profile is visible to friends
      if (visibility !== 'friends') {
        setError('Profil ist privat')
        setCanCompare(false)
        setLoading(false)
        return
      }

      setCanCompare(true)

      // Fetch stats for both users using RPC function (same as in FriendProfile)
      const [myStatsData, friendStatsData] = await Promise.all([
        getCachedStats(currentUser.id),
        getCachedStats(friendId)
      ])

      // Transform stats to component format (using same aggregated values as FriendProfile)
      setMyStats({
        totalSpots: myStatsData?.total_spots || 0,
        totalCities: myStatsData?.total_cities || 0,
        totalLists: myStatsData?.total_lists || 0,
        averageScore: myStatsData?.avg_score || 0
      })

      setFriendStats({
        totalSpots: friendStatsData?.total_spots || 0,
        totalCities: friendStatsData?.total_cities || 0,
        totalLists: friendStatsData?.total_lists || 0,
        averageScore: friendStatsData?.avg_score || 0
      })
    } catch (error) {
      console.error('Error fetching comparison data:', error)
      setError('Fehler beim Laden der Vergleichsdaten')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    // Clear cache for retry
    cacheRef.current = {}
    Object.values(cacheTimeoutRef.current).forEach(timeout => clearTimeout(timeout))
    cacheTimeoutRef.current = {}
    fetchComparisonData()
  }

  const getUsername = (userData) => {
    return userData?.user_metadata?.username || userData?.email?.split('@')[0] || 'Unbekannt'
  }

  const getWinner = (myValue, friendValue, higherIsBetter = true) => {
    // Handle NaN and null values
    const myNum = (myValue == null || isNaN(myValue)) ? 0 : Number(myValue)
    const friendNum = (friendValue == null || isNaN(friendValue)) ? 0 : Number(friendValue)
    
    if (myNum === friendNum) return 'tie'
    if (higherIsBetter) {
      return myNum > friendNum ? 'me' : 'friend'
    } else {
      return myNum < friendNum ? 'me' : 'friend'
    }
  }

  // Don't render until we have both stats or an error
  if (loading || (!myStats && !error) || (!friendStats && !error && canCompare)) {
    return (
      <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <header 
          ref={headerRef}
          className={`header-safe border-b fixed top-0 left-0 right-0 z-20 shadow-sm backdrop-blur-xl ${
            isDark
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/80 border-gray-200/50'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2">
            <button
              onClick={() => navigate(`/friend/${friendId}`)}
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
              Vergleich
            </h1>

            <div className="w-10" />
          </div>
        </header>

        {/* Skeleton Loader */}
        <main 
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{
            paddingTop: getContentPaddingTop(headerHeight, 24),
            paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Comparison Header Skeleton */}
            <div className={`rounded-[24px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center justify-center gap-6">
                <div className="flex-1 text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto animate-pulse ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                  <div className={`h-4 w-16 rounded mx-auto mt-2 animate-pulse ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                </div>
                <div className="text-2xl">VS</div>
                <div className="flex-1 text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto animate-pulse ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                  <div className={`h-4 w-16 rounded mx-auto mt-2 animate-pulse ${
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                </div>
              </div>
            </div>

            {/* Stats Cards Skeleton */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`rounded-[20px] shadow-lg border p-6 ${
                isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-100'
              }`}>
                <div className={`h-6 w-32 rounded mx-auto mb-4 animate-pulse ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
                <div className="flex items-center justify-center gap-6">
                  <div className="flex-1 text-center">
                    <div className={`h-10 w-20 rounded mx-auto animate-pulse ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                  </div>
                  <div className="text-gray-400">VS</div>
                  <div className="flex-1 text-center">
                    <div className={`h-10 w-20 rounded mx-auto animate-pulse ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <header 
          ref={headerRef}
          className={`header-safe border-b fixed top-0 left-0 right-0 z-20 shadow-sm backdrop-blur-xl ${
            isDark
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/80 border-gray-200/50'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2">
            <button
              onClick={() => navigate(`/friend/${friendId}`)}
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
              Vergleich
            </h1>

            <div className="w-10" />
          </div>
        </header>

        {/* Error State */}
        <main 
          className="flex-1 overflow-y-auto px-4 py-6"
          style={{
            paddingTop: getContentPaddingTop(headerHeight, 24),
            paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="max-w-4xl mx-auto">
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
              {error !== 'Profil ist privat' && (
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
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <header 
        ref={headerRef}
        className={`header-safe border-b fixed top-0 left-0 right-0 z-20 shadow-sm backdrop-blur-xl ${
          isDark
            ? 'bg-gray-900/80 border-gray-800/50'
            : 'bg-white/80 border-gray-200/50'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate(`/friend/${friendId}`)}
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
            Vergleich
          </h1>

          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main 
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{
          paddingTop: getContentPaddingTop(headerHeight, 24),
          paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Comparison Header - Only render if both stats are loaded */}
          {myStats && friendStats && friendUser && (
            <>
              <div className={`rounded-[24px] shadow-lg border p-6 ${
                isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-100'
              }`}>
                <div className="flex items-center justify-center gap-6">
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <UserAvatar user={currentUser} size={64} />
                    <p className={`mt-2 font-semibold text-sm ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                      Du
                    </p>
                  </div>
                  <div className="text-2xl">VS</div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <UserAvatar user={friendUser} size={64} />
                    <p className={`mt-2 font-semibold text-sm ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {getUsername(friendUser)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparison Stats */}
              <div className="space-y-4">
                {/* Total Spots */}
                <ComparisonCard
                  label="Gesamte Spots"
                  myValue={myStats.totalSpots}
                  friendValue={friendStats.totalSpots}
                  isDark={isDark}
                  higherIsBetter={true}
                />

                {/* Total Cities */}
                <ComparisonCard
                  label="Städte/Orte"
                  myValue={myStats.totalCities}
                  friendValue={friendStats.totalCities}
                  isDark={isDark}
                  higherIsBetter={true}
                />

                {/* Total Lists */}
                <ComparisonCard
                  label="Listen"
                  myValue={myStats.totalLists}
                  friendValue={friendStats.totalLists}
                  isDark={isDark}
                  higherIsBetter={true}
                />

                {/* Average Score */}
                <ComparisonCard
                  label="Ø Score"
                  myValue={myStats.averageScore}
                  friendValue={friendStats.averageScore}
                  isDark={isDark}
                  higherIsBetter={true}
                  isDecimal={true}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Comparison Card Component
function ComparisonCard({ label, myValue, friendValue, isDark, higherIsBetter = true, isDecimal = false }) {
  // Handle NaN and null values
  const myNum = (myValue == null || isNaN(myValue)) ? 0 : Number(myValue)
  const friendNum = (friendValue == null || isNaN(friendValue)) ? 0 : Number(friendValue)
  
  const getWinner = () => {
    if (myNum === friendNum) return 'tie'
    if (higherIsBetter) {
      return myNum > friendNum ? 'me' : 'friend'
    } else {
      return myNum < friendNum ? 'me' : 'friend'
    }
  }

  const winner = getWinner()
  
  // Format values
  const myFormatted = isDecimal ? myNum.toFixed(1) : Math.round(myNum).toString()
  const friendFormatted = isDecimal ? friendNum.toFixed(1) : Math.round(friendNum).toString()

  return (
    <div className={`rounded-[20px] shadow-lg border p-6 ${
      isDark
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-100'
    }`}>
      <h3 className={`text-sm font-semibold mb-4 text-center ${
        isDark ? 'text-gray-300' : 'text-gray-700'
      }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
        {label}
      </h3>
      <div className="flex items-center justify-center gap-6">
        <div className="flex-1 text-center">
          <div className={`text-3xl font-bold mb-1 ${
            winner === 'me' 
              ? 'text-green-500' 
              : winner === 'tie'
              ? isDark ? 'text-gray-400' : 'text-gray-600'
              : isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            {myFormatted}
          </div>
          {winner === 'me' && (
            <span className="text-xs text-green-500 font-medium">Gewinner</span>
          )}
          {winner === 'tie' && (
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Unentschieden</span>
          )}
        </div>
        <div className="text-gray-400">VS</div>
        <div className="flex-1 text-center">
          <div className={`text-3xl font-bold mb-1 ${
            winner === 'friend' 
              ? 'text-green-500' 
              : winner === 'tie'
              ? isDark ? 'text-gray-400' : 'text-gray-600'
              : isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            {friendFormatted}
          </div>
          {winner === 'friend' && (
            <span className="text-xs text-green-500 font-medium">Gewinner</span>
          )}
          {winner === 'tie' && (
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Unentschieden</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default Compare

