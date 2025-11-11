import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import UserAvatar from './UserAvatar'
import { supabase } from '../../services/supabase'
import { hapticFeedback } from '../../utils/haptics'

// Kategorien (gleiche wie in SelectCategory)
const CATEGORIES = {
  'Döner': { emoji: '🥙', color: '#FF7E42' },
  'Burger': { emoji: '🍔', color: '#FFB25A' },
  'Pizza': { emoji: '🍕', color: '#FF9C68' },
  'Asiatisch': { emoji: '🍜', color: '#FF7E42' },
  Bratwurst: { emoji: '🥓', color: '#FFB25A' },
  'Glühwein': { emoji: '🍷', color: '#FF9C68' },
  'Sushi': { emoji: '🍣', color: '#FF7E42' },
  'Steak': { emoji: '🥩', color: '#FF9C68' },
  'Fast Food': { emoji: '🍔', color: '#FFB25A' },
  Streetfood: { emoji: '🌯', color: '#FF7E42' },
  'Deutsche Küche': { emoji: '🥨', color: '#FF9C68' },
  'Bier': { emoji: '🍺', color: '#FFB25A' }
}

const CITIES = [
  'München', 'Berlin', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart', 
  'Düsseldorf', 'Dortmund', 'Amsterdam', 'Barcelona', 'Brussels', 'Budapest', 
  'Copenhagen', 'Dublin', 'Lisbon', 'London', 'Madrid', 'Milan', 'Oslo', 
  'Paris', 'Prague', 'Rome', 'Stockholm', 'Vienna', 'Warsaw', 'Zurich'
]

function CreateSharedList({ onClose }) {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  // Stepper State
  const [step, setStep] = useState(1) // 1: Mitglieder, 2: Details, 3: Zusammenfassung
  
  // Schritt 1: Mitglieder
  const [participants, setParticipants] = useState([]) // Nur andere Mitglieder (ohne Owner)
  const [roles, setRoles] = useState({}) // { userId: 'editor' | 'viewer' }
  const [searchQuery, setSearchQuery] = useState('')
  const [availableFriends, setAvailableFriends] = useState([])
  const [filteredFriends, setFilteredFriends] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [friendsCache, setFriendsCache] = useState(null)
  const [cacheTimestamp, setCacheTimestamp] = useState(0)
  const [fetchError, setFetchError] = useState(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const debounceTimerRef = useRef(null)
  
  // Schritt 2: Listen-Details
  const [listDetails, setListDetails] = useState({
    list_name: '',
    city: '',
    category: null,
    description: '',
    coverImageFile: null,
    coverImageUrl: null
  })
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [citySearchTerm, setCitySearchTerm] = useState('')
  const cityDropdownRef = useRef(null)
  const cityInputRef = useRef(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // Allgemein
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  
  // Initialize: Owner ist immer dabei
  useEffect(() => {
    if (user && participants.length === 0) {
      // Owner wird nicht in participants gespeichert, da er automatisch Owner ist
      setParticipants([])
    }
  }, [user])
  
  // Fetch friends for step 1
  useEffect(() => {
    if (step === 1 && user) {
      fetchFriends()
    }
  }, [step, user])
  
  // City filtering
  const filteredCities = useMemo(() => {
    if (!citySearchTerm.trim()) return CITIES
    const search = citySearchTerm.toLowerCase()
    return CITIES.filter(city => 
      city.toLowerCase().includes(search) ||
      city.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').includes(search)
    )
  }, [citySearchTerm])
  
  // Fetch friends
  const fetchFriends = async (forceRefresh = false) => {
    if (!user) return
    
    const CACHE_DURATION = 5 * 60 * 1000
    const isCacheValid = friendsCache && (Date.now() - cacheTimestamp) < CACHE_DURATION
    
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
      
      let allProfiles = []
      const PAGE_SIZE = 500
      
      for (let i = 0; i < friendIds.length; i += PAGE_SIZE) {
        const pageIds = friendIds.slice(i, i + PAGE_SIZE)
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('*')
          .in('id', pageIds)
        
        if (profiles) {
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
      if (friendsCache) {
        setAvailableFriends(friendsCache)
      }
    } finally {
      setLoading(false)
    }
  }
  
  // Filter friends
  const filterFriends = useCallback((query) => {
    if (!query.trim()) {
      setFilteredFriends([])
      setShowSuggestions(false)
      return
    }
    
    const queryLower = query.toLowerCase().trim()
    const available = availableFriends.filter(friend => 
      friend.id !== user?.id && !participants.includes(friend.id)
    )
    
    const filtered = available.filter(friend => {
      const username = (friend.user_metadata?.username || friend.email?.split('@')[0] || '').toLowerCase()
      const displayName = (friend.displayName || username).toLowerCase()
      return username.startsWith(queryLower) || displayName.startsWith(queryLower)
    })
    
    const sorted = filtered.sort((a, b) => {
      const aUsername = (a.user_metadata?.username || a.email?.split('@')[0] || '').toLowerCase()
      const bUsername = (b.user_metadata?.username || b.email?.split('@')[0] || '').toLowerCase()
      const aUsernameMatch = aUsername.startsWith(queryLower)
      const bUsernameMatch = bUsername.startsWith(queryLower)
      if (aUsernameMatch && !bUsernameMatch) return -1
      if (!aUsernameMatch && bUsernameMatch) return 1
      return aUsername.localeCompare(bUsername)
    })
    
    setFilteredFriends(sorted.slice(0, 6))
    setShowSuggestions(sorted.length > 0)
    setSelectedSuggestionIndex(-1)
  }, [availableFriends, participants, user])
  
  // Debounced filter
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
  
  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSuggestions && suggestionsRef.current && !suggestionsRef.current.contains(event.target) && inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
      if (isCityDropdownOpen && cityDropdownRef.current && !cityDropdownRef.current.contains(event.target) && cityInputRef.current && !cityInputRef.current.contains(event.target)) {
        setIsCityDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSuggestions, isCityDropdownOpen])
  
  // Select friend
  const selectFriend = (friend) => {
    if (friend.id === user?.id || participants.includes(friend.id)) return
    
    setParticipants([...participants, friend.id])
    setRoles({ ...roles, [friend.id]: 'editor' }) // Default: Editor
    setSearchQuery('')
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    hapticFeedback.light()
  }
  
  // Remove participant
  const removeParticipant = (userId) => {
    setParticipants(participants.filter(id => id !== userId))
    const newRoles = { ...roles }
    delete newRoles[userId]
    setRoles(newRoles)
    hapticFeedback.light()
  }
  
  // Toggle role
  const toggleRole = (userId) => {
    setRoles({
      ...roles,
      [userId]: roles[userId] === 'editor' ? 'viewer' : 'editor'
    })
    hapticFeedback.light()
  }
  
  // Handle image upload
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Bild ist zu groß (max. 5MB)')
      return
    }
    
    setUploadingImage(true)
    setError(null)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('list-covers')
        .upload(fileName, file, { upsert: false })
      
      if (uploadError) throw uploadError
      
      const { data: urlData } = supabase.storage
        .from('list-covers')
        .getPublicUrl(fileName)
      
      if (!urlData?.publicUrl) throw new Error('Failed to get public URL')
      
      setListDetails({
        ...listDetails,
        coverImageFile: file,
        coverImageUrl: urlData.publicUrl
      })
    } catch (err) {
      console.error('Image upload error:', err)
      setError('Bild konnte nicht hochgeladen werden')
    } finally {
      setUploadingImage(false)
    }
  }
  
  // Validation
  const canProceedToStep2 = () => {
    return participants.length > 0 // Mindestens ein Mitglied
  }
  
  const canProceedToStep3 = () => {
    return listDetails.list_name.trim().length >= 3 && 
           listDetails.city.trim().length >= 2
  }
  
  // Create shared list
  const handleCreate = async () => {
    if (!user || !canProceedToStep3()) return
    
    setCreating(true)
    setError(null)
    
    try {
      // 1. Create list
      const { data: newList, error: listError } = await supabase
        .from('lists')
        .insert({
          user_id: user.id,
          list_name: listDetails.list_name.trim(),
          city: listDetails.city.trim(),
          category: listDetails.category,
          description: listDetails.description.trim() || null,
          cover_image_url: listDetails.coverImageUrl
        })
        .select()
        .single()
      
      if (listError) throw listError
      
      // 2. Create invitations for all participants
      console.log('[CreateSharedList] ==========================================')
      console.log('[CreateSharedList] STEP 1: Creating invitations')
      console.log('[CreateSharedList] List ID:', newList.id)
      console.log('[CreateSharedList] Owner ID (inviter_id):', user.id)
      console.log('[CreateSharedList] Participants count:', participants.length)
      console.log('[CreateSharedList] Participants IDs:', participants)
      
      // Validate: Ensure no NULL IDs
      if (!newList.id) {
        throw new Error('List ID is null - cannot create invitations')
      }
      if (!user.id) {
        throw new Error('User ID is null - cannot create invitations')
      }
      const validParticipants = participants.filter(id => id && typeof id === 'string')
      if (validParticipants.length === 0) {
        throw new Error('No valid participants - at least one participant required for shared list')
      }
      if (validParticipants.length !== participants.length) {
        console.warn('[CreateSharedList] Filtered out invalid participants:', participants.length - validParticipants.length)
      }
      
      // Check for existing invitations to prevent duplicates
      console.log('[CreateSharedList] STEP 2: Checking for existing invitations')
      const { data: existingInvitations, error: checkError } = await supabase
        .from('list_invitations')
        .select('invitee_id, status, id')
        .eq('list_id', newList.id)
        .in('invitee_id', validParticipants)
      
      if (checkError) {
        console.error('[CreateSharedList] Error checking existing invitations:', checkError)
        // Continue anyway - might be first time
      }
      
      const existingInviteeIds = new Set(
        (existingInvitations || [])
          .filter(inv => inv.status === 'pending' || inv.status === 'accepted')
          .map(inv => inv.invitee_id)
      )
      
      console.log('[CreateSharedList] Existing invitations found:', existingInviteeIds.size)
      if (existingInviteeIds.size > 0) {
        console.log('[CreateSharedList] Existing invitee IDs:', Array.from(existingInviteeIds))
      }
      
      // Filter out users who already have pending or accepted invitations
      const newParticipants = validParticipants.filter(userId => !existingInviteeIds.has(userId))
      
      if (newParticipants.length === 0) {
        console.log('[CreateSharedList] All participants already have invitations - skipping creation')
        hapticFeedback.success()
        onClose()
        navigate('/dashboard?view=geteilt')
        return
      }
      
      console.log('[CreateSharedList] STEP 3: Preparing invitation payload')
      console.log('[CreateSharedList] New participants to invite:', newParticipants.length)
      console.log('[CreateSharedList] Skipped (duplicates):', validParticipants.length - newParticipants.length)
      
      // Build invitations payload - ensure all required fields are present
      const invitations = newParticipants.map(userId => {
        if (!userId || typeof userId !== 'string') {
          throw new Error(`Invalid invitee_id: ${userId}`)
        }
        return {
          list_id: newList.id,
          inviter_id: user.id,
          invitee_id: userId,
          role: roles[userId] || 'editor',
          status: 'pending'
        }
      })
      
      // Validate payload
      const invalidInvitations = invitations.filter(inv => 
        !inv.list_id || !inv.inviter_id || !inv.invitee_id || !inv.role || inv.status !== 'pending'
      )
      if (invalidInvitations.length > 0) {
        console.error('[CreateSharedList] Invalid invitations:', invalidInvitations)
        throw new Error(`Invalid invitation payload: ${invalidInvitations.length} invitations have missing fields`)
      }
      
      console.log('[CreateSharedList] Invitations payload (validated):', invitations.map(inv => ({
        list_id: inv.list_id,
        inviter_id: inv.inviter_id,
        invitee_id: inv.invitee_id,
        role: inv.role,
        status: inv.status
      })))
      
      console.log('[CreateSharedList] STEP 4: Inserting invitations into database')
      const { data: insertedInvitations, error: invitationsError } = await supabase
        .from('list_invitations')
        .insert(invitations)
        .select()
      
      if (invitationsError) {
        console.error('[CreateSharedList] ==========================================')
        console.error('[CreateSharedList] ERROR: Failed to create invitations')
        console.error('[CreateSharedList] Error code:', invitationsError.code)
        console.error('[CreateSharedList] Error message:', invitationsError.message)
        console.error('[CreateSharedList] Error details:', invitationsError.details)
        console.error('[CreateSharedList] Error hint:', invitationsError.hint)
        console.error('[CreateSharedList] Attempted to insert:', invitations.length, 'invitations')
        console.error('[CreateSharedList] ==========================================')
        
        // Rollback: Delete list if invitations fail
        console.log('[CreateSharedList] Rolling back: Deleting list', newList.id)
        await supabase.from('lists').delete().eq('id', newList.id)
        throw invitationsError
      }
      
      console.log('[CreateSharedList] ==========================================')
      console.log('[CreateSharedList] SUCCESS: Invitations created')
      console.log('[CreateSharedList] Inserted invitations count:', insertedInvitations?.length || 0)
      console.log('[CreateSharedList] Invitation IDs:', insertedInvitations?.map(inv => inv.id) || [])
      console.log('[CreateSharedList] Invitee IDs:', insertedInvitations?.map(inv => inv.invitee_id) || [])
      console.log('[CreateSharedList] List IDs (all should be same):', insertedInvitations?.map(inv => inv.list_id) || [])
      console.log('[CreateSharedList] Inviter IDs (all should be same):', insertedInvitations?.map(inv => inv.inviter_id) || [])
      console.log('[CreateSharedList] ==========================================')
      
      // Verify all invitations were created
      if (!insertedInvitations || insertedInvitations.length !== newParticipants.length) {
        console.error('[CreateSharedList] WARNING: Not all invitations were created!')
        console.error('[CreateSharedList] Expected:', newParticipants.length, 'Got:', insertedInvitations?.length || 0)
      }
      
      hapticFeedback.success()
      onClose()
      navigate('/dashboard?view=geteilt')
    } catch (err) {
      console.error('Error creating shared list:', err)
      setError(err.message || 'Fehler beim Erstellen der Liste')
      hapticFeedback.error()
    } finally {
      setCreating(false)
    }
  }
  
  const getUsername = (userData) => {
    return userData?.user_metadata?.username || userData?.email?.split('@')[0] || 'Unbekannt'
  }
  
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? <span key={i} className="font-bold">{part}</span> : <span key={i}>{part}</span>
    )
  }
  
  // Render Step 1: Mitglieder
  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Teilnehmer auswählen
        </h3>
        
        {/* Selected Participants */}
        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {participants.map((userId) => {
              const participant = availableFriends.find(f => f.id === userId)
              if (!participant) return null
              
              return (
                <div
                  key={userId}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                >
                  <UserAvatar user={participant} size={24} />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getUsername(participant)}
                  </span>
                  <button
                    onClick={() => removeParticipant(userId)}
                    className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Search Input */}
        <div className="relative">
          <div className={`relative rounded-xl overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Freunde suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              className={`w-full px-4 py-3 pr-10 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} outline-none`}
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          
          {/* Suggestions */}
          {showSuggestions && (
            <div
              ref={suggestionsRef}
              className={`absolute z-50 w-full mt-1 rounded-xl shadow-xl border max-h-64 overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            >
              {filteredFriends.length === 0 ? (
                <div className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Keine Treffer
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
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left ${isSelected ? (isDark ? 'bg-gray-700' : 'bg-gray-100') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}
                    >
                      <UserAvatar user={friend} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {highlightMatch(displayName, searchQuery)}
                        </p>
                        <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
        
        {/* Role Selection for Participants */}
        {participants.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Rollen zuweisen:
            </p>
            {participants.map((userId) => {
              const participant = availableFriends.find(f => f.id === userId)
              if (!participant) return null
              const role = roles[userId] || 'editor'
              
              return (
                <div key={userId} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={participant} size={32} />
                    <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {getUsername(participant)}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleRole(userId)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${role === 'editor' ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700')}`}
                  >
                    {role === 'editor' ? 'Editor' : 'Viewer'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Current User Info */}
        {user && (
          <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} opacity-75`}>
            <UserAvatar user={user} size={40} />
            <div className="flex-1">
              <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Du (Owner)</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Immer dabei</p>
            </div>
            <div className="text-green-500">✓</div>
          </div>
        )}
      </div>
    </div>
  )
  
  // Render Step 2: Details
  const renderStep2 = () => (
    <div className="space-y-4">
      {/* List Name */}
      <div>
        <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Listenname <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={listDetails.list_name}
          onChange={(e) => setListDetails({ ...listDetails, list_name: e.target.value })}
          placeholder="z. B. Beste Burger Münchens"
          className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'} outline-none focus:ring-2 focus:ring-[#FF7E42]/20`}
        />
      </div>
      
      {/* City */}
      <div>
        <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Stadt <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            ref={cityInputRef}
            type="text"
            value={listDetails.city}
            onChange={(e) => {
              setListDetails({ ...listDetails, city: e.target.value })
              setCitySearchTerm(e.target.value)
              setIsCityDropdownOpen(true)
            }}
            onFocus={() => setIsCityDropdownOpen(true)}
            placeholder="z. B. München"
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'} outline-none focus:ring-2 focus:ring-[#FF7E42]/20`}
          />
          {isCityDropdownOpen && filteredCities.length > 0 && (
            <div
              ref={cityDropdownRef}
              className={`absolute z-50 w-full mt-2 rounded-xl shadow-xl border max-h-64 overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            >
              {filteredCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    setListDetails({ ...listDetails, city })
                    setCitySearchTerm('')
                    setIsCityDropdownOpen(false)
                  }}
                  className={`w-full px-4 py-3 text-left ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Category */}
      <div>
        <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Kategorie (optional)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(CATEGORIES).map(([category, { emoji }]) => (
            <button
              key={category}
              type="button"
              onClick={() => setListDetails({ ...listDetails, category: listDetails.category === category ? null : category })}
              className={`p-3 rounded-xl border-2 transition-all ${listDetails.category === category ? (isDark ? 'border-[#FF9357] bg-[#FF9357]/10' : 'border-[#FF7E42] bg-[#FF7E42]/10') : (isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300')}`}
            >
              <div className="text-2xl mb-1">{emoji}</div>
              <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{category}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Description */}
      <div>
        <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Beschreibung (optional)
        </label>
        <textarea
          value={listDetails.description}
          onChange={(e) => setListDetails({ ...listDetails, description: e.target.value })}
          placeholder="Beschreibe deine Liste..."
          rows={3}
          className={`w-full px-4 py-3 rounded-xl border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'} outline-none focus:ring-2 focus:ring-[#FF7E42]/20`}
        />
      </div>
      
      {/* Cover Image */}
      <div>
        <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Cover-Bild (optional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          id="cover-image-input"
        />
        <label
          htmlFor="cover-image-input"
          className={`block w-full p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'}`}
        >
          {uploadingImage ? (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Wird hochgeladen...</span>
            </div>
          ) : listDetails.coverImageUrl ? (
            <div className="text-center">
              <img src={listDetails.coverImageUrl} alt="Cover" className="w-full h-32 object-cover rounded-lg mb-2" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Bild auswählen</span>
            </div>
          ) : (
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Bild auswählen</span>
            </div>
          )}
        </label>
      </div>
    </div>
  )
  
  // Render Step 3: Zusammenfassung
  const renderStep3 = () => {
    const selectedFriends = participants.map(userId => availableFriends.find(f => f.id === userId)).filter(Boolean)
    
    return (
      <div className="space-y-4">
        <div>
          <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Zusammenfassung
          </h3>
          
          {/* List Details */}
          <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex items-start gap-4">
              {listDetails.coverImageUrl && (
                <img src={listDetails.coverImageUrl} alt="Cover" className="w-20 h-20 object-cover rounded-lg" />
              )}
              <div className="flex-1">
                <h4 className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {listDetails.list_name}
                </h4>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {listDetails.city} {listDetails.category && `• ${listDetails.category}`}
                </p>
                {listDetails.description && (
                  <p className={`text-sm mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {listDetails.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Participants */}
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Teilnehmer ({selectedFriends.length + 1})
            </p>
            <div className="space-y-2">
              {/* Owner */}
              {user && (
                <div className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={user} size={32} />
                    <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Du (Owner)</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white'}`}>
                    Owner
                  </span>
                </div>
              )}
              
              {/* Members */}
              {selectedFriends.map((friend) => {
                const role = roles[friend.id] || 'editor'
                return (
                  <div key={friend.id} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <UserAvatar user={friend} size={32} />
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {getUsername(friend)}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${role === 'editor' ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700')}`}>
                      {role === 'editor' ? 'Editor' : 'Viewer'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-sm`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div 
        className={`w-full max-w-lg rounded-[24px] shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'} flex flex-col`}
        style={{
          maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)',
          height: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)',
          margin: '1rem',
          minHeight: 'min(500px, calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem))',
        }}
      >
        {/* Header - Sticky */}
        <div className={`flex items-center justify-between p-4 border-b flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            {step === 1 && 'Schritt 1: Mitglieder'}
            {step === 2 && 'Schritt 2: Listen-Details'}
            {step === 3 && 'Schritt 3: Zusammenfassung'}
          </h2>
          <div className="w-10" />
        </div>
        
        {/* Stepper Indicator - Sticky */}
        <div className={`px-4 py-3 border-b flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  s < step ? (isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white') :
                  s === step ? (isDark ? 'bg-[#FF9357] text-white' : 'bg-[#FF7E42] text-white') :
                  (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                }`}>
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${s < step ? (isDark ? 'bg-green-600' : 'bg-green-500') : (isDark ? 'bg-gray-700' : 'bg-gray-200')}`} />
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Content - Scrollable */}
        <div 
          className="flex-1 overflow-y-auto p-4"
          style={{
            minHeight: 0, // Wichtig für flex-1 overflow
          }}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          
          {/* Error Message */}
          {error && (
            <div className={`mt-4 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
              {error}
            </div>
          )}
        </div>
        
        {/* Footer - Sticky */}
        <div className={`p-4 border-t flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex gap-3">
            {step < 3 ? (
              <>
                <button
                  onClick={onClose}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => {
                    if (step === 1 && canProceedToStep2()) {
                      setStep(2)
                      hapticFeedback.light()
                    } else if (step === 2 && canProceedToStep3()) {
                      setStep(3)
                      hapticFeedback.light()
                    }
                  }}
                  disabled={(step === 1 && !canProceedToStep2()) || (step === 2 && !canProceedToStep3())}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                    ((step === 1 && canProceedToStep2()) || (step === 2 && canProceedToStep3()))
                      ? `text-white ${isDark ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]' : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'}`
                      : (isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  }`}
                >
                  Weiter
                </button>
              </>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating || !canProceedToStep3()}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-all ${
                  !creating && canProceedToStep3()
                    ? `text-white ${isDark ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]' : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'}`
                    : (isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                }`}
              >
                {creating ? 'Wird erstellt...' : 'Liste erstellen'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateSharedList
