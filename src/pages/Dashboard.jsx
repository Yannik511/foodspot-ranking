import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import WelcomeCard from '../components/WelcomeCard'
import FeaturesSection from '../components/FeaturesSection'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'

function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Initialize with optimistic list from sessionStorage if available
  const [lists, setLists] = useState(() => {
    const newListData = sessionStorage.getItem('newList')
    if (newListData) {
      try {
        const newList = JSON.parse(newListData)
        return [newList]
      } catch (error) {
        console.error('Error parsing new list:', error)
        sessionStorage.removeItem('newList')
      }
    }
    return []
  })
  const [loading, setLoading] = useState(() => {
    // Don't show loading if we have an optimistic list
    const newListData = sessionStorage.getItem('newList')
    return !newListData
  })
  const [userFoodEmoji] = useState(null)
  const [editingList, setEditingList] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [windowHeight, setWindowHeight] = useState(0)
  const [toast, setToast] = useState(null)
  const [menuOpenForList, setMenuOpenForList] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  
  // Long press refs
  const longPressRefs = useRef({})
  const longPressTimer = useRef(null)

  // Track window height for responsive calculations
  useEffect(() => {
    const updateHeight = () => setWindowHeight(window.innerHeight)
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Note: Optimistic list is now initialized in useState initializer above
  // This ensures it's available immediately on first render

  // Fetch lists with entry counts
  useEffect(() => {
    const fetchListsWithCounts = async () => {
      if (!user) return
      
      setLoading(true)
      try {
        // Fetch lists
        const { data: listsData, error: listsError } = await supabase
          .from('lists')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (listsError) throw listsError

        // Fetch foodspot counts for all lists
        const listsWithCounts = await Promise.all(
          (listsData || []).map(async (list) => {
            const { count, error: countError } = await supabase
              .from('foodspots')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id)

            if (countError) {
              console.error('Error fetching count for list:', list.id, countError)
              return { ...list, entryCount: 0 }
            }

            return { ...list, entryCount: count || 0 }
          })
        )

        // Merge with existing optimistic lists (preserve them if real list not found yet)
        const newListData = sessionStorage.getItem('newList')
        
        // Find optimistic lists from current state (temp IDs)
        const optimisticLists = lists.filter(l => l.id?.startsWith('temp-'))
        
        // Merge: Start with fetched lists, then add optimistic if not found
        const mergedLists = [...listsWithCounts]
        
        // Add optimistic lists if real list not found yet
        optimisticLists.forEach(optimisticList => {
          const realListExists = listsWithCounts.some(l => 
            l.list_name === optimisticList.list_name && l.city === optimisticList.city
          )
          if (!realListExists) {
            // Real list not found yet, keep optimistic at the beginning
            mergedLists.unshift(optimisticList)
          }
        })
        
        // Also check sessionStorage for new optimistic list (in case state wasn't updated yet)
        if (newListData) {
          try {
            const newList = JSON.parse(newListData)
            const realListExists = listsWithCounts.some(l => 
              l.list_name === newList.list_name && l.city === newList.city
            )
            if (!realListExists) {
              // Check if already in mergedLists
              const alreadyInList = mergedLists.some(l => 
                l.id === newList.id || 
                (l.list_name === newList.list_name && l.city === newList.city)
              )
              if (!alreadyInList) {
                mergedLists.unshift(newList)
              }
            } else {
              // Real list found, clear sessionStorage
              sessionStorage.removeItem('newList')
            }
          } catch (error) {
            console.error('Error parsing new list:', error)
            sessionStorage.removeItem('newList')
          }
        }
        
        // Sort by created_at (newest first), but keep optimistic lists at top if real not found
        mergedLists.sort((a, b) => {
          // Optimistic lists first
          if (a.id?.startsWith('temp-') && !b.id?.startsWith('temp-')) return -1
          if (!a.id?.startsWith('temp-') && b.id?.startsWith('temp-')) return 1
          // Then by created_at
          const aDate = new Date(a.created_at || 0)
          const bDate = new Date(b.created_at || 0)
          return bDate - aDate
        })

        setLists(mergedLists)
      } catch (error) {
        console.error('Error fetching lists:', error)
        setLists([])
      } finally {
        setLoading(false)
      }
    }

    fetchListsWithCounts()

    // Subscribe to lists changes
    const listsChannel = supabase
      .channel('lists_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'lists',
        filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          // Handle INSERT events - replace optimistic list with real one
          if (payload.eventType === 'INSERT') {
            const newList = payload.new
            setLists(prev => {
              // Remove optimistic lists with matching name/city
              const filtered = prev.filter(l => 
                !(l.id?.startsWith('temp-') && 
                  l.list_name === newList.list_name && 
                  l.city === newList.city)
              )
              // Check if list already exists
              const exists = filtered.some(l => l.id === newList.id)
              if (exists) return filtered
              // Add new list at the beginning
              return [{ ...newList, entryCount: 0 }, ...filtered]
            })
            // Clear sessionStorage
            sessionStorage.removeItem('newList')
          } else {
            // For UPDATE/DELETE, refresh
            fetchListsWithCounts()
          }
        })
      .subscribe()

    // Subscribe to foodspots changes (real-time count updates)
    const foodspotsChannel = supabase
      .channel('foodspots_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'foodspots'
      }, async (payload) => {
        // Update the count for the affected list
        const listId = payload.new?.list_id || payload.old?.list_id
        if (!listId) return

        const { count, error } = await supabase
          .from('foodspots')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', listId)

        if (!error) {
          setLists(prevLists => 
            prevLists.map(list => 
              list.id === listId 
                ? { ...list, entryCount: count || 0 }
                : list
            )
          )
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(listsChannel)
      supabase.removeChannel(foodspotsChannel)
    }
  }, [user])

  const getUsername = () => user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  const getUserInitials = () => getUsername().charAt(0).toUpperCase()
  
  // Format entry count with correct singular/plural
  const formatEntryCount = (count) => {
    return count === 1 ? '1 Eintrag' : `${count} Einträge`
  }

  // Calculate dynamic card size and spacing based on list count and screen height
  const calculateCardLayout = (listCount) => {
    if (listCount === 0) return { 
      cardHeight: 192, 
      gap: 16,
      titleSize: 28,
      subtitleSize: 16,
      padding: 24,
      borderRadius: 28
    }

    // Available height for content area (accounting for header, padding, bottom nav, CTA button)
    const headerHeight = 70
    const paddingTop = 24
    const paddingBottom = 24
    const bottomNavHeight = 80
    const ctaButtonHeight = 100 // "Create another list" button
    const availableHeight = windowHeight - headerHeight - paddingTop - paddingBottom - bottomNavHeight - ctaButtonHeight

    // Size definitions based on list count
    let cardHeight, titleSize, subtitleSize, padding, borderRadius
    
    if (listCount === 1) {
      // 1 Liste: deutlich größer
      cardHeight = Math.min(320, availableHeight * 0.7) // 70% der verfügbaren Höhe, max 320px
      titleSize = 32 // Größerer Titel
      subtitleSize = 18 // Größere Unterzeile
      padding = 32 // Mehr Padding
      borderRadius = 32 // Größerer Radius
    } else if (listCount === 2) {
      // 2 Listen: etwas kleiner
      cardHeight = Math.min(240, (availableHeight - 16) / 2) // Hälfte minus Gap
      titleSize = 24
      subtitleSize = 16
      padding = 24
      borderRadius = 24
    } else {
      // 3+ Listen: weiter verkleinern, aber Mindestlesbarkeit einhalten
      const MIN_CARD_HEIGHT = 160 // Mindesthöhe für Lesbarkeit
      const MIN_TITLE_SIZE = 20 // Mindesttitelgröße
      const MIN_SUBTITLE_SIZE = 14 // Mindestunterzeile
      const MIN_PADDING = 16 // Mindestpadding
      const MIN_BORDER_RADIUS = 20 // Mindestradius
      
      // Berechne optimale Höhe basierend auf verfügbarem Platz
      const gap = 12
      const maxCardHeight = (availableHeight - (gap * (listCount - 1))) / listCount
      
      // Ab 4+ Listen: Größe bleibt gleich (Mindestgröße)
      if (listCount >= 4) {
        cardHeight = MIN_CARD_HEIGHT
        titleSize = MIN_TITLE_SIZE
        subtitleSize = MIN_SUBTITLE_SIZE
        padding = MIN_PADDING
        borderRadius = MIN_BORDER_RADIUS
      } else {
        // 3 Listen: zwischen 2 Listen und Minimum
        cardHeight = Math.max(MIN_CARD_HEIGHT, Math.min(200, maxCardHeight))
        // Proportional skaliert zwischen 2 Listen und Minimum
        const scale = (cardHeight - MIN_CARD_HEIGHT) / (200 - MIN_CARD_HEIGHT)
        titleSize = Math.round(MIN_TITLE_SIZE + (24 - MIN_TITLE_SIZE) * scale)
        subtitleSize = Math.round(MIN_SUBTITLE_SIZE + (16 - MIN_SUBTITLE_SIZE) * scale)
        padding = Math.round(MIN_PADDING + (24 - MIN_PADDING) * scale)
        borderRadius = Math.round(MIN_BORDER_RADIUS + (24 - MIN_BORDER_RADIUS) * scale)
      }
    }

    // Gap berechnen
    const MIN_GAP = 10
    const MAX_GAP = 24
    const totalCardHeight = cardHeight * listCount
    const remainingSpace = Math.max(0, availableHeight - totalCardHeight)
    const gap = listCount > 1 
      ? Math.max(MIN_GAP, Math.min(MAX_GAP, remainingSpace / (listCount - 1)))
      : 0

    return {
      cardHeight: Math.round(cardHeight),
      gap: Math.round(gap),
      titleSize,
      subtitleSize,
      padding,
      borderRadius
    }
  }

  // Long press handlers
  const handleLongPressStart = (listId) => {
    longPressTimer.current = setTimeout(() => {
      openEditModal(listId)
      // Haptic feedback (vibration)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 600)
  }

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const openEditModal = (listId) => {
    const list = lists.find(l => l.id === listId)
    if (list) {
      setEditingList(list)
      setShowEditModal(true)
    }
  }

  const handleListClick = (listId, event) => {
    // Only navigate if not clicking on edit button or menu
    if (event.target.closest('.edit-button') || event.target.closest('.menu-button')) {
      return
    }
    navigate(`/tierlist/${listId}`)
  }

  const handleDeleteList = async (listId) => {
    // Optimistic update: Remove immediately from UI
    const listToDelete = lists.find(l => l.id === listId)
    const previousLists = [...lists]
    
    setLists(prev => prev.filter(l => l.id !== listId))
    setShowDeleteConfirm(null)
    
    try {
      // Delete in background (non-blocking)
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)

      if (error) throw error

      showToast('Liste erfolgreich gelöscht!', 'success')
      // Real-time subscription will sync automatically
    } catch (error) {
      console.error('Error deleting list:', error)
      // Rollback on error
      setLists(previousLists)
      setShowDeleteConfirm(listId)
      showToast('Fehler beim Löschen. Bitte versuche es erneut.', 'error')
    }
  }

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const isEmpty = lists.length === 0
  const { cardHeight, gap, titleSize, subtitleSize, padding, borderRadius } = calculateCardLayout(lists.length)

  // Don't show loading screen if we have optimistic lists (seamless transition)
  if (loading && lists.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className="text-gray-600">Lädt deine Listen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background with gradient */}
      <div 
        className="fixed inset-0"
        style={{
          background: 'radial-gradient(60% 50% at 50% 0%, #FFF1E8 0%, #FFFFFF 60%)',
        }}
      />

      {/* Food Pattern Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04]">
        <svg className="w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          <path d="M80 120 L80 160 M75 120 L85 120" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400" />
          <path d="M180 100 L180 140 M175 100 L185 100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400" />
          <path d="M320 130 L320 170 M315 130 L325 130" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400" />
          <circle cx="100" cy="250" r="25" stroke="currentColor" strokeWidth="2" fill="none" className="text-gray-400" />
          <circle cx="300" cy="220" r="20" stroke="currentColor" strokeWidth="2" fill="none" className="text-gray-400" />
          <path d="M200 180 L210 200 L190 200 Z" fill="currentColor" className="text-gray-400" />
          <path d="M50 300 L60 320 L40 320 Z" fill="currentColor" className="text-gray-400" />
        </svg>
      </div>

      {/* Header */}
      <header className="bg-white/70 backdrop-blur-[12px] border-b border-gray-200/30 flex items-center justify-between sticky top-0 z-10"
        style={{
          paddingLeft: 'clamp(16px, 1.5vw, 24px)',
          paddingRight: 'clamp(16px, 1.5vw, 24px)',
          paddingTop: 'clamp(12px, 2vh, 16px)',
          paddingBottom: 'clamp(12px, 2vh, 16px)',
        }}
      >
        <div 
          className="flex items-center justify-center"
          style={{
            minWidth: 'clamp(40px, 3vw, 56px)',
            minHeight: 'clamp(40px, 3vw, 56px)',
            width: 'clamp(40px, 3vw, 56px)',
            height: 'clamp(40px, 3vw, 56px)',
          }}
        >
          <Avatar 
            size="responsive"
            onClick={() => navigate('/account')}
            className="w-full h-full"
          />
        </div>

        <h1 
          className="text-gray-900" 
          style={{ 
            fontFamily: "'Poppins', sans-serif", 
            fontWeight: 700,
            fontSize: 'clamp(16px, 4vw, 18px)',
            lineHeight: '1.2',
          }}
        >
          {isEmpty ? 'Foodspot Ranker' : `${getUsername()}s Foodspots`}
        </h1>

        <div className="w-9" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 relative">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-4">
            <WelcomeCard username={getUsername()} onCreateList={() => navigate('/select-category')} foodEmoji={userFoodEmoji} />
            <FeaturesSection />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
            {lists.map((list, index) => (
              <div
                key={list.id}
                onMouseDown={() => handleLongPressStart(list.id)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchStart={() => handleLongPressStart(list.id)}
                onTouchEnd={handleLongPressEnd}
                onClick={(e) => handleListClick(list.id, e)}
                className="relative overflow-hidden shadow-lg active:scale-[0.98] transition-all duration-200 cursor-pointer group"
                style={{
                  height: `${cardHeight}px`,
                  borderRadius: `${borderRadius}px`,
                  animation: `fadeSlideUp 0.4s ease-out ${index * 40}ms both`,
                }}
              >
                {/* Background Image */}
                {list.cover_image_url ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${list.cover_image_url})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                {/* Text Content */}
                <div 
                  className="absolute top-1/2 left-0 right-0 -translate-y-1/2"
                  style={{ padding: `${padding}px` }}
                >
                  <div className="flex-1 text-left">
                    <h3 
                      className="font-bold text-white mb-1 drop-shadow-lg break-words" 
                      style={{ 
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: `${titleSize}px`,
                        lineHeight: `${titleSize * 1.2}px`
                      }}
                    >
                      {list.list_name}
                    </h3>
                    <p 
                      className="text-white/90 flex items-center justify-start gap-1 mb-1 drop-shadow-md"
                      style={{ fontSize: `${subtitleSize}px` }}
                    >
                      <svg 
                        className="flex-shrink-0" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{ width: `${subtitleSize * 0.9}px`, height: `${subtitleSize * 0.9}px` }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="break-words">{list.city}</span>
                    </p>
                    {list.description && (
                      <p 
                        className="text-white/80 mb-1 drop-shadow-md break-words"
                        style={{ fontSize: `${Math.max(12, subtitleSize - 2)}px` }}
                      >
                        {list.description}
                      </p>
                    )}
                    <p 
                      className="text-white/80 drop-shadow-md transition-all duration-300"
                      style={{ fontSize: `${Math.max(12, subtitleSize - 2)}px` }}
                    >
                      🧾 {formatEntryCount(list.entryCount || 0)}
                    </p>
                  </div>
                </div>

                {/* Menu Button */}
                <div className="absolute top-3 right-3 z-20">
                  <button
                    className="menu-button w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenForList(menuOpenForList === list.id ? null : list.id)
                    }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpenForList === list.id && (
                    <div className="absolute top-12 right-0 bg-white rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenForList(null)
                          openEditModal(list.id)
                        }}
                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="text-gray-700 font-medium">Bearbeiten</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenForList(null)
                          setShowDeleteConfirm(list.id)
                        }}
                        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-red-50 transition-colors text-red-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="font-medium">Löschen</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* CTA: Create Another List */}
            <button
              onClick={() => navigate('/create-list')}
              className="w-full border-2 border-dashed border-gray-300 rounded-[24px] p-6 flex flex-col items-center justify-center gap-3 hover:border-[#FFB25A] hover:bg-[#FFE4C3]/30 transition-all active:scale-[0.98] group dark:hover:border-[#FF9357] dark:hover:bg-[#B85C2C]/20"
              style={{
                animation: `fadeSlideUp 0.4s ease-out ${lists.length * 40}ms both`,
              }}
            >
              <div className="text-3xl">📋</div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 group-hover:text-[#FF7E42] transition-colors dark:group-hover:text-[#FF9357]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  + Weitere Liste erstellen
                </p>
              </div>
            </button>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {showEditModal && editingList && (
        <EditListModal
          list={editingList}
          onClose={() => {
            setShowEditModal(false)
            setEditingList(null)
          }}
          onSave={(success, updatedList) => {
            setShowEditModal(false)
            setEditingList(null)
            if (success && updatedList) {
              // Optimistic update: Update list in state immediately
              setLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l))
              showToast('Liste erfolgreich aktualisiert!', 'success')
            } else if (!success && updatedList) {
              // Rollback on error
              setLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l))
              showToast('Fehler beim Speichern. Bitte versuche es erneut.', 'error')
            }
            // Lists will auto-refresh via realtime subscription
          }}
        />
      )}

      {/* Bottom Navigation */}
      {!isEmpty && (
        <nav className="fixed bottom-0 left-0 right-0 backdrop-blur-[12px] px-4 py-3 flex items-center justify-around bg-white/60 border-t border-gray-200/30">
          <button className="flex flex-col items-center gap-1 active:scale-95">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium text-gray-400" style={{ fontFamily: "'Poppins', sans-serif" }}>Settings</span>
          </button>

          <button className="flex flex-col items-center gap-1 active:scale-95">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs font-medium text-gray-400" style={{ fontFamily: "'Poppins', sans-serif" }}>Freunde</span>
          </button>

          <button className="flex flex-col items-center gap-1 active:scale-95">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium text-gray-400" style={{ fontFamily: "'Poppins', sans-serif" }}>Account</span>
          </button>
        </nav>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Liste löschen?
            </h2>
            <p className="text-gray-600 mb-6">
              Möchtest du diese Liste wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 rounded-[14px] border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDeleteList(showDeleteConfirm)}
                className="flex-1 py-3 rounded-[14px] bg-red-500 text-white font-semibold shadow-lg hover:bg-red-600 transition-all"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fadeSlideDown"
          style={{ animation: 'fadeSlideDown 0.3s ease-out' }}
        >
          <div className={`rounded-[16px] px-6 py-4 shadow-xl flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-semibold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

// Edit List Modal Component
function EditListModal({ list, onClose, onSave }) {
  const { user } = useAuth()
  
  const [formData, setFormData] = useState({
    list_name: list.list_name,
    city: list.city,
    description: list.description || '',
    coverImageUrl: list.cover_image_url,
    coverImageFile: null,
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageRemoved, setImageRemoved] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCoverImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, coverImage: 'Bitte wähle ein Bild aus' }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, coverImage: 'Bild muss kleiner als 5MB sein' }))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setFormData(prev => ({
      ...prev,
      coverImageUrl: previewUrl,
      coverImageFile: file,
    }))
    setImageRemoved(false)
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.list_name.trim() || formData.list_name.length < 3) {
      newErrors.list_name = 'Mindestens 3 Zeichen erforderlich'
    }
    if (!formData.city.trim()) {
      newErrors.city = 'Stadt ist erforderlich'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)

    // Optimistic update: Update UI immediately
    const previousList = { ...list }
    const updatedList = {
      ...list,
      list_name: formData.list_name.trim(),
      city: formData.city.trim(),
      description: formData.description.trim() || null,
      cover_image_url: formData.coverImageUrl || list.cover_image_url,
    }
    
    // Update UI immediately
    onSave(true, updatedList)

    try {
      let imageUrl = list.cover_image_url
      
      // If user uploaded a new image (upload in background, non-blocking)
      if (formData.coverImageFile) {
        const fileExt = formData.coverImageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        // Upload to storage (async, non-blocking)
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('list-covers')
          .upload(fileName, formData.coverImageFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('list-covers')
          .getPublicUrl(fileName)

        if (!urlData || !urlData.publicUrl) {
          throw new Error('Failed to get public URL for uploaded image')
        }

        imageUrl = urlData.publicUrl
      }
      // If user removed the image
      else if (imageRemoved) {
        imageUrl = null
      }
      // Otherwise keep the existing image

      // Update database (sync in background)
      const { error: updateError } = await supabase
        .from('lists')
        .update({
          list_name: formData.list_name.trim(),
          city: formData.city.trim(),
          description: formData.description.trim() || null,
          cover_image_url: imageUrl,
        })
        .eq('id', list.id)

      if (updateError) {
        console.error('Update error:', updateError)
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      // Final sync with server data
      const { data: finalList } = await supabase
        .from('lists')
        .select('*')
        .eq('id', list.id)
        .single()
      
      if (finalList) {
        onSave(true, finalList)
      }
    } catch (error) {
      console.error('Error updating list:', error)
      // Rollback on error
      onSave(false, previousList)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Liste bearbeiten
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* List Name */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Listenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.list_name}
              onChange={(e) => handleInputChange('list_name', e.target.value)}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.list_name ? 'border-red-400' : 'border-gray-200 focus:ring-[#FF7E42]/20 dark:focus:ring-[#FF9357]/20'
              }`}
            />
            {errors.list_name && <p className="mt-1 text-sm text-red-500">{errors.list_name}</p>}
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Stadt <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.city ? 'border-red-400' : 'border-gray-200 focus:ring-[#FF7E42]/20 dark:focus:ring-[#FF9357]/20'
              }`}
            />
            {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Beschreibung (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              maxLength={250}
              rows={3}
              className="w-full px-4 py-3 rounded-[14px] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF7E42]/20 dark:focus:ring-[#FF9357]/20 transition-all resize-none"
              placeholder="z.B. Meine Lieblingsspots für den nächsten Urlaub..."
            />
            <p className="mt-1 text-xs text-gray-500 text-right">{formData.description.length}/250</p>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Titelbild
            </label>
            {formData.coverImageUrl ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={formData.coverImageUrl} alt="Preview" className="w-full h-64 object-cover" />
                <button
                  onClick={() => {
                    handleInputChange('coverImageUrl', null)
                    handleInputChange('coverImageFile', null)
                    setImageRemoved(true)
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" onChange={handleCoverImageChange} className="hidden" />
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#FF7E42] hover:bg-[#FFE4C3]/30 transition-all dark:hover:border-[#FF9357] dark:hover:bg-[#B85C2C]/20">
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-gray-600 font-medium">Bild auswählen</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-[14px] border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-[14px] bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 transition-all dark:from-[#FF9357] dark:to-[#B85C2C]"
          >
            {isSubmitting ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
