import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import UserAvatar from './UserAvatar'
import { supabase } from '../../services/supabase'
import { hapticFeedback } from '../../utils/haptics'
import CreateSharedList from './CreateSharedList'

function FriendsTab() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showCreateSharedList, setShowCreateSharedList] = useState(false)
  const menuOpenForFriend = useRef(null)

  // Fetch friends and requests
  useEffect(() => {
    if (!user) return
    fetchFriends()
    
    // Subscribe to friendship changes (Realtime)
    const channel = supabase
      .channel('friendships_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${user.id}`
      }, () => {
        fetchFriends()
        // Refresh search results if we have an active search
        refreshSearchResults()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${user.id}`
      }, () => {
        fetchFriends()
        // Refresh search results if we have an active search
        refreshSearchResults()
      })
      .subscribe()

    // Subscribe to foodspots changes for friends (to update stats in real-time)
    // Note: We'll fetch all friends' stats when any friend adds a new spot
    // This is more efficient than subscribing to each friend individually
    const foodspotsChannel = supabase
      .channel('friends_foodspots_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspots'
      }, () => {
        // Refresh friends list to update stats
        // This will check profile_visibility and only update if visible
        fetchFriends()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(foodspotsChannel)
    }
  }, [user])

  // Function to refresh search results without triggering a new search
  const refreshSearchResults = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return
    }
    // Trigger search again with current query
    await handleSearch(searchQuery)
  }

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const fetchFriends = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Fetch accepted friendships (without foreign key joins)
      const { data: acceptedData, error: acceptedError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted')

      // Check if table doesn't exist
      if (acceptedError) {
        if (acceptedError.code === 'PGRST200' || 
            (acceptedError.message && acceptedError.message.includes('does not exist'))) {
          // Table doesn't exist yet - silently handle
          setFriends([])
          setIncomingRequests([])
          setOutgoingRequests([])
          setLoading(false)
          setRefreshing(false)
          return
        }
        throw acceptedError
      }

      // Fetch pending requests where user is addressee (incoming)
      const { data: incomingData, error: incomingError } = await supabase
        .from('friendships')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending')

      if (incomingError && incomingError.code !== 'PGRST200' && 
          !incomingError.message?.includes('does not exist')) {
        throw incomingError
      }

      // Fetch pending requests where user is requester (outgoing)
      const { data: outgoingData, error: outgoingError } = await supabase
        .from('friendships')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'pending')

      if (outgoingError && outgoingError.code !== 'PGRST200' && 
          !outgoingError.message?.includes('does not exist')) {
        throw outgoingError
      }

      // Get all unique user IDs from friendships
      const allUserIds = new Set()
      if (acceptedData) {
        acceptedData.forEach(f => {
          allUserIds.add(f.requester_id)
          allUserIds.add(f.addressee_id)
        })
      }
      if (incomingData) {
        incomingData.forEach(f => allUserIds.add(f.requester_id))
      }
      if (outgoingData) {
        outgoingData.forEach(f => allUserIds.add(f.addressee_id))
      }

      // Fetch user profiles using the user_profiles view
      const userIdsArray = Array.from(allUserIds)
      let userProfilesMap = new Map()
      
      if (userIdsArray.length > 0) {
        try {
          // Try to fetch from user_profiles view
          const { data: profilesData, error: profilesError } = await supabase
            .from('user_profiles')
            .select('*')
            .in('id', userIdsArray)

          // If view doesn't exist, that's ok - we'll use minimal user objects
          if (!profilesError && profilesData) {
            profilesData.forEach(profile => {
              userProfilesMap.set(profile.id, {
                id: profile.id,
                email: profile.email,
                user_metadata: {
                  username: profile.username,
                  profileImageUrl: profile.profile_image_url,
                  profile_visibility: profile.profile_visibility || 'private'
                },
                profile_visibility: profile.profile_visibility || 'private',
                created_at: profile.created_at
              })
            })
          }
        } catch (err) {
          // View might not exist yet - that's ok
          console.warn('Could not fetch user profiles:', err)
        }
      }

      // Helper function to get user object
      const getUserObject = (userId) => {
        if (userProfilesMap.has(userId)) {
          return userProfilesMap.get(userId)
        }
        // Return minimal user object if profile not found
        return {
          id: userId,
          email: null,
          user_metadata: {}
        }
      }

      // Process accepted friendships to get friend user
      const friendsList = (acceptedData || []).map(friendship => {
        const friendId = friendship.requester_id === user.id
          ? friendship.addressee_id
          : friendship.requester_id
        
        return {
          ...friendship,
          friendId: friendId,
          friend: getUserObject(friendId)
        }
      })

      // Fetch friend stats using RPC function (only if profile_visibility='friends')
      const friendsWithStats = await Promise.all(
        friendsList.map(async (friendship) => {
          const friendId = friendship.friendId
          if (!friendId) return null

          const friendUser = friendship.friend
          const profileVisibility = friendUser?.user_metadata?.profile_visibility || 
                                   friendUser?.profile_visibility || 
                                   'private'

          // Only fetch stats if profile is visible to friends
          let totalSpots = 0
          let averageScore = 0
          
          if (profileVisibility === 'friends') {
            try {
              // Use RPC function to get aggregated stats (server-side, more efficient)
              const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', {
                target_user_id: friendId
              })

              if (!statsError && statsData) {
                totalSpots = statsData.total_spots || 0
                averageScore = statsData.avg_score || 0
              }
            } catch (error) {
              // If RPC fails, fallback to simple query
              console.warn('Error fetching friend stats via RPC, using fallback:', error)
              try {
                const { data: spotsData } = await supabase
                  .from('foodspots')
                  .select('rating')
                  .eq('user_id', friendId)

                if (spotsData) {
                  totalSpots = spotsData.length || 0
                  const ratings = spotsData.filter(s => s.rating != null).map(s => s.rating) || []
                  averageScore = ratings.length > 0
                    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
                    : 0
                }
              } catch (fallbackError) {
                // Silent fail - keep stats at 0
                console.warn('Fallback stats fetch also failed:', fallbackError)
              }
            }
          }
          // If profile_visibility is 'private', stats remain 0 (as initialized)

          return {
            ...friendship,
            stats: {
              totalSpots,
              averageScore,
              isVisible: profileVisibility === 'friends'
            }
          }
        })
      )

      // Filter out null entries
      const validFriends = friendsWithStats.filter(f => f !== null)

      // Process incoming requests
      const processedIncomingRequests = (incomingData || []).map(request => ({
        ...request,
        requester: getUserObject(request.requester_id)
      }))

      // Process outgoing requests
      const processedOutgoingRequests = (outgoingData || []).map(request => ({
        ...request,
        addressee: getUserObject(request.addressee_id)
      }))

      // Set data
      setFriends(validFriends)
      setIncomingRequests(processedIncomingRequests)
      setOutgoingRequests(processedOutgoingRequests)
    } catch (error) {
      console.error('Error fetching friends:', error)
      // Only show error toast for real errors
      const errorMessage = error?.message || ''
      const errorCode = error?.code || ''
      const isRealError = errorCode !== 'PGRST200' && 
        errorMessage && 
        !errorMessage.includes('does not exist') &&
        !errorMessage.includes('Failed to fetch') &&
        !errorMessage.includes('Network') &&
        !errorMessage.includes('relationship')
      
      if (isRealError) {
        showToast('Fehler beim Laden der Freunde', 'error')
      } else {
        // Silent failure - just set empty arrays
        setFriends([])
        setIncomingRequests([])
        setOutgoingRequests([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleSearch = async (query) => {
    setSearchQuery(query)
    
    // Clear results if query is too short
    if (query.trim().length < 1) {
      setSearchResults([])
      return
    }

    // Don't search if query is too short (minimum 2 characters)
    if (query.trim().length < 2) {
      return
    }

    setSearchLoading(true)
    try {
      let profiles = null
      let error = null

      // Try to use the user_profiles view first
      const viewResult = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${query.trim()}%`)
        .limit(10)

      if (viewResult.error) {
        // If view doesn't exist, use the search function instead
        if (viewResult.error.code === 'PGRST200' || 
            viewResult.error.message?.includes('does not exist') ||
            viewResult.error.message?.includes('permission denied')) {
          console.warn('user_profiles view not available, using search function')
          
          // Use the search function as fallback
          const functionResult = await supabase.rpc('search_users_by_username', {
            search_query: query.trim()
          })
          
          if (functionResult.error) {
            error = functionResult.error
          } else {
            profiles = functionResult.data
          }
        } else {
          error = viewResult.error
        }
      } else {
        profiles = viewResult.data
      }

      if (error) {
        throw error
      }

      if (!profiles || profiles.length === 0) {
        setSearchResults([])
        setSearchLoading(false)
        return
      }

      // Filter out current user (no self-adding)
      const filteredProfiles = profiles.filter(profile => profile.id !== user.id)

      // Fetch all friendships for current user once (more efficient)
      const { data: allFriendships, error: friendshipError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

      // Create a map of profile IDs to friendship status for quick lookup
      const friendshipMap = new Map()
      if (!friendshipError && allFriendships) {
        allFriendships.forEach(friendship => {
          const otherUserId = friendship.requester_id === user.id 
            ? friendship.addressee_id 
            : friendship.requester_id
          
          if (friendship.status === 'accepted') {
            friendshipMap.set(otherUserId, 'accepted')
          } else if (friendship.status === 'pending') {
            const status = friendship.requester_id === user.id ? 'pending_outgoing' : 'pending_incoming'
            friendshipMap.set(otherUserId, status)
          }
        })
      }

      // Map profiles to results with friendship status
      const resultsWithStatus = filteredProfiles.map(profile => {
        const friendshipStatus = friendshipMap.get(profile.id) || 'none'

          return {
            id: profile.id,
            username: profile.username || profile.email?.split('@')[0] || 'Unbekannt',
            email: profile.email,
            profileImageUrl: profile.profile_image_url,
            profile_visibility: profile.profile_visibility || 'private',
            created_at: profile.created_at,
            friendshipStatus
          }
      })

      setSearchResults(resultsWithStatus)
    } catch (error) {
      console.error('Error searching users:', error)
      showToast('Fehler bei der Suche', 'error')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/register?invite=${user.id}`
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      showToast('Einladungslink kopiert!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast('Fehler beim Kopieren', 'error')
    }
  }

  const handleAcceptRequest = async (friendshipId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)

      if (error) throw error

      // Create activity entry
      try {
        await supabase.from('activity').insert({
          user_id: user.id,
          type: 'friend_accepted',
          ref_id: friendshipId,
          payload: {}
        })
      } catch (activityError) {
        // Activity table might not exist, that's ok
        console.warn('Could not create activity entry:', activityError)
      }

      hapticFeedback.success()
      showToast('Freundschaftsanfrage angenommen', 'success')
      fetchFriends()
      
      // Refresh search results if we have an active search
      refreshSearchResults()
    } catch (error) {
      console.error('Error accepting request:', error)
      showToast('Fehler beim Annehmen', 'error')
    }
  }

  const handleRejectRequest = async (friendshipId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) throw error

      hapticFeedback.light()
      showToast('Freundschaftsanfrage abgelehnt', 'success')
      fetchFriends()
    } catch (error) {
      console.error('Error rejecting request:', error)
      showToast('Fehler beim Ablehnen', 'error')
    }
  }

  const handleRemoveFriend = async (friendshipId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) throw error

      hapticFeedback.light()
      showToast('Freund entfernt', 'success')
      fetchFriends()
      menuOpenForFriend.current = null
    } catch (error) {
      console.error('Error removing friend:', error)
      showToast('Fehler beim Entfernen', 'error')
    }
  }

  const handleSendFriendRequest = async (userId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: user.id,
          addressee_id: userId,
          status: 'pending'
        })

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          showToast('Freundschaftsanfrage bereits gesendet', 'info')
        } else {
          throw error
        }
      } else {
        hapticFeedback.success()
        showToast('Freundschaftsanfrage gesendet', 'success')
        fetchFriends()
        
        // Update search results to reflect new status immediately
        setSearchResults(prevResults =>
          prevResults.map(result =>
            result.id === userId
              ? { ...result, friendshipStatus: 'pending_outgoing' }
              : result
          )
        )
        
        // Also refresh to get latest status from DB (handles edge cases)
        setTimeout(() => {
          refreshSearchResults()
        }, 500)
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      showToast('Fehler beim Senden', 'error')
    }
  }

  const getDisplayName = (userData) => {
    if (!userData) return 'Unbekannt'
    // Return username if available, otherwise email prefix
    if (userData.username) return userData.username
    if (userData.email) return userData.email.split('@')[0]
    return 'Unbekannt'
  }

  const getButtonText = (friendshipStatus) => {
    switch (friendshipStatus) {
      case 'accepted':
        return 'Bereits hinzugefügt'
      case 'pending_outgoing':
        return 'Anfrage ausstehend'
      case 'pending_incoming':
        return 'Anfrage erhalten'
      default:
        return 'Hinzufügen'
    }
  }

  const isButtonDisabled = (friendshipStatus) => {
    return friendshipStatus === 'accepted' || friendshipStatus === 'pending_outgoing' || friendshipStatus === 'pending_incoming'
  }

  const handlePullToRefresh = async () => {
    setRefreshing(true)
    await fetchFriends()
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const getUsername = (userData) => {
    // Handle both full user objects and minimal user objects with just id
    if (!userData) return 'Unbekannt'
    if (userData.user_metadata?.username) return userData.user_metadata.username
    if (userData.email) return userData.email.split('@')[0]
    if (userData.id) {
      // If we only have an ID, use a placeholder
      return `User ${userData.id.substring(0, 8)}`
    }
    return 'Unbekannt'
  }

  if (loading && friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">👥</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt Freunde...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Search and Invite */}
      <div className={`p-4 border-b ${
        isDark ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex gap-2 mb-3">
          <div className={`flex-1 relative ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } rounded-xl overflow-hidden`}>
            <input
              type="text"
              placeholder="Freunde suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full px-4 py-3 ${
                isDark ? 'bg-gray-800 text-white placeholder-gray-400' : 'bg-white text-gray-900 placeholder-gray-500'
              } outline-none`}
            />
            <svg className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={handleCopyInviteLink}
            className={`px-4 py-3 rounded-xl font-medium transition-all active:scale-95 ${
              copied
                ? 'bg-green-500 text-white'
                : isDark
                  ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
        {copied && (
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Einladungslink kopiert!
          </p>
        )}
      </div>

      {/* Content */}
      <div className="pb-24">
        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <div className="p-4 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
            <h3 className={`text-sm font-semibold mb-3 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Suchergebnisse
            </h3>
            {searchLoading ? (
              <div className={`text-center py-8 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-xs mt-2">Suche...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className={`text-center py-8 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <p className="text-sm">Keine Ergebnisse gefunden</p>
                <p className="text-xs mt-1">Versuche einen anderen Username</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result) => {
                  const userData = {
                    id: result.id,
                    email: result.email,
                    user_metadata: {
                      username: result.username,
                      profileImageUrl: result.profileImageUrl
                    }
                  }
                  
                  return (
                    <div
                      key={result.id}
                      className={`p-4 rounded-xl ${
                        isDark ? 'bg-gray-800' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-shrink-0">
                          <UserAvatar user={userData} size={48} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {getDisplayName(result)}
                          </p>
                          <p className={`text-xs truncate ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            @{result.username}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendFriendRequest(result.id)}
                        disabled={isButtonDisabled(result.friendshipStatus)}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all active:scale-95 ${
                          isButtonDisabled(result.friendshipStatus)
                            ? isDark
                              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white hover:opacity-90'
                        }`}
                      >
                        {getButtonText(result.friendshipStatus)}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <div className="p-4">
            <h3 className={`text-sm font-semibold mb-3 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Anfragen ({incomingRequests.length})
            </h3>
            <div className="space-y-3">
              {incomingRequests.map((request) => {
                const requester = request.requester
                return (
                  <div
                    key={request.id}
                    className={`p-4 rounded-xl ${
                      isDark ? 'bg-gray-800' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0">
                        <UserAvatar user={requester} size={48} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {getUsername(requester)}
                        </p>
                        <p className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Möchte dein Freund werden
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="flex-1 py-2 px-4 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white rounded-lg font-medium transition-all active:scale-95"
                      >
                        Annehmen
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all active:scale-95 ${
                          isDark
                            ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Ablehnen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Outgoing Requests */}
        {outgoingRequests.length > 0 && (
          <div className="p-4">
            <h3 className={`text-sm font-semibold mb-3 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Ausstehend ({outgoingRequests.length})
            </h3>
            <div className="space-y-3">
              {outgoingRequests.map((request) => {
                const addressee = request.addressee
                return (
                  <div
                    key={request.id}
                    className={`p-4 rounded-xl ${
                      isDark ? 'bg-gray-800' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <UserAvatar user={addressee} size={48} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {getUsername(addressee)}
                        </p>
                        <p className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Anfrage gesendet
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Freunde ({friends.length})
          </h3>
          {friends.length === 0 ? (
            <div className={`text-center py-12 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="text-4xl mb-4">👥</div>
              <p className="text-sm mb-2">Noch keine Freunde</p>
              <p className="text-xs">Finde Freunde über die Suche oder teile deinen Einladungslink</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friendship) => {
                const friend = friendship.friend
                if (!friend) return null

                return (
                  <button
                    key={friendship.id}
                    onClick={() => navigate(`/friend/${friend.id}`)}
                    className={`w-full p-4 rounded-xl text-left transition-all active:scale-[0.98] ${
                      isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <UserAvatar user={friend} size={48} />
                        {/* Online indicator - placeholder */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {getUsername(friend)}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {friendship.stats?.isVisible ? (
                            <>
                              <span className={`text-xs ${
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {friendship.stats.totalSpots || 0} Spots
                              </span>
                              <span className={`text-xs ${
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                ⭐ {(friendship.stats.averageScore || 0).toFixed(1)}/10
                              </span>
                            </>
                          ) : (
                            <>
                              <span className={`text-xs ${
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                0 Spots
                              </span>
                              <span className={`text-xs ${
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                ⭐ 0.0/10
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
          style={{ animation: 'fadeSlideDown 0.3s ease-out' }}
        >
          <div className={`rounded-[16px] px-6 py-4 shadow-xl flex items-center gap-3 max-w-[90vw] ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'info' ? 'bg-blue-500 text-white' :
            'bg-red-500 text-white'
          }`}>
            <span className="font-semibold text-sm whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* Floating Action Button - Only show in Friends tab when not searching */}
      {!searchQuery.trim() && friends.length > 0 && (
        <button
          onClick={() => {
            setShowCreateSharedList(true)
            hapticFeedback.light()
          }}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-2xl flex items-center justify-center z-40 transition-all active:scale-95"
          style={{ boxShadow: '0 10px 25px rgba(255, 126, 66, 0.4)' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Create Shared List Modal */}
      {showCreateSharedList && (
        <CreateSharedList
          onClose={() => setShowCreateSharedList(false)}
        />
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

export default FriendsTab

