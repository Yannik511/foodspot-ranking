import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import UserAvatar from './UserAvatar'
import { supabase } from '../../services/supabase'
import { hapticFeedback } from '../../utils/haptics'

function CreateSharedList({ initialParticipants = [], onClose }) {
  const { user } = useAuth()
  const { isDark } = useTheme()
  
  const [step, setStep] = useState(1) // Nur Schritt 1 (Freunde auswählen) wird verwendet
  const [participants, setParticipants] = useState(() => {
    // Initialize with user ID + initialParticipants (excluding duplicates)
    return []
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [availableFriends, setAvailableFriends] = useState([])
  const [filteredFriends, setFilteredFriends] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [friendsCache, setFriendsCache] = useState(null)
  const [cacheTimestamp, setCacheTimestamp] = useState(0)
  const [fetchError, setFetchError] = useState(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const debounceTimerRef = useRef(null)
  
  // Roles (nur für Anzeige, nicht mehr für Listen-Erstellung)
  const [roles, setRoles] = useState({}) // { userId: 'editor' | 'viewer' }
  
  // Initialize participants on mount
  useEffect(() => {
    if (user) {
      // Always include user.id first, then initialParticipants (excluding user.id)
      const allParticipants = [
        user.id,
        ...initialParticipants.filter(id => id && id !== user.id)
      ]
      setParticipants(allParticipants)
      // Initialize roles for all participants
      const initialRoles = allParticipants.reduce((acc, id) => ({
        ...acc,
        [id]: 'editor'
      }), {})
      setRoles(initialRoles)
    }
  }, [user]) // Run when user is available
  
  useEffect(() => {
    if (step === 1 && user) {
      fetchFriends()
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [step, user])

  // Click outside handler to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showSuggestions &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
      }
    }

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showSuggestions])

  const fetchFriends = async (forceRefresh = false) => {
    if (!user) return

    // Check cache validity (5 minutes)
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
    const isCacheValid = friendsCache && (Date.now() - cacheTimestamp) < CACHE_DURATION

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid) {
      setAvailableFriends(friendsCache)
      return
    }

    setLoading(true)
    setFetchError(null)
    try {
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted')

      if (friendshipsError) throw friendshipsError

      if (!friendships || friendships.length === 0) {
        setAvailableFriends([])
        setFriendsCache([])
        setCacheTimestamp(Date.now())
        setLoading(false)
        return
      }

      const friendIds = friendships.map(f => 
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      )

      // Fetch friend profiles (with pagination if >500)
      let allProfiles = []
      const PAGE_SIZE = 500
      
      for (let i = 0; i < friendIds.length; i += PAGE_SIZE) {
        const pageIds = friendIds.slice(i, i + PAGE_SIZE)
        
        let profiles = null
        let profilesError = null
        
        try {
          // Try to fetch from user_profiles view first
          const result = await supabase
            .from('user_profiles')
            .select('*')
            .in('id', pageIds)
          
          profiles = result.data
          profilesError = result.error
        } catch (viewError) {
          // If view fails, fallback to RPC
          profilesError = viewError
        }

        // If view query failed, try RPC fallback
        if (profilesError || !profiles) {
          try {
            const rpcResults = await Promise.all(
              pageIds.map(async (id) => {
                try {
                  const { data } = await supabase.rpc('get_user_profile', { user_id: id })
                  return data?.[0] ? { id, ...data[0] } : null
                } catch (rpcError) {
                  console.warn(`Failed to fetch profile for user ${id}:`, rpcError)
                  return null
                }
              })
            )
            profiles = rpcResults.filter(Boolean)
            profilesError = null
          } catch (rpcFallbackError) {
            console.error('RPC fallback also failed:', rpcFallbackError)
            // Continue with empty profiles for this page
            profiles = []
          }
        }

        if (profiles && profiles.length > 0) {
          allProfiles = [...allProfiles, ...profiles]
        }
      }

      const friends = allProfiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        user_metadata: {
          username: profile.username || profile.email?.split('@')[0] || '',
          profileImageUrl: profile.profile_image_url
        },
        displayName: profile.username || profile.email?.split('@')[0] || ''
      }))

      setAvailableFriends(friends)
      setFriendsCache(friends)
      setCacheTimestamp(Date.now())
    } catch (error) {
      console.error('Error fetching friends:', error)
      setFetchError('Freundesliste konnte nicht geladen werden')
      // Keep cached data if available
      if (friendsCache) {
        setAvailableFriends(friendsCache)
      }
    } finally {
      setLoading(false)
    }
  }

  const filterFriends = useCallback((query) => {
    if (!query.trim()) {
      setFilteredFriends([])
      setShowSuggestions(false)
      return
    }

    const queryLower = query.toLowerCase().trim()
    
    // Filter: exclude current user and already selected participants
    const available = availableFriends.filter(friend => 
      friend.id !== user?.id && !participants.includes(friend.id)
    )

    // Filter by prefix match on username first, then displayName
    const filtered = available.filter(friend => {
      const username = (friend.user_metadata?.username || friend.email?.split('@')[0] || '').toLowerCase()
      const displayName = (friend.displayName || username).toLowerCase()
      
      return username.startsWith(queryLower) || displayName.startsWith(queryLower)
    })

    // Sort: username matches first, then displayName matches
    const sorted = filtered.sort((a, b) => {
      const aUsername = (a.user_metadata?.username || a.email?.split('@')[0] || '').toLowerCase()
      const bUsername = (b.user_metadata?.username || b.email?.split('@')[0] || '').toLowerCase()
      const aDisplayName = (a.displayName || aUsername).toLowerCase()
      const bDisplayName = (b.displayName || bUsername).toLowerCase()
      
      const aUsernameMatch = aUsername.startsWith(queryLower)
      const bUsernameMatch = bUsername.startsWith(queryLower)
      
      if (aUsernameMatch && !bUsernameMatch) return -1
      if (!aUsernameMatch && bUsernameMatch) return 1
      return aDisplayName.localeCompare(bDisplayName)
    })

    setFilteredFriends(sorted.slice(0, 6)) // Max 6 suggestions
    setShowSuggestions(sorted.length > 0)
    setSelectedSuggestionIndex(-1)
  }, [availableFriends, participants, user])

  // Debounced filter function
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (searchQuery.trim() === '') {
      setFilteredFriends([])
      setShowSuggestions(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      filterFriends(searchQuery)
    }, 250)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, filterFriends])

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value)
    setShowSuggestions(true)
  }

  const handleInputFocus = () => {
    if (searchQuery.trim() && filteredFriends.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = (e) => {
    // Delay to allow click on suggestions
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false)
      }
    }, 200)
  }

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedSuggestionIndex]
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedSuggestionIndex])

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredFriends.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        // Try to select first match if any
        if (filteredFriends.length > 0) {
          selectFriend(filteredFriends[0])
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => {
          const next = prev < filteredFriends.length - 1 ? prev + 1 : prev
          return next
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < filteredFriends.length) {
          selectFriend(filteredFriends[selectedSuggestionIndex])
        } else if (filteredFriends.length > 0) {
          selectFriend(filteredFriends[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSearchQuery('')
        setSelectedSuggestionIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const selectFriend = (friend) => {
    if (friend.id === user?.id || participants.includes(friend.id)) return
    
    setParticipants([...participants, friend.id])
    setRoles({ ...roles, [friend.id]: 'editor' }) // Default to editor (nur für Anzeige)
    setSearchQuery('')
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    hapticFeedback.light()
  }

  const removeParticipant = (userId) => {
    if (userId === user?.id) return // Can't remove self
    setParticipants(participants.filter(id => id !== userId))
    const newRoles = { ...roles }
    delete newRoles[userId]
    setRoles(newRoles)
    hapticFeedback.light()
  }

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="font-bold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }

  const handleCreate = async () => {
    // FEATURE DEAKTIVIERT: Geteilte Listen werden nicht mehr erstellt
    // Diese Funktion zeigt nur Freunde an und schließt dann das Modal
    hapticFeedback.light()
    onClose()
    return
  }

  const getUsername = (userData) => {
    return userData?.user_metadata?.username || userData?.email?.split('@')[0] || 'Unbekannt'
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      isDark ? 'bg-gray-900/95' : 'bg-white/95'
    } backdrop-blur-sm`}>
      <div className={`w-full max-w-lg max-h-[90vh] rounded-[24px] shadow-2xl ${
        isDark ? 'bg-gray-800' : 'bg-white'
      } flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className={`text-lg font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Freunde auswählen
          </h2>
          <div className="w-10" />
        </div>


        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Teilnehmer auswählen
                </h3>

                {/* Selected Participants as Chips */}
                {participants.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {participants.map((userId) => {
                      const participant = userId === user?.id 
                        ? user 
                        : availableFriends.find(f => f.id === userId)
                      if (!participant) return null
                      
                      const isCurrentUser = userId === user?.id
                      return (
                        <div
                          key={userId}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
                            isDark ? 'bg-gray-700' : 'bg-gray-100'
                          }`}
                        >
                          <UserAvatar user={participant} size={24} />
                          <span className={`text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {isCurrentUser ? 'Du' : getUsername(participant)}
                          </span>
                          {!isCurrentUser && (
                            <button
                              onClick={() => removeParticipant(userId)}
                              className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center ${
                                isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                              } transition-colors`}
                              aria-label="Entfernen"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Search Input with Auto-Complete */}
                <div className="relative">
                  <div className={`relative rounded-xl overflow-hidden ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  } ${fetchError ? 'ring-2 ring-red-500' : ''}`}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Freunde suchen..."
                      value={searchQuery}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      onKeyDown={handleKeyDown}
                      className={`w-full px-4 py-3 pr-10 ${
                        isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                      } outline-none`}
                      aria-autocomplete="list"
                      aria-expanded={showSuggestions}
                      aria-controls="friend-suggestions"
                      aria-label="Freunde suchen"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {loading && (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      )}
                      {fetchError && (
                        <button
                          onClick={() => fetchFriends(true)}
                          className="w-5 h-5 text-red-500 hover:text-red-600"
                          aria-label="Erneut versuchen"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Suggestions Dropdown */}
                  {showSuggestions && (
                    <div
                      ref={suggestionsRef}
                      id="friend-suggestions"
                      className={`absolute z-50 w-full mt-1 rounded-xl shadow-xl border max-h-64 overflow-y-auto ${
                        isDark 
                          ? 'bg-gray-800 border-gray-700' 
                          : 'bg-white border-gray-200'
                      }`}
                      role="listbox"
                      aria-label="Freunde Vorschläge"
                    >
                      {loading && searchQuery.trim() ? (
                        <div className={`px-4 py-3 flex items-center gap-2 ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm">Suche...</span>
                        </div>
                      ) : filteredFriends.length === 0 ? (
                        <div className={`px-4 py-3 text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Keine Treffer – versuche @username
                        </div>
                      ) : (
                        filteredFriends.map((friend, index) => {
                          const username = friend.user_metadata?.username || friend.email?.split('@')[0] || ''
                          const displayName = friend.displayName || username
                          const isSelected = selectedSuggestionIndex === index
                          
                          return (
                            <button
                              key={friend.id}
                              onClick={() => selectFriend(friend)}
                              onMouseEnter={() => setSelectedSuggestionIndex(index)}
                              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                                isSelected
                                  ? isDark 
                                    ? 'bg-gray-700' 
                                    : 'bg-gray-100'
                                  : isDark 
                                    ? 'hover:bg-gray-700' 
                                    : 'hover:bg-gray-50'
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <UserAvatar user={friend} size={40} />
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm truncate ${
                                  isDark ? 'text-white' : 'text-gray-900'
                                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                                  {highlightMatch(displayName, searchQuery)}
                                </p>
                                <p className={`text-xs truncate ${
                                  isDark ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  @{highlightMatch(username, searchQuery)}
                                </p>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Error Toast - Show for both fetch and create errors */}
                {fetchError && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 ${
                    isDark 
                      ? 'bg-red-900/30 text-red-400 border border-red-800/50' 
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    <span className="flex-1">{fetchError}</span>
                    <button
                      onClick={() => setFetchError(null)}
                      className={`text-xs px-2 py-1 rounded ${
                        isDark 
                          ? 'hover:bg-red-900/50' 
                          : 'hover:bg-red-100'
                      } transition-colors`}
                      aria-label="Schließen"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Current User (Always Selected) */}
                {user && (
                  <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                  } opacity-75`}>
                    <UserAvatar user={user} size={40} />
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        Du
                      </p>
                      <p className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Immer dabei
                      </p>
                    </div>
                    <div className="text-green-500">✓</div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-3 px-4 rounded-xl font-medium bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white transition-all active:scale-95`}
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateSharedList

