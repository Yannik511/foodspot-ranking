import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import UserAvatar from './UserAvatar'
import { supabase } from '../../services/supabase'
import { hapticFeedback } from '../../utils/haptics'
import { useProfilesStore } from '../../contexts/ProfileContext'

const SectionSkeleton = ({ isDark, rows = 3 }) => (
  <div className="p-4 space-y-3">
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className={`rounded-2xl border shadow-sm p-4 animate-pulse ${
          isDark ? 'bg-gray-800/80 border-gray-700/60' : 'bg-white border-gray-200/70'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${isDark ? 'bg-gray-700/70' : 'bg-gray-200/80'}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 rounded-full ${isDark ? 'bg-gray-700/60' : 'bg-gray-200/80'}`} />
            <div className={`h-3 rounded-full w-1/2 ${isDark ? 'bg-gray-700/40' : 'bg-gray-200/60'}`} />
          </div>
          <div className={`w-10 h-10 rounded-2xl ${isDark ? 'bg-gray-700/60' : 'bg-gray-200/70'}`} />
        </div>
      </div>
    ))}
  </div>
)

function FriendsTab() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { upsertProfiles } = useProfilesStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [listInvitations, setListInvitations] = useState([]) // Einladungen zu geteilten Listen
  const [listInvitationsLoading, setListInvitationsLoading] = useState(false)
  const [sharedLists, setSharedLists] = useState([]) // Geteilte Listen für Social-Tab
  const [sharedListsLoading, setSharedListsLoading] = useState(false)
  const [showInvitationDetails, setShowInvitationDetails] = useState(null) // ID der Einladung für Details-Ansicht
  const [showFABMenu, setShowFABMenu] = useState(false) // FAB-Menü anzeigen
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const menuOpenForFriend = useRef(null)

  const SHARED_LISTS_PREVIEW_LIMIT = 6
  const FRIENDS_PREVIEW_LIMIT = 10
  const [showAllSharedLists, setShowAllSharedLists] = useState(false)
  const [showAllFriends, setShowAllFriends] = useState(false)
  const selectedInvitation = useMemo(() => {
    if (!showInvitationDetails) return null
    return listInvitations.find(inv => inv.id === showInvitationDetails) || null
  }, [listInvitations, showInvitationDetails])
  const selectedList = selectedInvitation?.list || null
  const selectedInviter = selectedInvitation?.inviterProfile || null
  const selectedRole = selectedInvitation?.role || 'editor'

  useEffect(() => {
    if (sharedLists.length <= SHARED_LISTS_PREVIEW_LIMIT) {
      setShowAllSharedLists(false)
    }
  }, [sharedLists, SHARED_LISTS_PREVIEW_LIMIT])

  useEffect(() => {
    if (friends.length <= FRIENDS_PREVIEW_LIMIT) {
      setShowAllFriends(false)
    }
  }, [friends, FRIENDS_PREVIEW_LIMIT])

  // Fetch friends and requests - NUR beim ersten Mount
  useEffect(() => {
    if (!user) return
    
    console.log('[FriendsTab] Initial load - fetching data')
    fetchFriends()
    fetchListInvitations()
    fetchSharedLists()
    
    // ========================================
    // REALTIME SUBSCRIPTIONS (ohne Polling!)
    // ========================================
    
    // 1. Friendship changes - nur für diesen User
    const friendshipsChannel = supabase
      .channel('friendships_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${user.id}`
      }, () => {
        console.log('[FriendsTab] Realtime: Friendship changed (as requester)')
        fetchFriends()
        refreshSearchResults()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${user.id}`
      }, () => {
        console.log('[FriendsTab] Realtime: Friendship changed (as addressee)')
        fetchFriends()
        refreshSearchResults()
      })
      .subscribe()

    // 2. List invitations - NUR für diesen User
    const invitationsChannel = supabase
      .channel('invitations_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_invitations',
        filter: `invitee_id=eq.${user.id}`
      }, (payload) => {
        console.log('[FriendsTab] Realtime: Invitation changed', payload.eventType)
        fetchListInvitations()
        
        // Bei Annahme auch shared lists aktualisieren
        if (payload.eventType === 'UPDATE' && payload.new?.status === 'accepted') {
          console.log('[FriendsTab] Realtime: Invitation accepted - refreshing shared lists')
          fetchSharedLists()
        }
      })
      .subscribe()

    // 3. List members - NUR wenn dieser User betroffen ist
    const membersChannel = supabase
      .channel('members_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_members',
        filter: `user_id=eq.${user.id}`
      }, () => {
        console.log('[FriendsTab] Realtime: Membership changed')
        fetchSharedLists()
      })
      .subscribe()

    // Cleanup
    return () => {
      console.log('[FriendsTab] Cleaning up: Removing realtime channels')
      supabase.removeChannel(friendshipsChannel)
      supabase.removeChannel(invitationsChannel)
      supabase.removeChannel(membersChannel)
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

      // Fetch user profiles using the get_user_profile RPC function
      // WICHTIG: profile_visibility kommt aus auth.users.user_metadata!
      const userIdsArray = Array.from(allUserIds)
      let userProfilesMap = new Map()
      
      if (userIdsArray.length > 0) {
        try {
          // Fetch profiles using RPC function (reads from auth.users.user_metadata)
          const profilePromises = userIdsArray.map(async (userId) => {
            const { data, error } = await supabase.rpc('get_user_profile', { user_id: userId })
            if (!error && data && data.length > 0) {
              return data[0]
            }
            return null
          })
          
          const profilesData = (await Promise.all(profilePromises)).filter(p => p !== null)

          if (profilesData.length > 0) {
            upsertProfiles(profilesData)
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
          // RPC might not exist yet - that's ok
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
      const sortedFriends = [...validFriends].sort((a, b) => {
        const spotsA = a?.stats?.totalSpots ?? 0
        const spotsB = b?.stats?.totalSpots ?? 0
        if (spotsB !== spotsA) return spotsB - spotsA
        const nameA = (a?.friend?.user_metadata?.username || a?.friend?.email || '').toLowerCase()
        const nameB = (b?.friend?.user_metadata?.username || b?.friend?.email || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })

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
      setFriends(sortedFriends)
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
      if (filteredProfiles.length > 0) {
        upsertProfiles(filteredProfiles)
      }

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

  // Fetch list invitations
  const fetchListInvitations = async () => {
    if (!user) {
      console.log('[FriendsTab] fetchListInvitations: No user, skipping')
      return
    }
    
    console.log('[FriendsTab] ==========================================')
    console.log('[FriendsTab] fetchListInvitations: Starting fetch')
    console.log('[FriendsTab] Current user ID (invitee_id):', user.id)
    console.log('[FriendsTab] Filter: invitee_id =', user.id, 'AND status = pending')
    console.log('[FriendsTab] ==========================================')
    
    setListInvitationsLoading(true)
    try {
      // STEP 1: Simple test query to verify RLS access
      console.log('[FriendsTab] STEP 1: Testing RLS access with simple query')
      const { data: testData, error: testError } = await supabase
        .from('list_invitations')
        .select('id, list_id, invitee_id, status')
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .limit(10) // Get more for debugging
      
      if (testError) {
        console.error('[FriendsTab] ==========================================')
        console.error('[FriendsTab] ERROR: Test query failed')
        console.error('[FriendsTab] Error code:', testError.code)
        console.error('[FriendsTab] Error message:', testError.message)
        console.error('[FriendsTab] Error details:', testError.details)
        console.error('[FriendsTab] Error hint:', testError.hint)
        console.error('[FriendsTab] ==========================================')
        
        // Tabelle existiert möglicherweise noch nicht - das ist okay
        if (testError.code === 'PGRST200' || testError.code === '42P01' || testError.message?.includes('does not exist')) {
          console.log('[FriendsTab] Table does not exist, returning empty array')
          setListInvitations([])
          setListInvitationsLoading(false)
          return
        }
        
        // RLS Policy error?
        if (testError.code === '42501' || testError.message?.includes('permission denied') || testError.message?.includes('policy')) {
          console.error('[FriendsTab] RLS Policy Error - User might not have permission to view invitations')
          console.error('[FriendsTab] This might be a RLS policy issue. Check Migration 021.')
          console.error('[FriendsTab] Policy "Invitees can view their own invitations" should allow SELECT where invitee_id = auth.uid()')
        }
        
        throw testError
      }
      
      console.log('[FriendsTab] STEP 1 SUCCESS: Test query returned', testData?.length || 0, 'invitations')
      if (testData && testData.length > 0) {
        console.log('[FriendsTab] Test query invitation IDs:', testData.map(inv => inv.id))
        console.log('[FriendsTab] Test query list IDs:', testData.map(inv => inv.list_id))
        console.log('[FriendsTab] Test query invitee IDs (should all be', user.id, '):', testData.map(inv => inv.invitee_id))
      }
      
      // STEP 2: Fetch full data with relations
      console.log('[FriendsTab] STEP 2: Fetching full invitation data with relations')
      // WICHTIG: inviter_id verweist auf auth.users, nicht auf eine Tabelle, die über PostgREST abgefragt werden kann
      // Daher verwenden wir nur den Join mit lists, nicht mit inviter
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('list_invitations')
        .select(`
          *,
          lists:list_id (
            id,
            list_name,
            city,
            category,
            description,
            cover_image_url,
            created_at
          )
        `)
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (invitationsError) {
        console.error('[FriendsTab] ==========================================')
        console.error('[FriendsTab] ERROR: Full query failed')
        console.error('[FriendsTab] Error code:', invitationsError.code)
        console.error('[FriendsTab] Error message:', invitationsError.message)
        console.error('[FriendsTab] Error details:', invitationsError.details)
        console.error('[FriendsTab] Error hint:', invitationsError.hint)
        console.error('[FriendsTab] ==========================================')
        
        // If test query worked but full query fails, it might be a RLS issue with the joined tables
        if (invitationsError.code === '42501' || invitationsError.message?.includes('permission denied')) {
          console.error('[FriendsTab] RLS Policy Error when joining with lists table')
          console.error('[FriendsTab] User might not have permission to view the list')
          console.error('[FriendsTab] Check Migration 022: "Invitees can view lists they are invited to"')
        }
        
        throw invitationsError
      }

      console.log('[FriendsTab] STEP 2 SUCCESS: Full query returned', invitationsData?.length || 0, 'invitations')
      console.log('[FriendsTab] ==========================================')
      
      if (invitationsData && invitationsData.length > 0) {
        console.log('[FriendsTab] Found pending invitations:', invitationsData.length)
        console.log('[FriendsTab] Invitation IDs:', invitationsData.map(inv => inv.id))
        console.log('[FriendsTab] List IDs:', invitationsData.map(inv => inv.list_id))
        console.log('[FriendsTab] Inviter IDs:', invitationsData.map(inv => inv.inviter_id))
        console.log('[FriendsTab] Invitee IDs (should all be', user.id, '):', invitationsData.map(inv => inv.invitee_id))
        console.log('[FriendsTab] Roles:', invitationsData.map(inv => inv.role))
        
        // Check if lists are null (RLS issue?)
        const nullLists = invitationsData.filter(inv => !inv.lists)
        if (nullLists.length > 0) {
          console.warn('[FriendsTab] WARNING: Some invitations have null lists (RLS issue?):', nullLists.length)
          console.warn('[FriendsTab] Invitation IDs with null lists:', nullLists.map(inv => inv.id))
          console.warn('[FriendsTab] List IDs that could not be loaded:', nullLists.map(inv => inv.list_id))
          console.warn('[FriendsTab] This suggests the RLS policy "Invitees can view lists they are invited to" might not be working')
        } else {
          console.log('[FriendsTab] All invitations have valid list data - RLS is working correctly')
        }
      } else {
        console.log('[FriendsTab] No pending invitations found for user:', user.id)
        console.log('[FriendsTab] This could mean:')
        console.log('[FriendsTab]   1. No invitations have been sent to this user')
        console.log('[FriendsTab]   2. All invitations have been accepted/rejected')
        console.log('[FriendsTab]   3. RLS policy is blocking access (check Migration 021)')
      }
      console.log('[FriendsTab] ==========================================')

      // Fetch inviter profiles
      const inviterIds = [...new Set((invitationsData || []).map(inv => inv.inviter_id))]
      let inviterProfiles = new Map()
      
      if (inviterIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('user_profiles')
            .select('*')
            .in('id', inviterIds)

          if (profilesData) {
            upsertProfiles(profilesData)
            profilesData.forEach(profile => {
              inviterProfiles.set(profile.id, {
                id: profile.id,
                email: profile.email,
                user_metadata: {
                  username: profile.username || profile.email?.split('@')[0] || '',
                  profileImageUrl: profile.profile_image_url
                }
              })
            })
          }
        } catch (err) {
          console.warn('Could not fetch inviter profiles:', err)
        }
      }

      // Combine invitations with inviter profiles
      // WICHTIG: Auch wenn list null ist (RLS issue), zeigen wir die Einladung an
      const invitationsWithProfiles = (invitationsData || []).map(inv => {
        const list = inv.lists
        const inviterProfile = inviterProfiles.get(inv.inviter_id) || {
          id: inv.inviter_id,
          email: null,
          user_metadata: {}
        }
        
        // Wenn list null ist, versuchen wir die Liste direkt zu laden (Fallback)
        if (!list && inv.list_id) {
          console.warn('[FriendsTab] fetchListInvitations: List is null for invitation:', inv.id, 'list_id:', inv.list_id)
          console.warn('[FriendsTab] fetchListInvitations: This might be a RLS issue. The user might not have permission to view the list.')
        }
        
        return {
          ...inv,
          list: list || {
            id: inv.list_id,
            list_name: 'Unbekannte Liste',
            city: 'Unbekannt',
            category: null,
            description: null,
            cover_image_url: null,
            created_at: inv.created_at
          },
          inviterProfile
        }
      })

      console.log('[FriendsTab] STEP 3: Processing invitations with profiles')
      console.log('[FriendsTab] Processed invitations:', invitationsWithProfiles.length)
      console.log('[FriendsTab] Invitations with valid lists:', invitationsWithProfiles.filter(inv => inv.list && inv.list.list_name !== 'Unbekannte Liste').length)
      console.log('[FriendsTab] Invitations with fallback lists:', invitationsWithProfiles.filter(inv => inv.list && inv.list.list_name === 'Unbekannte Liste').length)
      
      setListInvitations(invitationsWithProfiles)
      console.log('[FriendsTab] State updated: listInvitations.length =', invitationsWithProfiles.length)
      console.log('[FriendsTab] ==========================================')
    } catch (error) {
      console.error('[FriendsTab] ==========================================')
      console.error('[FriendsTab] ERROR: fetchListInvitations failed')
      console.error('[FriendsTab] Error:', error)
      console.error('[FriendsTab] Error code:', error.code)
      console.error('[FriendsTab] Error message:', error.message)
      console.error('[FriendsTab] Error details:', error.details)
      console.error('[FriendsTab] Error hint:', error.hint)
      console.error('[FriendsTab] ==========================================')
      setListInvitations([])
    } finally {
      setListInvitationsLoading(false)
      console.log('[FriendsTab] fetchListInvitations: Fetch completed, loading = false')
    }
  }

  // Accept list invitation
  const handleAcceptInvitation = async (invitationId) => {
    if (!user) {
      console.log('[FriendsTab] handleAcceptInvitation: No user')
      return
    }
    
    console.log('[FriendsTab] handleAcceptInvitation: Starting for invitation:', invitationId, 'user:', user.id)
    
    try {
      // First check if invitation still exists and is pending
      console.log('[FriendsTab] handleAcceptInvitation: Checking invitation status')
      const { data: existingInvitation, error: checkError } = await supabase
        .from('list_invitations')
        .select('id, list_id, role, status, invitee_id')
        .eq('id', invitationId)
        .eq('invitee_id', user.id)
        .single()

      if (checkError || !existingInvitation) {
        console.error('[FriendsTab] handleAcceptInvitation: Invitation not found:', checkError)
        showToast('Einladung nicht gefunden', 'error')
        fetchListInvitations()
        return
      }

      console.log('[FriendsTab] handleAcceptInvitation: Invitation found:', existingInvitation)

      if (existingInvitation.status !== 'pending') {
        console.log('[FriendsTab] handleAcceptInvitation: Invitation already processed, status:', existingInvitation.status)
        showToast('Einladung wurde bereits bearbeitet', 'info')
        fetchListInvitations()
        return
      }

      // Check if user is already a member (idempotency check)
      const { data: existingMember } = await supabase
        .from('list_members')
        .select('id')
        .eq('list_id', existingInvitation.list_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        showToast('Du bist bereits Mitglied dieser Liste', 'info')
        fetchListInvitations()
        fetchSharedLists()
        return
      }

      console.log('[FriendsTab] handleAcceptInvitation: Calling accept_invitation RPC')

      const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_invitation', {
        p_invitation_id: invitationId
      })

      if (rpcError) {
        console.error('[FriendsTab] ==========================================')
        console.error('[FriendsTab] handleAcceptInvitation: RPC error')
        console.error('[FriendsTab] Error code:', rpcError.code)
        console.error('[FriendsTab] Error message:', rpcError.message)
        console.error('[FriendsTab] Error details:', rpcError.details)
        console.error('[FriendsTab] Error hint:', rpcError.hint)
        console.error('[FriendsTab] ==========================================')

        if (rpcError.code === 'P0002' || rpcError.message?.includes('Invitation not found')) {
          showToast('Einladung wurde bereits bearbeitet', 'info')
          await fetchListInvitations()
          return
        }

        if (rpcError.code === '23505') {
          showToast('Du bist bereits Mitglied dieser Liste', 'info')
          await Promise.all([
            fetchListInvitations(),
            fetchSharedLists()
          ])
          return
        }

        if (rpcError.code === '42501' || rpcError.message?.includes('permission denied')) {
          console.error('[FriendsTab] handleAcceptInvitation: Prüfe RLS-Policies (Migration 021/024)')
          showToast('Keine Berechtigung: Bitte Migrationen prüfen', 'error')
          throw rpcError
        }

        throw rpcError
      }

      console.log('[FriendsTab] handleAcceptInvitation: RPC success, joined list:', rpcResult)
      
      // Refresh data immediately (wait for completion)
      await Promise.all([
        fetchListInvitations(),
        fetchSharedLists()
      ])

      hapticFeedback.success()
      showToast('Einladung angenommen', 'success')
      
      // Navigate to dashboard with shared lists view after a short delay
      setTimeout(() => {
        navigate('/dashboard?view=geteilt')
      }, 500)
    } catch (error) {
      console.error('[FriendsTab] ==========================================')
      console.error('[FriendsTab] handleAcceptInvitation: FATAL ERROR')
      console.error('[FriendsTab] Error:', error)
      console.error('[FriendsTab] Error code:', error.code)
      console.error('[FriendsTab] Error message:', error.message)
      console.error('[FriendsTab] Error details:', error.details)
      console.error('[FriendsTab] Error hint:', error.hint)
      console.error('[FriendsTab] ==========================================')
      
      // Show detailed error message to user
      let errorMessage = 'Fehler beim Annehmen der Einladung'
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        errorMessage = 'Keine Berechtigung: Bitte stelle sicher, dass Migration 024 ausgeführt wurde'
      } else if (error.code === '23505') {
        errorMessage = 'Du bist bereits Mitglied dieser Liste'
      } else if (error.message) {
        errorMessage = `Fehler: ${error.message}`
      }
      
      showToast(errorMessage, 'error')
      hapticFeedback.error()
      
      // Refresh invitations to update UI
      fetchListInvitations()
    }
  }

  // Reject list invitation
  const handleRejectInvitation = async (invitationId) => {
    if (!user) {
      console.log('[FriendsTab] handleRejectInvitation: No user')
      return
    }
    
    console.log('[FriendsTab] handleRejectInvitation: Starting for invitation:', invitationId, 'user:', user.id)
    
    try {
      const { error } = await supabase
        .from('list_invitations')
        .update({ 
          status: 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitationId)
        .eq('invitee_id', user.id)
        .eq('status', 'pending')

      if (error) {
        console.error('[FriendsTab] handleRejectInvitation: Error rejecting invitation:', error)
        throw error
      }

      console.log('[FriendsTab] handleRejectInvitation: Successfully rejected invitation:', invitationId)
      
      // Refresh invitations immediately
      await fetchListInvitations()
      
      hapticFeedback.light()
      showToast('Einladung abgelehnt', 'success')
    } catch (error) {
      console.error('[FriendsTab] handleRejectInvitation: Error:', error)
      showToast('Fehler beim Ablehnen der Einladung', 'error')
      hapticFeedback.error()
    }
  }

  // Fetch shared lists for Social-Tab
  // WICHTIG: Nur Listen nach Annahme anzeigen (keine pending invitations)
  const fetchSharedLists = async () => {
    if (!user) return
    
    console.log('[FriendsTab] fetchSharedLists: Starting fetch for user:', user.id)
    setSharedListsLoading(true)
    try {
      // Fetch lists where user is a member (already accepted)
      // WICHTIG: Nur eigene Mitgliedschaften abfragen (keine Join auf lists, um Rekursion zu vermeiden)
      // Dann die Liste separat abfragen, wenn der User Zugriff hat
      const { data: memberListsData, error: memberError } = await supabase
        .from('list_members')
        .select('list_id, role, joined_at')
        .eq('user_id', user.id)

      if (memberError) {
        console.error('[FriendsTab] fetchSharedLists: Error fetching memberships:', memberError)
        if (memberError.code === 'PGRST200' || memberError.code === '42P01' || memberError.message?.includes('does not exist')) {
          console.log('[FriendsTab] fetchSharedLists: Table does not exist, returning empty array')
          setSharedLists([])
          setSharedListsLoading(false)
          return
        }
        // Wenn es ein RLS-Problem ist, versuchen wir es trotzdem fortzusetzen
        if (memberError.code === '42P17' || memberError.message?.includes('recursion')) {
          console.error('[FriendsTab] fetchSharedLists: Recursion error - this should be fixed by Migration 023')
          // Fallback: Leeres Array zurückgeben
          setSharedLists([])
          setSharedListsLoading(false)
          return
        }
        throw memberError
      }

      // Fetch lists owned by user that are shared
      // WICHTIG: Nur Listen anzeigen, die mindestens einen angenommenen Member haben
      const { data: ownedListsData } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      let sharedOwnedLists = []
      if (ownedListsData && ownedListsData.length > 0) {
        // Check which owned lists have at least one accepted member
        // WICHTIG: Als Owner können wir alle Mitglieder sehen (Policy 2)
        // Aber wir müssen vorsichtig sein, um Rekursion zu vermeiden
        try {
          const { data: listMembersData, error: listMembersError } = await supabase
            .from('list_members')
            .select('list_id')
            .in('list_id', ownedListsData.map(l => l.id))
            .neq('user_id', user.id) // Exclude owner

          if (listMembersError) {
            console.error('[FriendsTab] fetchSharedLists: Error fetching list members for owned lists:', listMembersError)
            // Wenn es ein RLS-Problem ist (Rekursion), versuchen wir es anders
            if (listMembersError.code === '42P17' || listMembersError.message?.includes('recursion')) {
              console.error('[FriendsTab] fetchSharedLists: Recursion error when fetching members - this should be fixed by Migration 023')
              // Fallback: Zeige alle owned lists als shared (nicht ideal, aber funktioniert)
              sharedOwnedLists = ownedListsData
              console.log('[FriendsTab] fetchSharedLists: Fallback: Showing all owned lists as shared')
            } else {
              throw listMembersError
            }
          } else {
            // Nur Listen mit mindestens einem angenommenen Member
            const sharedListIds = new Set([
              ...(listMembersData || []).map(m => m.list_id)
            ])

            sharedOwnedLists = ownedListsData.filter(list => sharedListIds.has(list.id))
            console.log('[FriendsTab] fetchSharedLists: Found', sharedOwnedLists.length, 'shared owned lists')
          }
        } catch (error) {
          console.error('[FriendsTab] fetchSharedLists: Error in owned lists logic:', error)
          // Continue with empty array
          sharedOwnedLists = []
        }
      }

      // Fetch list details for member lists
      // WICHTIG: Abfrage über lists-Tabelle, nicht über Join, um Rekursion zu vermeiden
      let memberListsWithDetails = []
      if (memberListsData && memberListsData.length > 0) {
        const listIds = memberListsData.map(m => m.list_id)
        const { data: listsData, error: listsError } = await supabase
          .from('lists')
          .select('*')
          .in('id', listIds)
        
        if (listsError) {
          console.error('[FriendsTab] fetchSharedLists: Error fetching list details:', listsError)
          // Continue with empty array if lists can't be fetched
        } else {
          // Combine member data with list data
          memberListsWithDetails = (listsData || []).map(list => {
            const memberData = memberListsData.find(m => m.list_id === list.id)
            return {
              ...list,
              membershipRole: memberData?.role || 'editor',
              isOwner: false,
              joinedAt: memberData?.joined_at
            }
          })
        }
      }
      
      // Combine member lists and shared owned lists
      const allSharedLists = [
        ...memberListsWithDetails,
        ...sharedOwnedLists.map(l => ({
          ...l,
          membershipRole: 'owner',
          isOwner: true,
          joinedAt: l.created_at
        }))
      ]

      // Remove duplicates
      const uniqueSharedLists = allSharedLists.reduce((acc, list) => {
        if (!list || !list.id) return acc
        if (!acc.find(l => l.id === list.id)) {
          acc.push(list)
        }
        return acc
      }, [])

      // Fetch member counts and member avatars for each list
      const sharedListsWithDetails = await Promise.all(
        uniqueSharedLists.map(async (list) => {
          let memberProfiles = []
          let usedRpc = false

          try {
            const { data: rpcMembers, error: rpcError } = await supabase.rpc('get_shared_list_members', { p_list_id: list.id })
            if (!rpcError && Array.isArray(rpcMembers) && rpcMembers.length > 0) {
              usedRpc = true
              const uniqueMembers = new Map()

              rpcMembers.forEach(member => {
                if (!member?.user_id) return
                const username =
                  member.username ||
                  (member.email ? member.email.split('@')[0] : '') ||
                  member.user_id.substring(0, 8)

                uniqueMembers.set(member.user_id, {
                  id: member.user_id,
                  username,
                  profileImageUrl: member.profile_image_url || null,
                  role: member.role || (member.user_id === list.user_id ? 'owner' : 'viewer')
                })
              })

              if (!uniqueMembers.has(list.user_id)) {
                let fallbackUsername = list.user_id.substring(0, 8)
                let fallbackAvatar = null
                try {
                  const { data: ownerProfileData, error: ownerProfileError } = await supabase.rpc('get_user_profile', { user_id: list.user_id })
                  if (!ownerProfileError && ownerProfileData && ownerProfileData.length > 0) {
                    fallbackUsername = ownerProfileData[0].username || fallbackUsername
                    fallbackAvatar = ownerProfileData[0].profile_image_url || null
                  }
                } catch (ownerErr) {
                  console.warn('[FriendsTab] get_user_profile failed for owner', list.user_id, ownerErr)
                }

                uniqueMembers.set(list.user_id, {
                  id: list.user_id,
                  username: fallbackUsername,
                  profileImageUrl: fallbackAvatar,
                  role: 'owner'
                })
              }

              const ownerEntry = uniqueMembers.get(list.user_id)
              const otherEntries = Array.from(uniqueMembers.values()).filter(m => m.id !== list.user_id)
              memberProfiles = ownerEntry ? [ownerEntry, ...otherEntries] : [...otherEntries]

              if (memberProfiles.length > 0) {
                upsertProfiles(memberProfiles.map(p => ({
                  id: p.id,
                  username: p.username,
                  profile_image_url: p.profileImageUrl
                })))
              }
            }
          } catch (rpcError) {
            console.error('[FriendsTab] fetchSharedLists: RPC get_shared_list_members failed', rpcError)
          }

          if (!usedRpc) {
            const { data: membersData } = await supabase
              .from('list_members')
              .select('user_id, role, joined_at')
              .eq('list_id', list.id)

            const allUserIds = new Set([list.user_id])
            if (membersData) {
              membersData.forEach(m => allUserIds.add(m.user_id))
            }

            const { data: allProfiles } = await supabase
              .from('user_profiles')
              .select('id, username, profile_image_url')
              .in('id', Array.from(allUserIds))

            const processedIds = new Set()
            const fallbackMembers = []
            const ownerProfile = allProfiles?.find(p => p.id === list.user_id)
            if (ownerProfile) {
              fallbackMembers.push({
                id: ownerProfile.id,
                username: ownerProfile.username || ownerProfile.id.substring(0, 8),
                profileImageUrl: ownerProfile.profile_image_url,
                role: 'owner'
              })
              processedIds.add(ownerProfile.id)
            }

            if (membersData) {
              membersData.forEach(m => {
                if (!processedIds.has(m.user_id)) {
                  const profile = allProfiles?.find(p => p.id === m.user_id)
                  fallbackMembers.push({
                    id: m.user_id,
                    username: profile?.username || m.user_id.substring(0, 8),
                    profileImageUrl: profile?.profile_image_url,
                    role: m.role
                  })
                  processedIds.add(m.user_id)
                }
              })
            }

            memberProfiles = fallbackMembers

            if (memberProfiles.length > 0) {
              upsertProfiles(memberProfiles.map(p => ({
                id: p.id,
                username: p.username,
                profile_image_url: p.profileImageUrl
              })))
            }
          }

          console.log(`[FriendsTab] List "${list.list_name}": ${memberProfiles.length} total members`)

          const { count } = await supabase
            .from('foodspots')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)

          return {
            ...list,
            memberCount: memberProfiles.length,
            memberAvatars: memberProfiles,
            entryCount: count || 0
          }
        })
      )

      setSharedLists(sharedListsWithDetails.sort((a, b) => {
        const aDate = new Date(a.updated_at || a.created_at || 0)
        const bDate = new Date(b.updated_at || b.created_at || 0)
        return bDate - aDate
      }))
    } catch (error) {
      console.error('Error fetching shared lists:', error)
      setSharedLists([])
    } finally {
      setSharedListsLoading(false)
    }
  }

  // Format time ago (e.g., "vor 5 Min", "vor 2 Std")
  const formatTimeAgo = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'gerade eben'
    if (diffMins < 60) return `vor ${diffMins} Min`
    if (diffHours < 24) return `vor ${diffHours} Std`
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
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

  const sharedListsToDisplay = useMemo(() => (
    showAllSharedLists ? sharedLists : sharedLists.slice(0, SHARED_LISTS_PREVIEW_LIMIT)
  ), [sharedLists, showAllSharedLists, SHARED_LISTS_PREVIEW_LIMIT])

  const friendsToDisplay = useMemo(() => (
    showAllFriends ? friends : friends.slice(0, FRIENDS_PREVIEW_LIMIT)
  ), [friends, showAllFriends, FRIENDS_PREVIEW_LIMIT])

  // Don't show loading screen if we're just loading invitations
  if (loading && friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0) {
    return (
      <div className={`flex flex-col ${
        isDark ? 'bg-gray-900' : 'bg-white'
      }`}>
        <SectionSkeleton isDark={isDark} rows={4} />
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Search and Invite */}
      <div className={`p-4 border-b ${
        isDark ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className={`relative ${
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
      </div>

      {/* Content */}
      <div className="flex-1">
        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <div className="p-4 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
            <h3 className={`text-sm font-semibold mb-3 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Suchergebnisse
            </h3>
            {searchLoading ? (
              <SectionSkeleton isDark={isDark} rows={2} />
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
                      className={`p-4 rounded-xl border shadow-sm pressable ${
                        isDark ? 'bg-gray-800 border-gray-700/70' : 'bg-white border-gray-200/70'
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

        {/* List Invitations - Show FIRST, before friend requests */}
        {/* WICHTIG: Sektion immer anzeigen, damit Einladungen sofort sichtbar sind */}
        <div className="p-4 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className={`text-sm font-semibold ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Einladungen {listInvitations.length > 0 && `(${listInvitations.length})`}
            </h3>
            {listInvitations.length > 0 && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          {listInvitationsLoading ? (
            <SectionSkeleton isDark={isDark} rows={2} />
          ) : listInvitations.length === 0 ? (
            <div className={`text-center py-4 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <p className="text-xs">Keine ausstehenden Einladungen</p>
            </div>
          ) : (
              <div className="space-y-3">
                {listInvitations.map((invitation) => {
                  const list = invitation.list
                  const inviter = invitation.inviterProfile
                  const role = invitation.role || 'editor'
                  
                  // Zeige Einladung auch an, wenn Liste nicht geladen werden konnte
                  if (!list) {
                    console.warn('[FriendsTab] Invitation has no list:', invitation.id, 'list_id:', invitation.list_id)
                    // Fallback: Zeige Einladung mit minimalen Daten
                    return (
                      <div
                        key={invitation.id}
                        className={`p-4 rounded-xl border shadow-sm pressable ${
                          isDark ? 'bg-gray-800 border-gray-700/70' : 'bg-white border-gray-200/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isDark ? 'bg-gray-700' : 'bg-gray-100'
                          }`}>
                            <span className="text-2xl">📋</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm mb-1 ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              Liste (ID: {invitation.list_id?.substring(0, 8)}...)
                            </p>
                            <p className={`text-xs ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Liste konnte nicht geladen werden
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptInvitation(invitation.id)}
                            className="flex-1 py-2 px-4 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white rounded-lg font-medium transition-all active:scale-95"
                          >
                            Annehmen
                          </button>
                          <button
                            onClick={() => handleRejectInvitation(invitation.id)}
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
                  }
                  
                  return (
                    <div
                      key={invitation.id}
                      className={`p-4 rounded-xl border shadow-sm pressable ${
                        isDark ? 'bg-gray-800 border-gray-700/70' : 'bg-white border-gray-200/70'
                      }`}
                    >
                      {/* List Preview */}
                      <div className="flex items-start gap-3 mb-3">
                        {list.cover_image_url ? (
                          <img
                            src={list.cover_image_url}
                            alt={list.list_name}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isDark ? 'bg-gray-700' : 'bg-gray-100'
                          }`}>
                            <span className="text-2xl">📋</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm mb-1 ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {list.list_name}
                          </p>
                          <p className={`text-xs mb-1 ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {list.city} {list.category && `• ${list.category}`}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <UserAvatar user={inviter} size={20} />
                            <p className={`text-xs ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {getUsername(inviter)} lädt dich ein
                            </p>
                          </div>
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              role === 'editor' 
                                ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                : (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700')
                            }`}>
                              {role === 'editor' ? 'Editor' : 'Viewer'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            hapticFeedback.light()
                            setShowInvitationDetails(invitation.id)
                          }}
                          className={`px-3 py-2 rounded-lg font-medium transition-all active:scale-95 text-xs ${
                            isDark
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          className="flex-1 py-2 px-4 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white rounded-lg font-medium transition-all active:scale-95"
                        >
                          Annehmen
                        </button>
                        <button
                          onClick={() => handleRejectInvitation(invitation.id)}
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
          )}
        </div>

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


        {/* Shared Lists Section */}
        <div className="p-4">
          <h3 className={`text-sm font-semibold mb-3 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Geteilte Listen ({sharedLists.length})
          </h3>
          {sharedListsLoading && sharedLists.length === 0 ? (
            <div className={`text-center py-8 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className="text-xs mt-2">Lädt geteilte Listen...</p>
            </div>
          ) : sharedLists.length === 0 ? (
            <div className={`text-center py-8 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="text-4xl mb-4">🤝</div>
              <p className="text-sm">Noch keine geteilten Listen</p>
              <p className="text-xs mt-1">Erstelle eine geteilte Liste oder akzeptiere eine Einladung</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedListsToDisplay.map((list) => {
                if (!list || !list.id) return null
                
                return (
                  <button
                    key={list.id}
                    onClick={() => {
                      hapticFeedback.light()
                      navigate(`/shared/tierlist/${list.id}`)
                    }}
                    className={`w-full p-4 rounded-xl text-left transition-all active:scale-[0.98] ${
                      isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Cover Image */}
                      {list.cover_image_url ? (
                        <img
                          src={list.cover_image_url}
                          alt={list.list_name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDark ? 'bg-gray-700' : 'bg-gray-100'
                        }`}>
                          <span className="text-2xl">📋</span>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`font-semibold text-sm truncate ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {list.list_name}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                          }`}>
                            Geteilt
                          </span>
                        </div>
                        <p className={`text-xs mb-2 truncate ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {list.city} {list.category && `• ${list.category}`}
                        </p>
                        
                        {/* Member Avatars & Info */}
                        <div className="flex items-center gap-2 mb-2">
                          {list.memberAvatars && list.memberAvatars.length > 0 && (
                            <div className="flex -space-x-2">
                              {list.memberAvatars.slice(0, 4).map((member, idx) => (
                                <div
                                  key={member.id}
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    isDark ? 'border-gray-800' : 'border-white'
                                  }`}
                                  style={{ zIndex: 10 - idx }}
                                  title={member.username}
                                >
                                  <UserAvatar user={member} size={24} />
                                </div>
                              ))}
                              {list.memberCount > 4 && (
                                <div 
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${
                                    isDark 
                                      ? 'border-gray-800 bg-gray-700 text-gray-300' 
                                      : 'border-white bg-gray-200 text-gray-700'
                                  }`}
                                  title={`${list.memberCount - 4} weitere Mitglieder`}
                                >
                                  +{list.memberCount - 4}
                                </div>
                              )}
                            </div>
                          )}
                          <span className={`text-xs ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {list.memberCount} {list.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}
                          </span>
                          {list.membershipRole && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              list.membershipRole === 'owner' || list.membershipRole === 'editor'
                                ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                : (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700')
                            }`}>
                              {list.membershipRole === 'owner' ? 'Owner' : list.membershipRole === 'editor' ? 'Editor' : 'Viewer'}
                            </span>
                          )}
                        </div>
                        
                        {/* Entry Count & Last Update */}
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            🧾 {list.entryCount || 0} {list.entryCount === 1 ? 'Eintrag' : 'Einträge'}
                          </span>
                          {list.updated_at && (
                            <span className={`text-xs ${
                              isDark ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {formatTimeAgo(list.updated_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                )
              })}
              {(!showAllSharedLists && sharedLists.length > SHARED_LISTS_PREVIEW_LIMIT) && (
                <button
                  onClick={() => {
                    hapticFeedback.light()
                    setShowAllSharedLists(true)
                  }}
                  className={`w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-white hover:bg-gray-100 text-gray-700'
                  }`}
                  aria-label="Alle geteilten Listen anzeigen"
                >
                  Alle geteilten Listen anzeigen
                </button>
              )}
            </div>
          )}
        </div>

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
              {friendsToDisplay.map((friendship) => {
                const friend = friendship.friend
                if (!friend) return null

                return (
                  <button
                    key={friendship.id}
                    onClick={() => {
                      // Speichere aktuelle Route und Scrollposition, bevor wir navigieren
                      sessionStorage.setItem('social_previous_path', window.location.pathname)
                      
                      // Finde den Scroll-Container im Social-Component
                      // Der Container ist im Parent-Component (Social.jsx), daher müssen wir ihn über das DOM finden
                      const socialMain = document.querySelector('main[class*="overflow-y-auto"]')
                      if (socialMain) {
                        const scrollPosition = socialMain.scrollTop
                        sessionStorage.setItem('social_scroll_position', scrollPosition.toString())
                      }
                      
                      navigate(`/friend/${friend.id}`)
                    }}
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
              {(!showAllFriends && friends.length > FRIENDS_PREVIEW_LIMIT) && (
                <button
                  onClick={() => {
                    hapticFeedback.light()
                    setShowAllFriends(true)
                  }}
                  className={`w-full mt-3 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] border-2 ${
                    isDark 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                  aria-label="Alle Freunde anzeigen"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  + {friends.length - FRIENDS_PREVIEW_LIMIT} weitere Freunde anzeigen
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
          style={{ animation: 'fadeSlideUp 0.3s ease-out' }}
        >
          <div className={`rounded-[16px] px-6 py-4 shadow-xl flex items-center gap-3 max-w-[90vw] ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'info' ? 'bg-blue-500 text-white' :
            'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : toast.type === 'info' ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-semibold text-sm whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* Floating Action Button with Menu */}
      <div className="fixed bottom-6 right-6 z-10">
        {/* FAB Menu */}
        {showFABMenu && (
          <div className="absolute bottom-20 right-0 mb-2">
            <div className={`rounded-xl shadow-2xl p-2 min-w-[200px] ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}>
        <button
          onClick={() => {
            setShowFABMenu(false)
            hapticFeedback.light()
            navigate('/create-shared-list')
          }}
                className={`w-full px-4 py-3 rounded-lg text-left transition-all active:scale-95 flex items-center gap-3 ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Geteilte Liste erstellen
                </span>
              </button>
            </div>
          </div>
        )}
        
        {/* FAB Button */}
        <button
          onClick={() => {
            setShowFABMenu(!showFABMenu)
            hapticFeedback.light()
          }}
          className={`w-14 h-14 text-white rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl hover:scale-105 transition-all active:scale-95 ${
            isDark
              ? 'bg-gradient-to-br from-[#FF9357] to-[#B85C2C]'
              : 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
          } ${showFABMenu ? 'rotate-45' : ''}`}
          style={{ boxShadow: '0 8px 24px rgba(255, 125, 66, 0.35)' }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Click outside to close FAB menu */}
      {showFABMenu && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => setShowFABMenu(false)}
        />
      )}

      {/* Invitation Details Modal */}
      {selectedList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowInvitationDetails(null)}
        >
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Einladungsdetails
                </h3>
                <button
                  onClick={() => setShowInvitationDetails(null)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* List Preview */}
              <div className="flex items-start gap-3">
                {selectedList.cover_image_url ? (
                  <img
                    src={selectedList.cover_image_url}
                    alt={selectedList.list_name}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className="text-3xl">📋</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-base mb-1 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedList.list_name}
                  </h4>
                  <p className={`text-sm mb-2 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {selectedList.city} {selectedList.category && `• ${selectedList.category}`}
                  </p>
                  {selectedList.description && (
                    <p className={`text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {selectedList.description}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Inviter Info */}
              <div className={`p-3 rounded-lg ${
                isDark ? 'bg-gray-700/50' : 'bg-white/80'
              }`}>
                <p className={`text-xs mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Eingeladen von
                </p>
                <div className="flex items-center gap-2">
                  <UserAvatar user={selectedInviter} size={32} />
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getUsername(selectedInviter)}
                  </span>
                </div>
              </div>
              
              {/* Role Info */}
              <div className={`p-3 rounded-lg ${
                isDark ? 'bg-gray-700/50' : 'bg-white/80'
              }`}>
                <p className={`text-xs mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Deine Rolle
                </p>
                <span className={`text-sm px-3 py-1.5 rounded-lg inline-block ${
                  selectedRole === 'editor'
                    ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                    : (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700')
                }`}>
                  {selectedRole === 'editor' ? 'Editor' : 'Viewer'}
                </span>
                <p className={`text-xs mt-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {selectedRole === 'editor' 
                    ? 'Du kannst Einträge hinzufügen, bearbeiten und löschen.'
                    : 'Du kannst die Liste nur ansehen, aber keine Änderungen vornehmen.'}
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className={`p-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowInvitationDetails(null)
                    handleRejectInvitation(selectedInvitation.id)
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all active:scale-95 ${
                    isDark
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Ablehnen
                </button>
                <button
                  onClick={() => {
                    setShowInvitationDetails(null)
                    handleAcceptInvitation(selectedInvitation.id)
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all active:scale-95 ${
                    isDark
                      ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C] text-white hover:shadow-lg'
                      : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white hover:shadow-lg'
                  }`}
                >
                  Annehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FriendsTab