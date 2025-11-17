import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { useHeaderHeight, getContentPaddingTop } from '../hooks/useHeaderHeight'

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

function TierList() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const [list, setList] = useState(null)
  const [foodspots, setFoodspots] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTierModal, setShowTierModal] = useState(null) // Which tier to show in modal
  const [refreshing, setRefreshing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({ list_name: '', city: '', cover_image_url: null })
  const [windowHeight, setWindowHeight] = useState(0)
  const scrollRefs = useRef({})
  const menuRef = useRef(null)
  const [sharedContextChecked, setSharedContextChecked] = useState(false)
  const { headerRef, headerHeight } = useHeaderHeight()

  // Track window height for responsive calculations
  useEffect(() => {
    const updateHeight = () => setWindowHeight(window.innerHeight)
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Shared list detection – redirect to shared component if necessary
  useEffect(() => {
    if (!user || !id || sharedContextChecked) return

    const checkSharedContext = async () => {
      const targetRoute = `/shared/tierlist/${id}`
      try {
        const { data: listMeta, error: listMetaError } = await supabase
          .from('lists')
          .select('id, user_id')
          .eq('id', id)
          .single()

        if (listMetaError) {
          if (listMetaError.code === 'PGRST116' || listMetaError.code === '42501') {
            navigate(targetRoute, { replace: true })
            return
          }
        }

        if (listMeta && listMeta.user_id !== user.id) {
          navigate(targetRoute, { replace: true })
          return
        }

        const { data: memberCheck, error: memberError } = await supabase
          .from('list_members')
          .select('id')
          .eq('list_id', id)
          .limit(1)

        if (!memberError && memberCheck && memberCheck.length > 0) {
          navigate(targetRoute, { replace: true })
          return
        }
      } catch (error) {
        console.error('Error checking shared tier context:', error)
      }

      setSharedContextChecked(true)
    }

    checkSharedContext()
  }, [user, id, navigate, sharedContextChecked])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  // Check for optimistic foodspot from AddFoodspot
  useEffect(() => {
    if (!sharedContextChecked) return

    const newFoodspotData = sessionStorage.getItem('newFoodspot')
    if (newFoodspotData && id) {
      try {
        const { listId, foodspot } = JSON.parse(newFoodspotData)
        if (listId === id) {
          // Add optimistic foodspot immediately to state
          setFoodspots(prev => {
            // Check if foodspot already exists (avoid duplicates)
            const exists = prev.some(f => 
              f.id === foodspot.id || 
              (f.id?.startsWith('temp-') && f.name === foodspot.name && f.list_id === foodspot.list_id)
            )
            if (exists) return prev
            // Add at the beginning (newest first)
            return [foodspot, ...prev]
          })
          // Don't clear sessionStorage yet - let fetchData handle it
          setLoading(false) // Ensure we're not showing loading screen
        }
      } catch (error) {
        console.error('Error parsing new foodspot:', error)
        sessionStorage.removeItem('newFoodspot')
      }
    }
  }, [id, sharedContextChecked])

  // Fetch list and foodspots
  useEffect(() => {
    if (!user || !id || !sharedContextChecked) return
    
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch list
        const { data: listData, error: listError } = await supabase
          .from('lists')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single()

        if (listError) throw listError
        setList(listData)

        // Fetch foodspots
        const { data: spotsData, error: spotsError } = await supabase
          .from('foodspots')
          .select('*')
          .eq('list_id', id)
          .order('rating', { ascending: false, nullsLast: true })

        if (spotsError) throw spotsError
        
        // Merge with existing optimistic foodspots (preserve them if real foodspot not found yet)
        const newFoodspotData = sessionStorage.getItem('newFoodspot')
        const currentFoodspots = foodspots.length > 0 ? foodspots : []
        const optimisticFoodspots = currentFoodspots.filter(f => f.id?.startsWith('temp-'))
        
        let mergedFoodspots = [...(spotsData || [])]
        
        // Add optimistic foodspots if real not found
        optimisticFoodspots.forEach(optimisticFoodspot => {
          const realFoodspotExists = spotsData?.some(s => 
            s.name === optimisticFoodspot.name && s.list_id === optimisticFoodspot.list_id
          )
          if (!realFoodspotExists) {
            mergedFoodspots.unshift(optimisticFoodspot)
          }
        })
        
        // Clear sessionStorage if real foodspot was found
        if (newFoodspotData) {
          try {
            const { listId, foodspot } = JSON.parse(newFoodspotData)
            if (listId === id) {
              const realFoodspotExists = spotsData?.some(s => 
                s.name === foodspot.name && s.list_id === foodspot.list_id
              )
              if (realFoodspotExists) {
                sessionStorage.removeItem('newFoodspot')
              }
            }
          } catch (error) {
            console.error('Error parsing new foodspot:', error)
            sessionStorage.removeItem('newFoodspot')
          }
        }
        
        // Sort by rating (highest first), but keep optimistic at top if real not found
        mergedFoodspots.sort((a, b) => {
          // Optimistic foodspots first
          if (a.id?.startsWith('temp-') && !b.id?.startsWith('temp-')) return -1
          if (!a.id?.startsWith('temp-') && b.id?.startsWith('temp-')) return 1
          // Then by rating
          const aRating = a.rating || 0
          const bRating = b.rating || 0
          return bRating - aRating
        })
        
        setFoodspots(mergedFoodspots)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to changes
    const channel = supabase
      .channel(`tierlist_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspots',
        filter: `list_id=eq.${id}`
      }, (payload) => {
        // Handle INSERT events - replace optimistic foodspot with real one
        if (payload.eventType === 'INSERT') {
          const newFoodspot = payload.new
          setFoodspots(prev => {
            // Remove optimistic foodspots with matching name
            const filtered = prev.filter(f => 
              !(f.id?.startsWith('temp-') && 
                f.name === newFoodspot.name && 
                f.list_id === newFoodspot.list_id)
            )
            // Check if foodspot already exists
            const exists = filtered.some(f => f.id === newFoodspot.id)
            if (exists) return filtered
            // Add new foodspot at the beginning
            return [newFoodspot, ...filtered].sort((a, b) => {
              const aRating = a.rating || 0
              const bRating = b.rating || 0
              return bRating - aRating
            })
          })
          // Clear sessionStorage
          sessionStorage.removeItem('newFoodspot')
        } else {
          // For UPDATE/DELETE, refresh
          fetchData()
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id, user, sharedContextChecked])

  // Group foodspots by tier
  const foodspotsByTier = TIERS.reduce((acc, tier) => {
    acc[tier] = foodspots.filter(spot => spot.tier === tier)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    return acc
  }, {})

  // Calculate dynamic tier sizing based on actual content height
  const calculateTierSizing = useMemo(() => {
    if (windowHeight === 0) return {}
    
    const MIN_TIER_HEIGHT = 120
    const CARD_HEIGHT = 80 // Card height (h-20 = 80px)
    const CARD_GAP = 8 // Gap between rows (gap-2 = 8px)
    const VERTICAL_PADDING = 8 // Padding top and bottom (pt-2/pb-2 = 8px, matches gap-2)
    const VIEW_ALL_BUTTON_HEIGHT = 32 // Button py-2 = 8px top + 8px bottom + 16px content
    const VIEW_ALL_BUTTON_TOP_PADDING = 8 // pt-2
    const VIEW_ALL_BUTTON_BOTTOM_PADDING = 12 // pb-3
    
    // Determine items to show per tier (adaptive based on screen size)
    const itemsPerRow = window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : window.innerWidth < 1280 ? 3 : 4
    const maxItemsPerTier = 5 // Private lists: show max 5 items per tier before overflow
    
    // Calculate height for each tier based on actual content
    const tierHeights = {}
    
    TIERS.forEach((tier) => {
      const count = foodspotsByTier[tier]?.length || 0
        const displayCount = Math.min(count, maxItemsPerTier)
        const hasOverflow = count > maxItemsPerTier
        
        if (count === 0) {
        // Empty tier: use minimum height
          tierHeights[tier] = {
            height: MIN_TIER_HEIGHT,
            maxItems: 0,
            hasOverflow: false
          }
        } else {
        // Calculate exact height needed for content
          const rowsNeeded = Math.ceil(displayCount / itemsPerRow)
        const gridHeight = (rowsNeeded * CARD_HEIGHT) + ((rowsNeeded - 1) * CARD_GAP)
        const viewAllSectionHeight = hasOverflow 
          ? VIEW_ALL_BUTTON_TOP_PADDING + VIEW_ALL_BUTTON_HEIGHT + VIEW_ALL_BUTTON_BOTTOM_PADDING 
          : 0
        // Total content height: padding top + grid + view all section (if needed) + padding bottom
        // Bottom padding is always VERTICAL_PADDING (4px), except when overflow exists (then it's included in viewAllSectionHeight)
        const totalContentHeight = VERTICAL_PADDING + gridHeight + viewAllSectionHeight + (hasOverflow ? 0 : VERTICAL_PADDING)
        
        // Height must match content exactly, but never below minimum
          tierHeights[tier] = {
          height: Math.max(MIN_TIER_HEIGHT, totalContentHeight),
            maxItems: displayCount,
            hasOverflow
          }
        }
      })
    
    return tierHeights
  }, [windowHeight, foodspotsByTier])

  const handleDeleteList = async () => {
    // Optimistic update: Navigate immediately
    navigate('/dashboard')
    
    // Delete in background (non-blocking)
    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      // Real-time subscription will sync automatically
    } catch (error) {
      console.error('Error deleting list:', error)
      // Real-time subscription will handle rollback if needed
    }
  }

  const handleOpenEditModal = (field) => {
    setEditFormData({
      list_name: list.list_name,
      city: list.city,
      cover_image_url: list.cover_image_url
    })
    setShowEditModal(field)
    setMenuOpen(false)
  }

  const handleSaveEdit = async () => {
    // Optimistic update: Update UI immediately
    const previousList = { ...list }
    const updatedList = {
      ...list,
      list_name: editFormData.list_name.trim(),
      city: editFormData.city.trim(),
      cover_image_url: editFormData.cover_image_url
    }
    
    // Update UI immediately
    setList(updatedList)
    setShowEditModal(false)
    
    try {
      // Update database in background (non-blocking)
      const { error } = await supabase
        .from('lists')
        .update({
          list_name: editFormData.list_name.trim(),
          city: editFormData.city.trim(),
          cover_image_url: editFormData.cover_image_url
        })
        .eq('id', id)

      if (error) throw error
      
      // Final sync with server data
      const { data: listData } = await supabase
        .from('lists')
        .select('*')
        .eq('id', id)
        .single()
      
      if (listData) {
        setList(listData)
      }
    } catch (error) {
      console.error('Error updating list:', error)
      // Rollback on error
      setList(previousList)
      setShowEditModal(true)
      alert('Fehler beim Speichern. Bitte versuche es erneut.')
    }
  }

  const handleCoverImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Bitte wähle ein Bild aus')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Bild muss kleiner als 5MB sein')
      return
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('list-covers')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('list-covers')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        setEditFormData(prev => ({ ...prev, cover_image_url: urlData.publicUrl }))
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Fehler beim Hochladen des Bildes')
    }
  }

  const handlePullToRefresh = async () => {
    setRefreshing(true)
    // Reload data
    const { data: spotsData, error: spotsError } = await supabase
      .from('foodspots')
      .select('*')
      .eq('list_id', id)
      .order('rating', { ascending: false, nullsLast: true })

    if (!spotsError) {
      setFoodspots(spotsData || [])
    }
    setRefreshing(false)
  }

  // Don't show loading screen if we have optimistic foodspots (seamless transition)
  if (loading && !list && foodspots.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt Liste...</p>
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Liste nicht gefunden</p>
          <button
            onClick={() => navigate('/dashboard')}
            className={`px-6 py-3 text-white rounded-[14px] font-semibold ${
              isDark
                ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
            }`}
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    )
  }

  const totalSpots = foodspots.length
  const hasSpots = totalSpots > 0

  return (
    <div className={`h-full flex flex-col ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    } relative overflow-hidden`}>
      {/* Header */}
      <header 
        ref={headerRef}
        className={`header-safe border-b fixed top-0 left-0 right-0 z-20 ${
          isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
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

          <h1 
            className={`text-lg font-bold flex-1 text-center px-2 break-words ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} 
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Foodspots in {list.city}
          </h1>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {menuOpen && (
              <div className={`absolute right-0 top-12 rounded-xl shadow-xl overflow-hidden min-w-[200px] z-30 ${
                isDark ? 'bg-gray-800' : 'bg-white'
              }`}>
                <button
                  onClick={() => handleOpenEditModal('name')}
                  className={`w-full px-4 py-3 flex items-center gap-2 transition-colors text-left ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Liste umbenennen</span>
                </button>
                <button
                  onClick={() => handleOpenEditModal('city')}
                  className={`w-full px-4 py-3 flex items-center gap-2 transition-colors text-left ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Stadt ändern</span>
                </button>
                <button
                  onClick={() => handleOpenEditModal('cover')}
                  className={`w-full px-4 py-3 flex items-center gap-2 transition-colors text-left ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Titelbild ändern</span>
                </button>
                <div className={`border-t ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                }`} />
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setShowDeleteConfirm(true)
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-2 transition-colors ${
                    isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="font-medium">Liste löschen</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - All Tiers Always Visible */}
      <div 
        className={`flex-1 overflow-y-auto px-4 ${
          isDark ? 'bg-gray-900' : 'bg-gray-50'
        }`}
        style={{
          paddingTop: getContentPaddingTop(headerHeight, 24),
          paddingBottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth'
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col gap-4 pt-0 pb-4">
          {TIERS.map((tier, index) => {
            const tierData = TIER_COLORS[tier]
            const tierSpots = foodspotsByTier[tier] || []
            const tierSizing = calculateTierSizing[tier] || { height: 120, maxItems: 3, hasOverflow: false }
            const displayedSpots = tierSpots.slice(0, tierSizing.maxItems)
            const isEmpty = tierSpots.length === 0
            const isFirstTier = index === 0

            return (
              <div
                key={tier}
                ref={(el) => (scrollRefs.current[tier] = el)}
                className={`flex rounded-[20px] overflow-hidden shadow-lg transition-all duration-200 ease-out ${
                  isFirstTier ? 'mt-0' : ''
                }`}
                style={{
                  height: `${tierSizing.height}px`,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }}
              >
                {/* Left Tier Bar - Always same height as content area */}
                <div
                  className="w-20 flex items-center justify-center flex-shrink-0 h-full"
                  style={{ background: tierData.gradient }}
                >
                  <span 
                    className="text-5xl font-bold text-white" 
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {tier}
                  </span>
                </div>

                {/* Right Content Area - Always same height as tier bar */}
                <div className={`flex-1 flex flex-col h-full ${
                  isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                  {isEmpty ? (
                    <div 
                      className={`w-full h-full flex flex-col items-center justify-center ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}
                      style={{ pointerEvents: 'none' }}
                    >
                      <div className="text-5xl mb-2">
                        {tierData.emoji}
                      </div>
                      <span className={`font-medium text-sm ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Noch leer
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full justify-center">
                      <div className={`px-3 flex flex-col ${tierSizing.hasOverflow ? 'pt-2 pb-0' : 'pt-2 pb-2'}`}>
                        {/* Grid Layout für Foodspot Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                          {displayedSpots.map((spot) => (
                            <div
                              key={spot.id}
                              onClick={() => navigate(`/add-foodspot/${id}?spotId=${spot.id}`)}
                              className={`rounded-xl p-2 cursor-pointer hover:shadow-lg active:scale-[0.98] transition-all duration-150 border shadow-sm h-20 ${
                                isDark
                                  ? 'bg-gray-700 border-gray-600'
                                  : 'bg-white border-gray-200'
                              }`}
                              style={{
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)'
                              }}
                            >
                              {/* Horizontal Layout: Centered composition with text and image */}
                              <div className="flex items-center justify-center gap-1.5 h-full px-1">
                                {/* Text Content: Name, Rating, Category */}
                                <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center">
                                  {/* Name */}
                                  <h3 
                                    className={`font-bold text-sm truncate leading-tight ${
                                      isDark ? 'text-white' : 'text-gray-900'
                                    }`} 
                                    style={{ fontFamily: "'Poppins', sans-serif" }}
                                  >
                                    {spot.name}
                                  </h3>
                                  
                                  {/* Rating und Category in einer Zeile */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Rating */}
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-xs">⭐</span>
                                      <span className={`font-bold text-xs ${
                                        isDark ? 'text-white' : 'text-gray-900'
                                      }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                                        {(spot.rating || 0).toFixed(1)}/10
                                      </span>
                                    </div>
                                    
                                    {/* Category */}
                                    {spot.category && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs">
                                          {spot.category === 'Döner' && '🥙'}
                                          {spot.category === 'Burger' && '🍔'}
                                          {spot.category === 'Pizza' && '🍕'}
                                          {spot.category === 'Asiatisch' && '🍜'}
                                          {spot.category === 'Bratwurst' && '🥓'}
                                          {spot.category === 'Glühwein' && '🍷'}
                                          {spot.category === 'Deutsche Küche' && '🥨'}
                                          {spot.category === 'Bier' && '🍺'}
                                        </span>
                                        <span className={`text-xs font-medium truncate ${
                                          isDark ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          {spot.category}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Standort (optional, klein) */}
                                  {spot.address && (
                                    <p className={`text-[10px] truncate ${
                                      isDark ? 'text-gray-400' : 'text-gray-400'
                                    }`}>
                                      📍 {spot.address.split(',')[0]}
                                    </p>
                                  )}
                                </div>

                                {/* Image (rechts, immer vorhanden für einheitliche Höhe) */}
                                {spot.cover_photo_url ? (
                                  <img
                                    src={spot.cover_photo_url}
                                    alt={spot.name}
                                    className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 border ${
                                      isDark ? 'border-gray-600' : 'border-gray-200'
                                    }`}
                                  />
                                ) : (
                                  <div className={`w-16 h-16 rounded-lg flex-shrink-0 border ${
                                    isDark
                                      ? 'bg-gray-600 border-gray-500'
                                      : 'bg-gray-200 border-gray-300'
                                  }`}></div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {tierSizing.hasOverflow && (
                        <div className={`px-3 pt-2 pb-3 border-t mt-auto ${
                          isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowTierModal(tier)
                            }}
                            className={`w-full rounded-lg py-2 transition-all duration-150 text-xs font-medium ${
                              isDark
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            +{tierSpots.length - tierSizing.maxItems} ansehen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => navigate(`/add-foodspot/${id}`)}
        className={`fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl hover:scale-105 transition-all active:scale-95 z-10 ${
          isDark
            ? 'bg-gradient-to-br from-[#FF9357] to-[#B85C2C]'
            : 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
        }`}
        style={{ boxShadow: '0 8px 24px rgba(255, 125, 66, 0.35)' }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl shadow-2xl max-w-md w-full p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              {showEditModal === 'name' && 'Liste umbenennen'}
              {showEditModal === 'city' && 'Stadt ändern'}
              {showEditModal === 'cover' && 'Titelbild ändern'}
            </h2>
            
            {showEditModal === 'name' && (
              <div className="mb-6">
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Neuer Listenname
                </label>
                <input
                  type="text"
                  value={editFormData.list_name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, list_name: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                      : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
                  }`}
                  placeholder="z. B. Beste Burger Münchens"
                />
              </div>
            )}
            
            {showEditModal === 'city' && (
              <div className="mb-6">
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Neue Stadt
                </label>
                <input
                  type="text"
                  value={editFormData.city}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, city: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                      : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
                  }`}
                  placeholder="z. B. München"
                />
              </div>
            )}
            
            {showEditModal === 'cover' && (
              <div className="mb-6">
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Neues Titelbild
                </label>
                {editFormData.cover_image_url ? (
                  <div className="relative rounded-xl overflow-hidden mb-3">
                    <img 
                      src={editFormData.cover_image_url} 
                      alt="Cover" 
                      className="w-full h-48 object-cover" 
                    />
                    <button
                      onClick={() => setEditFormData(prev => ({ ...prev, cover_image_url: null }))}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleCoverImageChange} 
                      className="hidden" 
                    />
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                      isDark
                        ? 'border-gray-600 hover:border-[#FF9357] hover:bg-[#B85C2C]/20'
                        : 'border-gray-300 hover:border-[#FF7E42] hover:bg-[#FFE4C3]/30'
                    }`}>
                      <div className="text-4xl mb-2">📸</div>
                      <p className={`font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                      }`}>Bild auswählen</p>
                      <p className={`text-sm mt-1 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>PNG, JPG bis 5MB</p>
                    </div>
                  </label>
                )}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className={`flex-1 py-3 rounded-[14px] border font-semibold transition-all ${
                  isDark
                    ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveEdit}
                className={`flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg hover:shadow-xl transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                    : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
                }`}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl shadow-2xl max-w-md w-full p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Liste löschen?
            </h2>
            <p className={`mb-6 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Möchtest du diese Liste wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`flex-1 py-3 rounded-[14px] border font-semibold transition-all ${
                  isDark
                    ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteList}
                className={`flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg transition-all ${
                  isDark
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tier Modal - View All Entries */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className={`rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
            style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: TIER_COLORS[showTierModal]?.gradient }}
                >
                  {showTierModal}
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {showTierModal}-Tier
                  </h2>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {foodspotsByTier[showTierModal]?.length || 0} Foodspots
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTierModal(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <svg className={`w-6 h-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-0">
                {(foodspotsByTier[showTierModal] || []).map((spot, spotIndex) => (
                  <div key={spot.id}>
                    <div
                      onClick={() => {
                        setShowTierModal(null)
                        navigate(`/add-foodspot/${id}?spotId=${spot.id}`)
                      }}
                      className={`flex items-center gap-4 py-3 cursor-pointer rounded-lg px-3 transition-all duration-150 ${
                        isDark
                          ? 'hover:bg-gray-700 active:bg-gray-600'
                          : 'hover:bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      {/* Left: Name + Location + Rating + Category */}
                      <div className="flex-1 min-w-0">
                        {/* Name */}
                        <h3 
                          className={`font-bold text-base truncate ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`} 
                          style={{ fontFamily: "'Poppins', sans-serif" }}
                        >
                          {spot.name}
                        </h3>
                        
                        {/* Standort (wenn verfügbar) */}
                        {spot.address && (
                          <p className={`text-xs truncate mt-1 ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            📍 {spot.address.split(',')[0]}
                          </p>
                        )}
                        
                        {/* Bewertung */}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-base">⭐</span>
                          <span className={`font-bold text-sm ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                            {(spot.rating || 0).toFixed(1)}/10
                          </span>
                        </div>
                        
                        {/* Kategorie mit Emoji */}
                        {spot.category && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-sm">
                              {spot.category === 'Döner' && '🥙'}
                              {spot.category === 'Burger' && '🍔'}
                              {spot.category === 'Pizza' && '🍕'}
                              {spot.category === 'Asiatisch' && '🍜'}
                              {spot.category === 'Bratwurst' && '🥓'}
                              {spot.category === 'Glühwein' && '🍷'}
                              {spot.category === 'Deutsche Küche' && '🥨'}
                              {spot.category === 'Bier' && '🍺'}
                              {spot.category === 'Leberkässemmel' && '🥪'}
                              {spot.category === 'Bier' && '🍺'}
                              {spot.category === 'Leberkässemmel' && '🥪'}
                            </span>
                            <span className={`text-sm font-medium ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {spot.category}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Image */}
                      {spot.cover_photo_url ? (
                        <img
                          src={spot.cover_photo_url}
                          alt={spot.name}
                          className={`w-16 h-16 object-cover rounded-[12px] flex-shrink-0 border ${
                            isDark ? 'border-gray-600' : 'border-gray-200'
                          }`}
                        />
                      ) : (
                        <div className="w-16 h-16 flex-shrink-0" />
                      )}
                    </div>
                    {spotIndex < foodspotsByTier[showTierModal].length - 1 && (
                      <div className={`h-px mx-3 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
      `}</style>
    </div>
  )
}

export default TierList

