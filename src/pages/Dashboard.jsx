import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import WelcomeCard from '../components/WelcomeCard'
import FeaturesSection from '../components/FeaturesSection'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'
import { springEasing, staggerDelay } from '../utils/animations'

const PRIVATE_FILTER_STORAGE_KEY = 'dashboard_private_filters'
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
  'Bier'
]

// Hook to check for unread social notifications (including list invitations)
const useSocialNotifications = () => {
  const { user } = useAuth()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!user) return

    const checkUnread = async () => {
      try {
        const lastViewed = localStorage.getItem('social_tab_last_viewed')
        const lastViewedTime = lastViewed ? new Date(lastViewed).getTime() : 0

        const [incomingRequests, acceptedRequests, listInvitations] = await Promise.all([
          supabase.from('friendships').select('id').eq('addressee_id', user.id).eq('status', 'pending').limit(1),
          supabase.from('friendships').select('id, created_at').eq('requester_id', user.id).eq('status', 'accepted').gt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(1),
          supabase.from('list_invitations').select('id, created_at').eq('invitee_id', user.id).eq('status', 'pending').limit(1)
        ])

        const hasIncoming = (incomingRequests.data?.length || 0) > 0
        const hasAccepted = (acceptedRequests.data?.length || 0) > 0 && 
          acceptedRequests.data.some(r => new Date(r.created_at).getTime() > lastViewedTime)
        const hasListInvitations = (listInvitations.data?.length || 0) > 0

        setHasUnread(hasIncoming || hasAccepted || hasListInvitations)
      } catch (error) {
        // Tabellen existieren möglicherweise noch nicht - das ist okay
        if (error.code !== 'PGRST200' && !error.message?.includes('does not exist')) {
        console.error('Error checking notifications:', error)
        }
      }
    }

    checkUnread()
    const interval = setInterval(checkUnread, 30000) // Check every 30 seconds

    const channel = supabase
      .channel('dashboard_social_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${user.id}`
      }, () => checkUnread())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${user.id}`
      }, () => checkUnread())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_invitations',
        filter: `invitee_id=eq.${user.id}`
      }, () => checkUnread())
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user])

  return hasUnread
}

function Dashboard() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const hasSocialNotifications = useSocialNotifications()
  
  // Tab-View: 'meine' (private Listen) oder 'geteilt' (geteilte Listen)
  // Prüfe URL-Parameter für initialen View
  const initialView = searchParams.get('view') === 'geteilt' ? 'geteilt' : 'meine'
  const [listView, setListView] = useState(initialView)
  
  // Update URL when view changes
  useEffect(() => {
    if (listView === 'geteilt') {
      setSearchParams({ view: 'geteilt' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [listView, setSearchParams])

  const [sharedLists, setSharedLists] = useState([])
  const [sharedListsLoading, setSharedListsLoading] = useState(false)
  
  // State für Gesamtzählung aller sichtbaren Listen (für Routing-Logik)
  const [totalListsCount, setTotalListsCount] = useState(0)
  const [isCountingLists, setIsCountingLists] = useState(true)
  const [privateFilters, setPrivateFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(PRIVATE_FILTER_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          return {
            city: parsed?.city || '',
            category: parsed?.category || ''
          }
        }
      } catch (error) {
        console.warn('[Dashboard] Failed to load private filters from sessionStorage', error)
      }
    }
    return { city: '', category: '' }
  })
  
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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(null)
  const [showEditSharedListModal, setShowEditSharedListModal] = useState(null) // stores list object
  
  // Long press refs
  const longPressRefs = useRef({})
  const longPressTimer = useRef(null)
  
  // Track pending deletions to prevent race conditions with real-time sync
  const pendingDeletionsRef = useRef(new Set())
  
  // Cache-Strategie: Track ob Listen bereits geladen wurden (verhindert Doppelladen)
  // WICHTIG: Refs bleiben beim Re-Render erhalten, werden aber bei Unmount zurückgesetzt
  // Daher: Prüfe auch auf vorhandene Daten in State, nicht nur auf Ref
  const hasLoadedPrivateListsRef = useRef(false)
  const hasLoadedSharedListsRef = useRef(false)
  const isInitialMountRef = useRef(true)
  const privateFiltersRef = useRef(privateFilters)
  const lastPrivateFilterKeyRef = useRef(`${(privateFilters.city || '').toLowerCase()}|${privateFilters.category || ''}`)
  const privateFilterDebounceRef = useRef(null)
  const handleResetFilters = () => {
    setPrivateFilters({ city: '', category: '' })
  }
  
  // Track ob gerade ein Fetch läuft (verhindert parallele Fetches)
  const isFetchingPrivateRef = useRef(false)
  const isFetchingSharedRef = useRef(false)

  // Track window height for responsive calculations
  useEffect(() => {
    const updateHeight = () => setWindowHeight(window.innerHeight)
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Note: Optimistic list is now initialized in useState initializer above
  // This ensures it's available immediately on first render

  // Fetch private lists - URSPRÜNGLICHE LOGIK (unverändert)
  // Diese Funktion zeigt ALLE Listen des Users an, genau wie vorher
  // OPTIMIERT: forceRefresh Parameter - wenn false, wird nicht neu geladen wenn bereits vorhanden
  // OPTIMIERT: backgroundRefresh Parameter - wenn true, kein Loading-State (Hintergrund-Update)
  const fetchPrivateLists = async (forceRefresh = false, backgroundRefresh = false, appliedFilters = privateFiltersRef.current) => {
      if (!user) return
      
    // Verhindere parallele Fetches
    if (isFetchingPrivateRef.current) {
      console.log('[Dashboard] fetchPrivateLists: Already fetching, skipping')
      return
    }
    
    const normalizedFilters = {
      city: appliedFilters?.city?.trim() || '',
      category: appliedFilters?.category || ''
    }
    const filterKey = `${normalizedFilters.city.toLowerCase()}|${normalizedFilters.category}`

    // Wenn bereits geladen und nicht forciert, überspringe (verhindert Doppelladen)
    // WICHTIG: Prüfe sowohl Ref als auch State (für Navigation zurück)
    // OPTIMIERT: Prüfe zuerst State (schneller), dann Ref
    if (!forceRefresh) {
      if (lists.length > 0 && lastPrivateFilterKeyRef.current === filterKey) {
        console.log('[Dashboard] fetchPrivateLists: Skipping - data in state (lists:', lists.length, ') for same filters')
        hasLoadedPrivateListsRef.current = true // Update Ref für zukünftige Prüfungen
        return
      }
      if (hasLoadedPrivateListsRef.current && lastPrivateFilterKeyRef.current === filterKey) {
        console.log('[Dashboard] fetchPrivateLists: Skipping - already loaded (ref) for current filters')
        return
      }
    }
    
    isFetchingPrivateRef.current = true
    if (!backgroundRefresh) {
      setLoading(true)
    }
      try {
      // URSPRÜNGLICHE QUERY: Einfach alle Listen des Users abrufen (jetzt mit Filtern)
        let listsQuery = supabase
          .from('lists')
          .select('*')
          .eq('user_id', user.id)

        if (normalizedFilters.city) {
          listsQuery = listsQuery.ilike('city', `%${normalizedFilters.city}%`)
        }
        if (normalizedFilters.category) {
          listsQuery = listsQuery.eq('category', normalizedFilters.category)
        }

        const { data: listsData, error: listsError } = await listsQuery
          .order('created_at', { ascending: false })

        if (listsError) {
          console.error('Error fetching lists:', listsError)
          setLists([])
          setLoading(false)
          return
        }

        if (!listsData || listsData.length === 0) {
          setLists([])
          setLoading(false)
          return
        }
        
      // OPTIONAL: Filterung für geteilte Listen (nur wenn Tabellen existieren und funktionieren)
      // Wenn Filterung fehlschlägt, werden ALLE Listen angezeigt (ursprüngliche Logik)
      let listsToShow = listsData
      
      // Versuche Filterung nur wenn Tabellen existieren (optional, nicht kritisch)
      // WICHTIG: Nur versuchen, wenn Listen vorhanden sind (verhindert Fehler bei leeren Arrays)
      if (listsData.length > 0) {
        try {
          const listIds = listsData.map(l => l.id).filter(Boolean)
          
          if (listIds.length > 0) {
            const { data: listMembersData, error: membersError } = await supabase
              .from('list_members')
              .select('list_id, user_id')
              .in('list_id', listIds)
              .neq('user_id', user.id)
              .limit(1000)

            const { data: listInvitationsData, error: invitationsError } = await supabase
              .from('list_invitations')
              .select('list_id')
              .in('list_id', listIds)
              .eq('status', 'pending')
              .limit(1000)

            // Nur filtern, wenn BEIDE Queries erfolgreich waren UND keine kritischen Fehler
            // Ignoriere Fehler wie "relation does not exist" (Tabellen existieren nicht)
            const membersTableExists = !membersError || (membersError.code !== '42P01' && membersError.code !== 'PGRST116')
            const invitationsTableExists = !invitationsError || (invitationsError.code !== '42P01' && invitationsError.code !== 'PGRST116')
            
            if (membersTableExists && invitationsTableExists && !membersError && !invitationsError) {
              const sharedListIds = new Set([
                ...(listMembersData || []).map(m => m.list_id),
                ...(listInvitationsData || []).map(i => i.list_id)
              ])
              
              // Filtere nur wenn es tatsächlich geteilte Listen gibt
              if (sharedListIds.size > 0) {
                listsToShow = listsData.filter(list => !sharedListIds.has(list.id))
                
                // SICHERHEIT: Wenn nach Filterung keine Listen übrig sind, zeige alle (Fallback)
                if (listsToShow.length === 0 && listsData.length > 0) {
                  console.warn('Filtering removed all lists - using fallback (showing all lists)')
                  listsToShow = listsData
                }
              }
            }
          }
        } catch (error) {
          // Tabellen existieren nicht oder Fehler - verwende ursprüngliche Logik (alle Listen)
          // Das ist OK, keine Aktion nötig - listsToShow bleibt auf listsData
        }
      }

      // Fetch foodspot counts (ursprüngliche Logik)
        const listsWithCounts = await Promise.all(
        listsToShow.map(async (list) => {
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

      // Merge with optimistic lists (ursprüngliche Logik)
        const newListData = sessionStorage.getItem('newList')
        const optimisticLists = lists.filter(l => l.id?.startsWith('temp-'))
        const filteredLists = listsWithCounts.filter(list => 
          !pendingDeletionsRef.current.has(list.id)
        )
        const mergedLists = [...filteredLists]
        
        optimisticLists.forEach(optimisticList => {
          const realListExists = filteredLists.some(l => 
            l.list_name === optimisticList.list_name && l.city === optimisticList.city
          )
          if (!realListExists) {
            mergedLists.unshift(optimisticList)
          }
        })
        
        if (newListData) {
          try {
            const newList = JSON.parse(newListData)
            const realListExists = listsWithCounts.some(l => 
              l.list_name === newList.list_name && l.city === newList.city
            )
            if (!realListExists) {
              const alreadyInList = mergedLists.some(l => 
                l.id === newList.id || 
                (l.list_name === newList.list_name && l.city === newList.city)
              )
              if (!alreadyInList) {
                mergedLists.unshift(newList)
              }
            } else {
              sessionStorage.removeItem('newList')
            }
          } catch (error) {
            console.error('Error parsing new list:', error)
            sessionStorage.removeItem('newList')
          }
        }
        
        mergedLists.sort((a, b) => {
          if (a.id?.startsWith('temp-') && !b.id?.startsWith('temp-')) return -1
          if (!a.id?.startsWith('temp-') && b.id?.startsWith('temp-')) return 1
          const aDate = new Date(a.created_at || 0)
          const bDate = new Date(b.created_at || 0)
          return bDate - aDate
        })

      setLists(mergedLists)
      hasLoadedPrivateListsRef.current = true
      lastPrivateFilterKeyRef.current = filterKey
      
      // Update count nach privatem Fetch (kein weiterer Supabase-Call)
      await countAllVisibleLists(mergedLists, sharedLists)
      } catch (error) {
      console.error('Error fetching private lists:', error)
        setLists([])
      } finally {
      isFetchingPrivateRef.current = false
      if (!backgroundRefresh) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    privateFiltersRef.current = privateFilters
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(PRIVATE_FILTER_STORAGE_KEY, JSON.stringify(privateFilters))
      } catch (error) {
        console.warn('[Dashboard] Failed to persist private filters', error)
      }
    }

    if (!user || isInitialMountRef.current) return

    if (privateFilterDebounceRef.current) {
      clearTimeout(privateFilterDebounceRef.current)
    }

    privateFilterDebounceRef.current = setTimeout(() => {
      hasLoadedPrivateListsRef.current = false
      fetchPrivateLists(true, false, privateFiltersRef.current)
    }, 350)

    return () => {
      if (privateFilterDebounceRef.current) {
        clearTimeout(privateFilterDebounceRef.current)
      }
    }
  }, [privateFilters, user])

  // Count all visible lists for routing logic (keine zusätzlichen Supabase-Calls)
  // Optional: privateListsOverride / sharedListsOverride verwenden, um direkt mit frisch geladenen Daten zu zählen
  const countAllVisibleLists = async (privateListsOverride, sharedListsOverride) => {
    const privateData = privateListsOverride ?? lists ?? []
    const sharedData = sharedListsOverride ?? sharedLists ?? []
    
    // Eigentümer-geteilte Listen
    const ownedSharedIds = new Set(
      sharedData
        .filter(list => list?.isOwner)
        .map(list => list.id)
        .filter(Boolean)
    )
    
    const ownedSharedCount = ownedSharedIds.size
    
    // Private Listen: alle Listen des Users, die nicht als geteilte Besitzerlisten markiert sind
    const ownedPrivateCount = privateData.filter(list => !ownedSharedIds.has(list.id)).length
    
    // Mitglied-geteilte Listen: Listen, bei denen der User nicht Owner ist
    const memberSharedCount = sharedData.filter(list => !list?.isOwner).length
    
    const totalCount = ownedPrivateCount + ownedSharedCount + memberSharedCount
    
    setTotalListsCount(totalCount)
    setIsCountingLists(false)
    
    return { ownedPrivateCount, ownedSharedCount, memberSharedCount, totalCount }
  }

  // Fetch shared lists (lists where user is member or owner of shared list)
  // WICHTIG: Nur Listen nach Annahme anzeigen (keine pending invitations)
  // OPTIMIERT: forceRefresh Parameter - wenn false, wird nicht neu geladen wenn bereits vorhanden
  // OPTIMIERT: backgroundRefresh Parameter - wenn true, kein Loading-State (Hintergrund-Update)
  const fetchSharedLists = async (forceRefresh = false, backgroundRefresh = false) => {
    if (!user) return
    
    // Verhindere parallele Fetches
    if (isFetchingSharedRef.current) {
      console.log('[Dashboard] fetchSharedLists: Already fetching, skipping')
      return
    }
    
    // Wenn bereits geladen und nicht forciert, überspringe (verhindert Doppelladen)
    // WICHTIG: Prüfe sowohl Ref als auch State (für Navigation zurück)
    // OPTIMIERT: Prüfe zuerst State (schneller), dann Ref
    if (!forceRefresh) {
      if (sharedLists.length > 0) {
        console.log('[Dashboard] fetchSharedLists: Skipping - data in state (sharedLists:', sharedLists.length, ')')
        hasLoadedSharedListsRef.current = true // Update Ref für zukünftige Prüfungen
        return
      }
      if (hasLoadedSharedListsRef.current) {
        console.log('[Dashboard] fetchSharedLists: Skipping - already loaded (ref)')
        return
      }
    }
    
    console.log('[Dashboard] fetchSharedLists: Starting fetch for user:', user.id, 'backgroundRefresh:', backgroundRefresh)
    isFetchingSharedRef.current = true
    if (!backgroundRefresh) {
      setSharedListsLoading(true)
    }
    try {
      // Fetch lists where user is a member (but not owner)
      // Diese sind bereits angenommen (nur in list_members wenn angenommen)
      const { data: memberListsData, error: memberListsError } = await supabase
        .from('list_members')
        .select(`
          list_id,
          role,
          joined_at,
          lists:list_id (
            id,
            user_id,
            list_name,
            city,
            description,
            category,
            cover_image_url,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)

      if (memberListsError) {
        console.error('Error fetching member lists:', memberListsError)
      }

      // Fetch lists owned by user that are shared
      // WICHTIG: Owner sieht ALLE seine geteilten Listen, auch wenn noch keine Member angenommen haben
      // (Eine Liste ist "shared", wenn sie Mitglieder ODER pending invitations hat)
      const { data: ownedListsData } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      let sharedOwnedLists = []
      if (ownedListsData && ownedListsData.length > 0) {
        // Check which owned lists have members OR pending invitations (these are shared lists)
        const [listMembersData, listInvitationsData] = await Promise.all([
          supabase
            .from('list_members')
            .select('list_id')
            .in('list_id', ownedListsData.map(l => l.id))
            .neq('user_id', user.id), // Exclude owner
          supabase
            .from('list_invitations')
            .select('list_id')
            .in('list_id', ownedListsData.map(l => l.id))
            .eq('status', 'pending')
        ])

        // Liste ist "shared", wenn sie Mitglieder ODER pending invitations hat
        const sharedListIds = new Set([
          ...(listMembersData.data || []).map(m => m.list_id),
          ...(listInvitationsData.data || []).map(i => i.list_id)
        ])

        sharedOwnedLists = ownedListsData.filter(list => sharedListIds.has(list.id))
        console.log('[Dashboard] fetchSharedLists: Found', sharedOwnedLists.length, 'shared owned lists (including pending)')
      }

      // Combine member lists and shared owned lists
      const allSharedLists = [
        ...(memberListsData || []).map(m => ({
          ...m.lists,
          role: m.role, // Set role for permission checks
          membershipRole: m.role,
          isOwner: false
        })),
        ...sharedOwnedLists.map(l => ({
          ...l,
          role: 'owner', // Owner has full permissions
          membershipRole: 'owner',
          isOwner: true
        }))
      ]

      // Remove duplicates (in case user is both owner and member)
      const uniqueSharedLists = allSharedLists.reduce((acc, list) => {
        if (!acc.find(l => l.id === list.id)) {
          acc.push(list)
        }
        return acc
      }, [])

      // Fetch foodspot counts AND member data (for avatars)
      const sharedListsWithCounts = await Promise.all(
        uniqueSharedLists.map(async (list) => {
          // Foodspot count
          const { count, error: countError } = await supabase
            .from('foodspots')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)

          if (countError) {
            console.error('Error fetching count for shared list:', list.id, countError)
          }

          // ALLE Members laden (inkl. Owner falls in list_members)
          const { data: membersData } = await supabase
            .from('list_members')
            .select('user_id, role, joined_at')
            .eq('list_id', list.id)

          // Alle eindeutigen User-IDs sammeln (Owner + Members)
          const allUserIds = new Set([list.user_id]) // Owner immer dabei
          if (membersData) {
            membersData.forEach(m => allUserIds.add(m.user_id))
          }

          // Profile für alle User laden
          const { data: allProfiles } = await supabase
            .from('user_profiles')
            .select('id, username, profile_image_url')
            .in('id', Array.from(allUserIds))

          // Build members array: Owner first, dann Rest
          const members = []
          const processedIds = new Set()
          
          // 1. Owner IMMER zuerst
          const ownerProfile = allProfiles?.find(p => p.id === list.user_id)
          if (ownerProfile) {
            members.push({
              user_id: ownerProfile.id,
              role: 'owner',
              username: ownerProfile.username,
              profile_image_url: ownerProfile.profile_image_url
            })
            processedIds.add(ownerProfile.id)
          }

          // 2. Alle anderen Members (keine Duplikate)
          if (membersData) {
            membersData.forEach(m => {
              if (!processedIds.has(m.user_id)) {
                const profile = allProfiles?.find(p => p.id === m.user_id)
                members.push({
                  user_id: m.user_id,
                  role: m.role,
                  username: profile?.username,
                  profile_image_url: profile?.profile_image_url
                })
                processedIds.add(m.user_id)
              }
            })
          }

          console.log(`[Dashboard] List "${list.list_name}": ${members.length} total members`)

          return { 
            ...list, 
            entryCount: count || 0,
            members: members,
            totalMembers: members.length
          }
        })
      )

      // Check for pending status (only owner sees pending if no one accepted yet)
      // WICHTIG: Member sehen nie pending status, da sie nur Listen sehen, die sie bereits angenommen haben
      const sharedListsWithStatus = await Promise.all(
        sharedListsWithCounts.map(async (list) => {
          if (list.isOwner) {
            // Check if list has any accepted members (excluding owner)
            const { data: acceptedMembers } = await supabase
              .from('list_members')
              .select('id')
              .eq('list_id', list.id)
              .neq('user_id', user.id)
              .limit(1)

            const hasAcceptedMembers = (acceptedMembers || []).length > 0

            // Check if there are pending invitations
            const { data: pendingInvitations } = await supabase
              .from('list_invitations')
              .select('id')
              .eq('list_id', list.id)
              .eq('status', 'pending')
              .limit(1)

            const hasPendingInvitations = (pendingInvitations || []).length > 0

            return {
              ...list,
              isPending: !hasAcceptedMembers && hasPendingInvitations
            }
          }
          // Member sehen nie pending status (sie haben bereits angenommen)
          return { ...list, isPending: false }
        })
      )
      
      console.log('[Dashboard] fetchSharedLists: Processed', sharedListsWithStatus.length, 'shared lists')

      const sortedSharedLists = sharedListsWithStatus.sort((a, b) => {
        const aDate = new Date(a.created_at || 0)
        const bDate = new Date(b.created_at || 0)
        return bDate - aDate
      })
      
      setSharedLists(sortedSharedLists)
      hasLoadedSharedListsRef.current = true
      
      // Update count nach Shared-Fetch (kein zusätzlicher Supabase-Call)
      await countAllVisibleLists(lists, sortedSharedLists)
    } catch (error) {
      console.error('Error fetching shared lists:', error)
      setSharedLists([])
    } finally {
      isFetchingSharedRef.current = false
      if (!backgroundRefresh) {
        setSharedListsLoading(false)
      }
    }
  }

  // Count all visible lists when Daten sich ändern (ohne zusätzliche Requests)
  useEffect(() => {
    if (!user) {
      setTotalListsCount(0)
      setIsCountingLists(false)
      return
    }
    
    // Falls noch keine Daten geladen wurden, warte auf ersten Fetch
    if (
      !hasLoadedPrivateListsRef.current &&
      !hasLoadedSharedListsRef.current &&
      lists.length === 0 &&
      sharedLists.length === 0
    ) {
      return
    }
    
    countAllVisibleLists()
  }, [user, lists, sharedLists])

  // OPTIMIERT: Lade beide Listen parallel beim Mount (nicht nur die aktuelle)
  // Tab-Wechsel wechselt nur die View, keine neuen Fetches
  useEffect(() => {
    if (!user) return
    
    // Initial Mount: Lade beide Listen parallel
    if (isInitialMountRef.current) {
      console.log('[Dashboard] Initial mount: Loading both lists in parallel')
      isInitialMountRef.current = false
      
      // Lade beide Listen parallel, unabhängig vom aktuellen Tab
      // forceRefresh = true beim Mount, backgroundRefresh = false (sichtbares Loading erlaubt)
      Promise.all([
        fetchPrivateLists(true, false), // forceRefresh = true beim Mount
        fetchSharedLists(true, false)   // forceRefresh = true beim Mount
      ])
      
      // Setze initialen View basierend auf URL-Parameter
      // (wird bereits durch useState initialView gesetzt)
      return
    }
    
    // OPTIMIERT: Beim Zurücknavigieren (nicht initial Mount):
    // - Wenn Daten bereits vorhanden sind → KEIN Fetch (Cache nutzen, kein Doppelladen)
    // - Content erscheint sofort aus Cache (wie beim Tab-Wechsel)
    // - Optional: Background-Refresh im Hintergrund (ohne Loading-State, verzögert)
    // WICHTIG: Prüfe zuerst State (schneller), dann Ref
    const hasPrivateData = lists.length > 0
    const hasSharedData = sharedLists.length > 0
    
    if (hasPrivateData && hasSharedData) {
      // Daten vorhanden → KEIN Fetch, Content sofort aus Cache (wie Tab-Wechsel)
      // Update Refs für zukünftige Prüfungen
      hasLoadedPrivateListsRef.current = true
      hasLoadedSharedListsRef.current = true
      
      console.log('[Dashboard] Returning from navigation: Data available in state, using cache (no fetch). Optional background refresh in 1000ms')
      // Optional: Leicht verzögertes Background-Refresh (nicht sofort, um Netzwerk zu schonen)
      // Längerer Delay, da Daten bereits vorhanden sind
      setTimeout(() => {
        // Background-Refresh nur wenn nicht bereits am Fetchen
        if (!isFetchingPrivateRef.current) {
          fetchPrivateLists(false, true) // backgroundRefresh = true
        }
        if (!isFetchingSharedRef.current) {
          fetchSharedLists(false, true)   // backgroundRefresh = true
        }
      }, 1000) // Längerer Delay, da Daten bereits vorhanden sind
    } else {
      // Daten fehlen → lade im Hintergrund (ohne sichtbares Loading)
      // Max. 1 Fetch pro Datenquelle
      console.log('[Dashboard] Returning from navigation: Missing data, refreshing in background')
      if (!hasPrivateData && !isFetchingPrivateRef.current) {
        fetchPrivateLists(false, true) // backgroundRefresh = true
      }
      if (!hasSharedData && !isFetchingSharedRef.current) {
        fetchSharedLists(false, true) // backgroundRefresh = true
      }
    }
    
    // Subscribe to lists changes (wird nur einmal beim Mount erstellt)
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
          } else if (payload.eventType === 'DELETE') {
            // Handle DELETE events - remove from UI immediately
            const deletedListId = payload.old?.id
            if (deletedListId) {
              // Mark as pending deletion to prevent re-fetching
              pendingDeletionsRef.current.add(deletedListId)
              
              // Remove from UI immediately
              setLists(prev => prev.filter(l => l.id !== deletedListId))
              
              // Clear from pending after a delay
              setTimeout(() => {
                pendingDeletionsRef.current.delete(deletedListId)
              }, 5000)
            }
          } else if (payload.eventType === 'UPDATE') {
            // For UPDATE, refresh only if not pending deletion
            // OPTIMIERT: Im Hintergrund aktualisieren, nicht nur aktueller Tab
            const updatedListId = payload.new?.id
            if (updatedListId && !pendingDeletionsRef.current.has(updatedListId)) {
              // Aktualisiere beide Listen im Hintergrund (forceRefresh = false, backgroundRefresh = true)
              fetchPrivateLists(false, true) // backgroundRefresh = true
              fetchSharedLists(false, true)   // backgroundRefresh = true
            }
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

    // Subscribe to list_members and list_invitations changes (for shared lists)
    const sharedListsChannel = supabase
      .channel('shared_lists_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_members',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        // Refresh shared lists when user becomes a member or leaves
        // OPTIMIERT: Im Hintergrund aktualisieren, nicht nur wenn Tab aktiv
        console.log('[Dashboard] Realtime: list_members changed for user')
        fetchSharedLists(false, true) // backgroundRefresh = true
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_invitations',
        filter: `invitee_id=eq.${user?.id}`
      }, () => {
        // Refresh shared lists when invitations change (but invitations don't appear in shared lists)
        console.log('[Dashboard] Realtime: list_invitations changed for user')
        // Don't refresh shared lists here - invitations are handled in Social-Tab
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'list_members'
      }, () => {
        // Refresh shared lists when any member changes (for owner view)
        // OPTIMIERT: Im Hintergrund aktualisieren, nicht nur wenn Tab aktiv
        console.log('[Dashboard] Realtime: list_members changed (any user)')
        fetchSharedLists(false, true) // backgroundRefresh = true
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'lists'
      }, (payload) => {
        // Remove deleted list from shared lists immediately
        console.log('[Dashboard] Realtime: List deleted:', payload.old?.id)
        if (payload.old?.id) {
          setSharedLists(prev => prev.filter(l => l.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(listsChannel)
      supabase.removeChannel(foodspotsChannel)
      supabase.removeChannel(sharedListsChannel)
    }
    // OPTIMIERT: Nur user als Dependency - Realtime-Subscriptions bleiben bestehen bei Tab-Wechsel
    // Tab-Wechsel triggert KEINEN neuen Fetch, da Daten bereits geladen sind
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

  // Long press handlers with improved haptics
  const handleLongPressStart = (listId) => {
    longPressTimer.current = setTimeout(() => {
      openEditModal(listId)
      hapticFeedback.medium()
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
    if (listView === 'geteilt') {
      navigate(`/shared/tierlist/${listId}`)
    } else {
      navigate(`/tierlist/${listId}`)
    }
  }

  const handleDeleteList = async (listId) => {
    // Store previous state for rollback
    const listToDelete = lists.find(l => l.id === listId) || sharedLists.find(l => l.id === listId)
    const previousLists = [...lists]
    const previousSharedLists = [...sharedLists]
    
    // Close confirmation dialog
    setShowDeleteConfirm(null)
    
    // Show loading state
    hapticFeedback.medium()
    showToast('Liste wird gelöscht...', 'info')
    
    console.log('[Dashboard] handleDeleteList: Starting deletion for list:', listId, 'user:', user?.id)
    
    try {
      // Check if this is a shared list (has members or invitations)
      const { data: listMembers } = await supabase
        .from('list_members')
        .select('id')
        .eq('list_id', listId)
        .limit(1)
      
      const { data: listInvitations } = await supabase
        .from('list_invitations')
        .select('id')
        .eq('list_id', listId)
        .limit(1)
      
      const isSharedList = (listMembers?.length || 0) > 0 || (listInvitations?.length || 0) > 0
      
      console.log('[Dashboard] handleDeleteList: Is shared list:', isSharedList)
      
      if (isSharedList) {
        // For shared lists: Delete all related data first
        console.log('[Dashboard] handleDeleteList: Deleting related data (members, invitations)')
        
        // Delete all members
        const { error: membersError } = await supabase
          .from('list_members')
          .delete()
          .eq('list_id', listId)
        
        if (membersError) {
          console.error('[Dashboard] handleDeleteList: Error deleting members:', membersError)
          throw new Error('Fehler beim Löschen der Mitglieder')
        }
        
        // Delete all invitations
        const { error: invitationsError } = await supabase
          .from('list_invitations')
          .delete()
          .eq('list_id', listId)
        
        if (invitationsError) {
          console.error('[Dashboard] handleDeleteList: Error deleting invitations:', invitationsError)
          throw new Error('Fehler beim Löschen der Einladungen')
        }
        
        console.log('[Dashboard] handleDeleteList: Related data deleted successfully')
      }
      
      // First: Delete from database (wait for confirmation)
      // Use a timeout for mobile networks (30 seconds)
      const deletePromise = supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user?.id) // Extra security: ensure user owns the list
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Löschen dauerte zu lange. Bitte prüfe deine Internetverbindung.')), 30000)
      )
      
      // Race between delete and timeout
      const deleteResult = await Promise.race([
        deletePromise.then(result => ({ success: true, result })),
        timeoutPromise.then(() => ({ success: false, error: new Error('Timeout') }))
      ])
      
      if (!deleteResult.success) {
        throw deleteResult.error
      }
      
      const { data, error } = deleteResult.result
      
      if (error) {
        console.error('Delete error:', error)
        // Check if it's a permission error
        if (error.code === 'PGRST301' || error.message?.includes('permission denied')) {
          throw new Error('Keine Berechtigung zum Löschen dieser Liste')
        }
        throw error
      }
      
      // Verify deletion was successful by checking if list still exists
      const { data: verifyData, error: verifyError } = await supabase
        .from('lists')
        .select('id')
        .eq('id', listId)
        .eq('user_id', user?.id)
        .single()
      
      // If list still exists, deletion failed
      if (verifyData && !verifyError) {
        throw new Error('Liste konnte nicht gelöscht werden. Bitte versuche es erneut.')
      }
      
      // Mark as pending deletion to prevent real-time sync from re-adding it
      pendingDeletionsRef.current.add(listId)
      
      // Only remove from UI after successful deletion
      setLists(prev => prev.filter(l => l.id !== listId))
      setSharedLists(prev => prev.filter(l => l.id !== listId))
      
      console.log('[Dashboard] handleDeleteList: List deleted successfully')
      hapticFeedback.success()
      showToast('Liste erfolgreich gelöscht!', 'success')
      
      // Clear sessionStorage if this was the optimistic list
      const newListData = sessionStorage.getItem('newList')
      if (newListData) {
        try {
          const newList = JSON.parse(newListData)
          if (newList.id === listId) {
            sessionStorage.removeItem('newList')
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Clear from pending deletions after 10 seconds (enough time for real-time sync)
      setTimeout(() => {
        pendingDeletionsRef.current.delete(listId)
      }, 10000)
      
    } catch (error) {
      console.error('[Dashboard] handleDeleteList: Error:', error)
      // Rollback on error - restore list in UI
      setLists(previousLists)
      setSharedLists(previousSharedLists)
      setShowDeleteConfirm(listId)
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Fehler beim Löschen. Bitte versuche es erneut.'
      showToast(errorMessage, 'error')
      hapticFeedback.error()
    }
  }

  // Handle leaving a shared list (for non-owners)
  const handleLeaveList = async (listId) => {
    if (!user) return
    
    console.log('[Dashboard] handleLeaveList: Starting for list:', listId, 'user:', user.id)
    
    // Store previous state for rollback
    const previousSharedLists = [...sharedLists]
    
    hapticFeedback.medium()
    showToast('Liste wird verlassen...', 'info')
    
    try {
      const { data, error } = await supabase.rpc('leave_shared_list', { p_list_id: listId })

      if (error) {
        console.error('[Dashboard] handleLeaveList: RPC error:', error)
        throw error
      }

      console.log('[Dashboard] handleLeaveList: RPC result', data)

      // Optimistisch aus UI entfernen
      setSharedLists(prev => prev.filter(l => l.id !== listId))

      // Hintergrund-Refresh anstoßen, damit Aggregationen aktualisiert werden
      fetchSharedLists(true, true)

      console.log('[Dashboard] handleLeaveList: Successfully left list via RPC')
      hapticFeedback.success()
      showToast('Liste verlassen – deine Beiträge wurden entfernt.', 'success')
    } catch (error) {
      console.error('[Dashboard] handleLeaveList: Error:', error)
      // Rollback on error
      setSharedLists(previousSharedLists)
      showToast('Fehler beim Verlassen der Liste', 'error')
      hapticFeedback.error()
    }
  }

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const currentLists = listView === 'meine' ? lists : sharedLists
  const normalizedPrivateFilters = {
    city: privateFilters.city.trim(),
    category: privateFilters.category
  }
  const hasActivePrivateFilters = Boolean(normalizedPrivateFilters.city) || Boolean(normalizedPrivateFilters.category)
  // OPTIMIERT: Loading nur anzeigen wenn wirklich noch nichts geladen wurde
  // Wenn bereits Daten vorhanden sind, kein Loading beim Tab-Wechsel
  const currentLoading = listView === 'meine' 
    ? (loading && !hasLoadedPrivateListsRef.current && lists.length === 0)
    : (sharedListsLoading && !hasLoadedSharedListsRef.current && sharedLists.length === 0)
  
  // isEmpty: Zeige Welcome Screen nur wenn KEINE Listen vorhanden sind (private + shared owned + member shared)
  // WICHTIG: Pending Einladungen zählen NICHT
  // Zero-State: totalListsCount === 0 UND nicht am Laden
  const isEmpty = totalListsCount === 0 && !isCountingLists && !loading && !sharedListsLoading
  
  // Verwende Math.max(1, length) um Division durch 0 zu vermeiden
  const { cardHeight, gap, titleSize, subtitleSize, padding, borderRadius } = calculateCardLayout(Math.max(1, currentLists.length))

  // Don't show loading screen if we have optimistic lists (seamless transition)
  // Zeige Loading nur wenn wirklich nichts geladen wurde UND noch am Zählen/Laden
  if (isCountingLists || (loading && lists.length === 0 && listView === 'meine' && totalListsCount === 0)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark 
          ? 'bg-gradient-to-b from-gray-900 to-gray-800' 
          : 'bg-gradient-to-b from-white to-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt deine Listen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Background with gradient */}
      <div 
        className="fixed inset-0"
        style={{
          background: isDark 
            ? 'radial-gradient(60% 50% at 50% 0%, #1F2937 0%, #111827 60%)'
            : 'radial-gradient(60% 50% at 50% 0%, #FFF1E8 0%, #FFFFFF 60%)',
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
      <header className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-[12px] border-b border-gray-200/30 dark:border-gray-700/30 flex items-center justify-between sticky top-0 z-10"
        style={{
          paddingLeft: 'clamp(16px, 4vw, 24px)',
          paddingRight: 'clamp(16px, 4vw, 24px)',
          paddingTop: `calc(clamp(12px, 3vh, 16px) + env(safe-area-inset-top))`,
          paddingBottom: 'clamp(12px, 3vh, 16px)',
          minHeight: `calc(60px + env(safe-area-inset-top))`,
        }}
      >
        <button
          onClick={() => {
            hapticFeedback.light()
            // OPTIMIERT: Sofort navigieren, keine Verzögerung
            navigate('/account')
          }}
          className="flex items-center justify-center active:scale-95 transition-all"
          style={{
            minWidth: 'clamp(40px, 3vw, 56px)',
            minHeight: 'clamp(40px, 3vw, 56px)',
            width: 'clamp(40px, 3vw, 56px)',
            height: 'clamp(40px, 3vw, 56px)',
          }}
          aria-label="Öffne Profil"
        >
          <Avatar 
            size="responsive"
            className="w-full h-full"
          />
        </button>

        <h1 
          className="text-gray-900 dark:text-white flex-1 text-center px-2" 
          style={{ 
            fontFamily: "'Poppins', sans-serif", 
            fontWeight: 700,
            fontSize: 'clamp(16px, 4vw, 18px)',
            lineHeight: '1.2',
          }}
        >
          {isEmpty ? 'Rankify' : `${getUsername()}s Foodspots`}
        </h1>

        <button
          onClick={() => {
            hapticFeedback.light()
            // OPTIMIERT: Sofort navigieren, keine Verzögerung
            navigate('/settings')
          }}
          className="flex items-center justify-center"
          style={{
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
          }}
          aria-label="Öffne Einstellungen"
        >
          <svg 
            className="w-7 h-7 text-gray-900 dark:text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Tabs: Meine Listen / Geteilte Listen - NUR anzeigen wenn nicht isEmpty */}
      {!isEmpty && (
        <div className={`border-b sticky top-[60px] z-10 ${
          isDark ? 'bg-gray-800/70 border-gray-700/30' : 'bg-white/70 border-gray-200/30'
        } backdrop-blur-[12px]`}>
          <div className="flex">
            <button
              onClick={() => {
                hapticFeedback.light()
                setListView('meine')
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all relative ${
                listView === 'meine'
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
            >
              <span>Meine Listen</span>
        {listView === 'meine' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]" />
              )}
            </button>
            <button
              onClick={() => {
                hapticFeedback.light()
                // OPTIMIERT: Tab-Wechsel ohne Fetch - Daten sind bereits geladen
                setListView('geteilt')
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all relative ${
                listView === 'geteilt'
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
            >
              <span>Geteilte Listen</span>
              {listView === 'geteilt' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto px-4 py-6 relative ${isEmpty ? '' : 'pb-24'}`}>
        {/* Zero-State: Welcome Screen (keine Tabs, keine Bottom Navigation) */}
            {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] text-center px-4">
            <WelcomeCard 
              username={getUsername()} 
              onCreateList={() => navigate('/select-category')} 
              foodEmoji={userFoodEmoji} 
            />
                <FeaturesSection />
          </div>
        ) : (
          <>
            {/* Private Lists View */}
            {listView === 'meine' && (
              <>
                <div className="max-w-5xl mx-auto w-full mb-6">
                  <div className={`rounded-2xl border shadow-sm ${
                    isDark ? 'bg-gray-800/80 border-gray-700/60' : 'bg-white/80 border-gray-200/60'
                  }`}>
                    <button
                      onClick={() => setIsFilterExpanded(prev => !prev)}
                      className={`w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 transition-all ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      <span className="text-sm font-semibold uppercase tracking-wide" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Filter
                        {hasActivePrivateFilters && (
                          <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                            isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                          }`}>
                            Aktiv
                          </span>
                        )}
                      </span>
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          isFilterExpanded ? 'rotate-180' : ''
                        } ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isFilterExpanded ? (
                      <div className="px-4 py-4 sm:px-5 sm:py-5 border-t border-gray-200/60 dark:border-gray-700/60">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                          <div className="flex-1 min-w-[180px]">
                            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              Ort
                            </label>
                            <input
                              type="text"
                              value={privateFilters.city}
                              onChange={(e) => setPrivateFilters(prev => ({ ...prev, city: e.target.value }))}
                              placeholder="Ort oder Stadtteil (z. B. München)"
                              maxLength={100}
                              autoComplete="off"
                              className={`w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                                isDark
                                  ? 'bg-gray-900/60 border-gray-700 text-white placeholder:text-gray-500 focus:ring-[#FF9357]/20'
                                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
                              }`}
                            />
                          </div>

                          <div className="w-full sm:w-56">
                            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              Kategorie
                            </label>
                            <select
                              value={privateFilters.category}
                              onChange={(e) => setPrivateFilters(prev => ({ ...prev, category: e.target.value }))}
                              className={`w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                                isDark
                                  ? 'bg-gray-900/60 border-gray-700 text-white focus:ring-[#FF9357]/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:ring-[#FF7E42]/20'
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

                          <div className="flex sm:flex-col sm:items-end gap-3">
                            <button
                              onClick={handleResetFilters}
                              disabled={!hasActivePrivateFilters}
                              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                                hasActivePrivateFilters
                                  ? isDark
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  : isDark
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Filter löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`px-4 py-3 sm:px-5 sm:py-4 border-t border-gray-200/60 dark:border-gray-700/60 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <div className="flex items-center gap-3 text-xs sm:text-sm">
                          <div className={`px-3 py-1 rounded-full border ${
                            isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white/80'
                          }`}>
                            Ort: {privateFilters.city ? privateFilters.city : 'Alle'}
                          </div>
                          <div className={`px-3 py-1 rounded-full border ${
                            isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white/80'
                          }`}>
                            Kategorie: {privateFilters.category ? privateFilters.category : 'Alle'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {lists.length === 0 && !loading ? (
                  hasActivePrivateFilters ? (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
                      <div className="text-4xl mb-4">🔍</div>
                      <h3 className={`text-xl font-semibold mb-2 ${
                        isDark ? 'text-gray-200' : 'text-gray-900'
                      }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Keine Listen für diese Filter
                      </h3>
                      <p className={`text-sm mb-6 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Passe deine Suche an oder setze die Filter zurück.
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        Filter zurücksetzen
                      </button>
                    </div>
                  ) : (
                  // Leerzustand im Tab "Meine Listen" - nur einfacher Button, kein Welcome Card
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <div className="mb-6">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 mx-auto ${
                        isDark ? 'bg-gray-800' : 'bg-gray-100'
                      }`}>
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className={`text-xl font-semibold mb-2 ${
                        isDark ? 'text-gray-200' : 'text-gray-900'
                      }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Noch keine Listen
                      </h3>
                      <p className={`text-sm mb-6 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Erstelle deine erste private Liste
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        hapticFeedback.medium()
                        navigate('/select-category')
                      }}
                      className={`px-6 py-3 rounded-xl font-semibold text-base transition-all active:scale-95 flex items-center gap-2 ${
                        isDark
                          ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-lg'
                          : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-lg'
                      }`}
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Liste hinzufügen
                    </button>
              </div>
                  )
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
                className="relative overflow-hidden shadow-lg active:scale-[0.98] transition-all cursor-pointer group"
                style={{
                  height: `${cardHeight}px`,
                  borderRadius: `${borderRadius}px`,
                  transition: `all 0.2s ${springEasing.default}`,
                  animation: `fadeSlideUp 0.4s ${springEasing.gentle} ${staggerDelay(index, 40)} both`,
                }}
              >
                {/* Background Image */}
                {list.cover_image_url ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${list.cover_image_url})` }}
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${
                    isDark 
                      ? 'from-gray-700 to-gray-800' 
                      : 'from-gray-200 to-gray-300'
                  }`} />
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
                    <div className={`absolute top-12 right-0 rounded-xl shadow-xl overflow-hidden min-w-[140px] ${
                      isDark ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenForList(null)
                          openEditModal(list.id)
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-2 transition-colors ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        }`}
                      >
                        <svg className={`w-5 h-5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Bearbeiten</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenForList(null)
                          setShowDeleteConfirm(list.id)
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-2 transition-colors ${
                          isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                        }`}
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
              onClick={() => {
                hapticFeedback.medium()
                navigate('/create-list')
              }}
              onTouchStart={() => hapticFeedback.light()}
              className={`w-full border-2 border-dashed rounded-[24px] p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] group ${
                isDark
                  ? 'border-gray-600 hover:border-[#FF9357] hover:bg-[#B85C2C]/20'
                  : 'border-gray-300 hover:border-[#FFB25A] hover:bg-[#FFE4C3]/30'
              }`}
              style={{
                transition: `all 0.2s ${springEasing.default}`,
                animation: `fadeSlideUp 0.4s ${springEasing.gentle} ${staggerDelay(lists.length, 40)} both`,
              }}
            >
              <div className="text-3xl">📋</div>
              <div className="text-center">
                <p className={`font-semibold transition-colors ${
                  isDark
                    ? 'text-gray-200 group-hover:text-[#FF9357]'
                    : 'text-gray-700 group-hover:text-[#FF7E42]'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  + Weitere Liste erstellen
                </p>
              </div>
            </button>
          </div>
            )}
          </>
            )}

            {/* Shared Lists View */}
            {listView === 'geteilt' && (
          <>
            {sharedListsLoading && sharedLists.length === 0 ? (
              <div className="flex items-center justify-center min-h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4 animate-bounce">👥</div>
                  <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt geteilte Listen...</p>
                </div>
              </div>
            ) : sharedLists.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-full text-center px-4">
                <div className="text-6xl mb-4">🤝</div>
                <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Noch keine geteilten Listen
                </h2>
                <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Teile eine Liste mit Freunden oder akzeptiere eine Einladung im Social-Tab
                </p>
                <button
                  onClick={() => {
                    hapticFeedback.light()
                    navigate('/social')
                  }}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                    isDark
                      ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C] text-white'
                      : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white'
                  }`}
                >
                  Zum Social-Tab
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
                {sharedLists.map((list, index) => (
                  <div
                    key={list.id}
                    onClick={(e) => {
                      if (list.isPending) {
                        e.preventDefault()
                        e.stopPropagation()
                        return
                      }
                      handleListClick(list.id, e)
                    }}
                    className={`relative overflow-hidden shadow-lg transition-all cursor-pointer group ${
                      list.isPending ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'
                    }`}
                    style={{
                      height: `${cardHeight}px`,
                      borderRadius: `${borderRadius}px`,
                      transition: `all 0.2s ${springEasing.default}`,
                      animation: `fadeSlideUp 0.4s ${springEasing.gentle} ${staggerDelay(index, 40)} both`,
                    }}
                  >
                    {/* Background Image */}
                    {list.cover_image_url ? (
                      <div 
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${list.cover_image_url})` }}
                      />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${
                        isDark 
                          ? 'from-gray-700 to-gray-800' 
                          : 'from-gray-200 to-gray-300'
                      }`} />
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                    {/* Pending Badge */}
                    {list.isPending && (
                      <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-full bg-yellow-500/90 backdrop-blur-sm text-white text-xs font-semibold">
                        Ausstehend
                      </div>
                    )}

                    {/* Menu Button (for Owner: always show, for Member: only if not pending) */}
                    {(list.isOwner || !list.isPending) && (
                      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
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

                        {!list.isPending && (
                          <div className={`px-3 py-1.5 rounded-full backdrop-blur-sm text-white text-xs font-semibold shadow-lg ${
                            list.isOwner ? 'bg-blue-500/90' : 'bg-green-500/90'
                          }`}>
                            {list.isOwner ? 'Owner' : list.membershipRole === 'editor' ? 'Editor' : 'Viewer'}
                          </div>
                        )}

                        {/* Dropdown Menu */}
                        {menuOpenForList === list.id && (
                          <div className={`absolute top-12 right-0 rounded-xl shadow-xl overflow-hidden min-w-[160px] z-50 ${
                            isDark ? 'bg-gray-800' : 'bg-white'
                          }`}>
                            {/* Bearbeiten - für Owner & Editor */}
                            {(list.isOwner || list.role === 'editor') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenForList(null)
                                  setShowEditSharedListModal(list)
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-2 transition-colors ${
                                  isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span className="font-medium">Bearbeiten</span>
                              </button>
                            )}
                            
                            {list.isOwner ? (
                              // Owner: Can delete
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenForList(null)
                                  setShowDeleteConfirm(list.id)
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-2 transition-colors ${
                                  isDark ? 'hover:bg-red-900/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="font-medium">Löschen</span>
                              </button>
                            ) : (
                              // Member (Editor/Viewer): Can leave
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenForList(null)
                                  setShowLeaveConfirm(list.id)
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-2 transition-colors ${
                                  isDark ? 'hover:bg-orange-900/20 text-orange-400' : 'hover:bg-orange-50 text-orange-600'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span className="font-medium">Liste verlassen</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

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
                        
                        {/* Member Avatars - show up to 4 */}
                        {list.members && list.members.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex -space-x-2">
                              {list.members.slice(0, 4).map((member, idx) => (
                                <div
                                  key={member.user_id}
                                  className="w-7 h-7 rounded-full border-2 border-white/90 overflow-hidden bg-gradient-to-br from-gray-600 to-gray-700 shadow-lg"
                                  style={{ zIndex: 4 - idx }}
                                  title={member.username || 'Member'}
                                >
                                  {member.profile_image_url ? (
                                    <img 
                                      src={member.profile_image_url} 
                                      alt={member.username || 'Member'} 
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                                      {(member.username || '?').charAt(0).toUpperCase()}
                      </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <span className="text-white/90 text-xs font-semibold drop-shadow-md">
                              👥 {list.totalMembers} {list.totalMembers === 1 ? 'Mitglied' : 'Mitglieder'}
                              {list.totalMembers > 4 && ` +${list.totalMembers - 4}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
            )}
          </>
        )}
      </main>

      {/* FAB: Nur anzeigen wenn listView === 'meine' UND nicht im Welcome-Screen (!isEmpty) */}
      {listView === 'meine' && !isEmpty && (
        <button
          onClick={() => {
            if (loading) return
            hapticFeedback.medium()
            navigate('/create-list')
          }}
          onTouchStart={() => !loading && hapticFeedback.light()}
          className={`fixed right-6 bottom-20 sm:bottom-24 md:bottom-28 lg:bottom-32 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all active:scale-95 hover:shadow-2xl hover:scale-105 z-40 ${
            loading
              ? 'opacity-80 cursor-not-allowed'
              : ''
          } ${
            isDark
              ? 'bg-gradient-to-br from-[#FF9357] to-[#B85C2C]'
              : 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
          }`}
          style={{
            bottom: `calc(env(safe-area-inset-bottom, 16px) + 72px)`
          }}
          aria-label="Neue Liste erstellen"
          aria-disabled={loading}
        >
          {loading ? (
            <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          )}
          <span className="sr-only">Neue Liste</span>
        </button>
      )}

      {toast && (
        <div 
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-2xl shadow-lg z-50 ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-gray-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Edit Modal (private lists) */}
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

      {/* Edit Shared List Modal (Owner & Editor only) */}
      {showEditSharedListModal && (
        <EditSharedListModal
          list={showEditSharedListModal}
          onClose={() => {
            setShowEditSharedListModal(null)
          }}
          onSave={(success, updatedList) => {
            setShowEditSharedListModal(null)
            if (success && updatedList) {
              // Optimistic update: Update shared list in state immediately
              setSharedLists(prev => prev.map(l => l.id === updatedList.id ? { ...l, ...updatedList } : l))
              showToast('Liste erfolgreich aktualisiert!', 'success')
            } else if (!success && updatedList) {
              // Rollback on error
              setSharedLists(prev => prev.map(l => l.id === updatedList.id ? updatedList : l))
              showToast('Fehler beim Speichern. Bitte versuche es erneut.', 'error')
            }
            // Shared lists will auto-refresh via realtime subscription
          }}
        />
      )}

      {/* Bottom Navigation - Only Friends & Account, Settings removed */}
      {!isEmpty && (
        <nav 
          className="fixed bottom-0 left-0 right-0 backdrop-blur-[12px] px-4 py-3 flex items-center justify-around bg-white/60 dark:bg-gray-800/60 border-t border-gray-200/30 dark:border-gray-700/30"
          style={{
            paddingBottom: `max(12px, env(safe-area-inset-bottom))`,
          }}
        >
          <button 
            onClick={() => {
              hapticFeedback.light()
              navigate('/social')
            }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform relative"
            style={{
              minWidth: '44px',
              minHeight: '44px',
            }}
            aria-label="Social"
          >
            <div className="relative">
              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {hasSocialNotifications && (
                <span 
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"
                  style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                />
              )}
            </div>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500" style={{ fontFamily: "'Poppins', sans-serif" }}>Social</span>
          </button>

          <button 
            onClick={() => {
              hapticFeedback.light()
              navigate('/discover')
            }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            style={{
              minWidth: '44px',
              minHeight: '44px',
            }}
            aria-label="Entdecken"
          >
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19a8 8 0 100-16 8 8 0 000 16z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500" style={{ fontFamily: "'Poppins', sans-serif" }}>Entdecken</span>
          </button>

          <button 
            onClick={() => {
              hapticFeedback.light()
              navigate('/account')
            }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            style={{
              minWidth: '44px',
              minHeight: '44px',
            }}
            aria-label="Account"
          >
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500" style={{ fontFamily: "'Poppins', sans-serif" }}>Profil</span>
          </button>
        </nav>
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
              Möchtest du diese geteilte Liste wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden. Alle Mitglieder und ausstehende Einladungen werden entfernt.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={`flex-1 py-3 rounded-[14px] border font-semibold transition-all ${
                  isDark
                    ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDeleteList(showDeleteConfirm)}
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

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl shadow-2xl max-w-md w-full p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Liste verlassen?
            </h2>
            <p className={`mb-6 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Möchtest du diese Liste wirklich verlassen? Du verlierst den Zugriff auf alle Einträge und kannst nur durch eine neue Einladung wieder beitreten.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(null)}
                className={`flex-1 py-3 rounded-[14px] border font-semibold transition-all ${
                  isDark
                    ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  handleLeaveList(showLeaveConfirm)
                  setShowLeaveConfirm(null)
                }}
                className={`flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg transition-all ${
                  isDark
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                Verlassen
              </button>
            </div>
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

// Edit Shared List Modal Component (nur für Owner & Editor)
function EditSharedListModal({ list, onClose, onSave }) {
  const { isDark } = useTheme()
  const { user } = useAuth()
  
  const [formData, setFormData] = useState({
    list_name: list.list_name,
    city: list.city,
    coverImageUrl: list.cover_image_url,
    coverImageFile: null,
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageRemoved, setImageRemoved] = useState(false)
  
  // Teilnehmerverwaltung
  const [members, setMembers] = useState([])
  const [pendingInvitations, setPendingInvitations] = useState([])
  const [availableFriends, setAvailableFriends] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredFriends, setFilteredFriends] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState([]) // IDs der ausgewählten Freunde
  const [selectedRole, setSelectedRole] = useState({}) // { userId: 'editor' | 'viewer' }
  const [inviting, setInviting] = useState(false)
  const isOwner = list.isOwner || list.user_id === user.id
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const debounceTimerRef = useRef(null)

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

    // Optimistic update
    const previousList = { ...list }
    const updatedList = {
      ...list,
      list_name: formData.list_name.trim(),
      city: formData.city.trim(),
      cover_image_url: formData.coverImageUrl || list.cover_image_url,
    }
    
    onSave(true, updatedList)

    try {
      let imageUrl = list.cover_image_url
      
      // Upload new image if provided
      if (formData.coverImageFile) {
        const fileExt = formData.coverImageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('list-covers')
          .upload(fileName, formData.coverImageFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('list-covers')
          .getPublicUrl(fileName)

        if (!urlData || !urlData.publicUrl) {
          throw new Error('Failed to get public URL for uploaded image')
        }

        imageUrl = urlData.publicUrl
      }
      else if (imageRemoved) {
        imageUrl = null
      }

      // Update database
      const { error: updateError } = await supabase
        .from('lists')
        .update({
          list_name: formData.list_name.trim(),
          city: formData.city.trim(),
          cover_image_url: imageUrl,
        })
        .eq('id', list.id)

      if (updateError) {
        console.error('Update error:', updateError)
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      // Sync with server
      const { data: finalList } = await supabase
        .from('lists')
        .select('*')
        .eq('id', list.id)
        .single()
      
      if (finalList) {
        onSave(true, finalList)
      }
    } catch (error) {
      console.error('Error updating shared list:', error)
      onSave(false, previousList)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch members, invitations and friends
  useEffect(() => {
    fetchParticipants()
    fetchAvailableFriends()

    // Subscribe to realtime updates for invitations and members
    const invitationsChannel = supabase
      .channel(`list_invitations_${list.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_invitations',
          filter: `list_id=eq.${list.id}`
        },
        (payload) => {
          console.log('Invitation update:', payload)
          fetchParticipants() // Refresh invitations
        }
      )
      .subscribe()

    const membersChannel = supabase
      .channel(`list_members_${list.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_members',
          filter: `list_id=eq.${list.id}`
        },
        (payload) => {
          console.log('Member update:', payload)
          fetchParticipants() // Refresh members
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(invitationsChannel)
      supabase.removeChannel(membersChannel)
    }
  }, [list.id])

  const fetchParticipants = async () => {
    try {
      // Fetch current members
      const { data: membersData, error: membersError } = await supabase
        .from('list_members')
        .select(`
          user_id,
          role,
          joined_at,
          users:user_id (
            id,
            email,
            user_metadata
          )
        `)
        .eq('list_id', list.id)

      if (membersError) throw membersError

      // Fetch pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('list_invitations')
        .select(`
          id,
          invitee_id,
          role,
          status,
          created_at,
          users:invitee_id (
            id,
            email,
            user_metadata
          )
        `)
        .eq('list_id', list.id)
        .eq('status', 'pending')

      if (invitationsError) throw invitationsError

      setMembers(membersData || [])
      setPendingInvitations(invitationsData || [])
    } catch (error) {
      console.error('Error fetching participants:', error)
    }
  }

  const fetchAvailableFriends = async () => {
    try {
      // Fetch friendships where user is involved
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

      if (friendshipsError) throw friendshipsError

      // Extract friend IDs
      const friendIds = friendships?.map(f => 
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      ).filter(Boolean) || []

      if (friendIds.length === 0) {
        setAvailableFriends([])
        return
      }

      // Fetch profiles for all friends
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, profile_image_url, email')
        .in('id', friendIds)

      if (profilesError) throw profilesError

      // Format friends like in CreateSharedList
      const friends = profiles?.map(profile => ({
        id: profile.id,
        email: profile.email,
        user_metadata: {
          username: profile.username || profile.email?.split('@')[0] || '',
          profileImageUrl: profile.profile_image_url
        },
        displayName: profile.username || profile.email?.split('@')[0] || ''
      })) || []

      console.log('[EditSharedListModal] Loaded friends:', friends.length)
      setAvailableFriends(friends)
    } catch (error) {
      console.error('Error fetching friends:', error)
      setAvailableFriends([])
    }
  }

  // Filter friends with debounce - show ALL friends that match, mark unavailable as disabled
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    if (!searchQuery.trim()) {
      setFilteredFriends([])
      setShowSuggestions(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[EditSharedListModal] Filtering friends...')
      console.log('[EditSharedListModal] Search query:', searchQuery)
      console.log('[EditSharedListModal] Available friends:', availableFriends.length)
      console.log('[EditSharedListModal] Friends data:', availableFriends)
      
      const queryLower = searchQuery.toLowerCase().trim()
      
      // Filter by search term - no exclusions, we'll mark them as disabled
      const filtered = availableFriends.filter(friend => {
        const username = (friend.user_metadata?.username || friend.email?.split('@')[0] || '').toLowerCase()
        const displayName = (friend.displayName || username).toLowerCase()
        const matches = username.startsWith(queryLower) || displayName.startsWith(queryLower)
        
        if (matches) {
          console.log('[EditSharedListModal] Match found:', { username, displayName, query: queryLower })
        }
        
        return matches
      })
      
      console.log('[EditSharedListModal] Filtered results:', filtered.length)
      
      // Sort by username match
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
    }, 250)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, availableFriends])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSuggestions && suggestionsRef.current && !suggestionsRef.current.contains(event.target) && inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSuggestions])

  // Check if friend is already member or invited
  const isFriendUnavailable = (friendId) => {
    const existingMemberIds = members.map(m => m.user_id)
    const pendingInviteeIds = pendingInvitations.map(inv => inv.invitee_id)
    return existingMemberIds.includes(friendId) || pendingInviteeIds.includes(friendId) || friendId === list.user_id
  }

  // Select/Toggle friend for invitation
  const selectFriend = (friend) => {
    if (isFriendUnavailable(friend.id)) return // Can't select if already member/invited
    
    if (selectedFriends.includes(friend.id)) {
      // Deselect
      setSelectedFriends(prev => prev.filter(id => id !== friend.id))
      setSelectedRole(prev => {
        const newRoles = { ...prev }
        delete newRoles[friend.id]
        return newRoles
      })
    } else {
      // Select
      setSelectedFriends(prev => [...prev, friend.id])
      if (!selectedRole[friend.id]) {
        setSelectedRole(prev => ({ ...prev, [friend.id]: 'editor' }))
      }
    }
    
    setSearchQuery('') // Clear search
    setShowSuggestions(false)
  }

  const toggleRole = (friendId) => {
    setSelectedRole(prev => ({
      ...prev,
      [friendId]: prev[friendId] === 'editor' ? 'viewer' : 'editor'
    }))
  }

  const removeSelectedFriend = (friendId) => {
    setSelectedFriends(prev => prev.filter(id => id !== friendId))
    setSelectedRole(prev => {
      const newRoles = { ...prev }
      delete newRoles[friendId]
      return newRoles
    })
  }

  const handleInviteFriends = async () => {
    if (selectedFriends.length === 0) return
    
    setInviting(true)
    try {
      // Build invitations
      const invitations = selectedFriends.map(friendId => ({
        list_id: list.id,
        inviter_id: user.id,
        invitee_id: friendId,
        role: selectedRole[friendId] || 'editor',
        status: 'pending'
      }))
      
      const { data, error } = await supabase
        .from('list_invitations')
        .insert(invitations)
        .select()

      if (error) throw error

      // Add to pending invitations locally
      const newInvitations = data.map(inv => {
        const friend = availableFriends.find(f => f.id === inv.invitee_id)
        return {
          ...inv,
          users: friend
        }
      })
      
      setPendingInvitations(prev => [...prev, ...newInvitations])
      
      // Clear selection
      setSelectedFriends([])
      setSelectedRole({})
      setSearchQuery('')
      setShowSuggestions(false)
    } catch (error) {
      console.error('Error inviting friends:', error)
      alert('Fehler beim Einladen: ' + error.message)
    } finally {
      setInviting(false)
    }
  }

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? <span key={i} className="font-bold">{part}</span> : <span key={i}>{part}</span>
    )
  }

  const handleRoleChange = async (userId, newRole) => {
    if (!isOwner) return // Only owner can change roles
    
    try {
      const { error } = await supabase
        .from('list_members')
        .update({ role: newRole })
        .eq('list_id', list.id)
        .eq('user_id', userId)

      if (error) throw error

      // Update local state
      setMembers(prev => prev.map(m => 
        m.user_id === userId ? { ...m, role: newRole } : m
      ))
    } catch (error) {
      console.error('Error changing role:', error)
      alert('Fehler beim Ändern der Rolle: ' + error.message)
    }
  }

  const getUsername = (userData) => {
    return userData?.user_metadata?.username || userData?.email?.split('@')[0] || 'Unbekannt'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 border-b px-6 py-4 flex items-center justify-between ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h2 className={`text-2xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Geteilte Liste bearbeiten
          </h2>
          <button
            onClick={onClose}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* List Name */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Listenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.list_name}
              onChange={(e) => handleInputChange('list_name', e.target.value)}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.list_name 
                  ? 'border-red-400' 
                  : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
            />
            {errors.list_name && <p className="mt-1 text-sm text-red-500">{errors.list_name}</p>}
          </div>

          {/* City */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Stadt <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.city 
                  ? 'border-red-400' 
                  : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
            />
            {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
          </div>

          {/* Cover Image */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
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
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDark
                    ? 'border-gray-600 hover:border-[#FF9357] hover:bg-[#B85C2C]/20'
                    : 'border-gray-300 hover:border-[#FF7E42] hover:bg-[#FFE4C3]/30'
                }`}>
                  <div className="text-4xl mb-2">📸</div>
                  <p className={`font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>Bild auswählen</p>
                </div>
              </label>
            )}
          </div>

          {/* Teilnehmerverwaltung */}
          <div className={`border-t pt-6 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              👥 Teilnehmer verwalten
            </h3>

            {/* Selected Friends to Invite */}
            {selectedFriends.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {selectedFriends.map((friendId) => {
                    const friend = availableFriends.find(f => f.id === friendId)
                    if (!friend) return null
                    
                    return (
                      <div
                        key={friendId}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {getUsername(friend).charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {getUsername(friend)}
                        </span>
                        <button
                          onClick={() => removeSelectedFriend(friendId)}
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
              </div>
            )}

            {/* Search & Invite */}
            <div className="mb-4">
              <label className={`block text-sm font-semibold mb-2 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Freunde hinzufügen
              </label>
              <div className="relative">
                <div className={`relative rounded-xl overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Freunde suchen..."
                    className={`w-full px-4 py-3 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} outline-none`}
                  />
                </div>
                
                {/* Friend Suggestions */}
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className={`absolute z-50 w-full mt-1 rounded-xl shadow-xl border max-h-64 overflow-y-auto ${
                      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    {filteredFriends.length === 0 ? (
                      <div className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Keine Treffer
                      </div>
                    ) : (
                      filteredFriends.map((friend) => {
                        const username = friend.user_metadata?.username || friend.email?.split('@')[0] || ''
                        const displayName = friend.displayName || username
                        const isUnavailable = isFriendUnavailable(friend.id)
                        
                        return (
                          <button
                            key={friend.id}
                            onClick={() => selectFriend(friend)}
                            disabled={isUnavailable}
                            className={`w-full px-4 py-3 flex items-center gap-3 text-left ${
                              isUnavailable
                                ? isDark ? 'opacity-40 cursor-not-allowed bg-gray-800' : 'opacity-40 cursor-not-allowed bg-gray-50'
                                : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                              isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {highlightMatch(displayName, searchQuery)}
                              </p>
                              <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                @{highlightMatch(username, searchQuery)}
                              </p>
                            </div>
                            {isUnavailable && (
                              <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Bereits dabei
                              </span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Role Selection for Selected Friends */}
            {selectedFriends.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Rollen zuweisen:
                </p>
                {selectedFriends.map((friendId) => {
                  const friend = availableFriends.find(f => f.id === friendId)
                  if (!friend) return null
                  const role = selectedRole[friendId] || 'editor'
                  
                  return (
                    <div key={friendId} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {getUsername(friend).charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {getUsername(friend)}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleRole(friendId)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          role === 'editor'
                            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                            : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700'
                        }`}
                      >
                        {role === 'editor' ? 'Editor' : 'Viewer'}
                      </button>
                    </div>
                  )
                })}
                
                {/* Invite Button */}
                <button
                  onClick={handleInviteFriends}
                  disabled={inviting || selectedFriends.length === 0}
                  className={`w-full py-3 rounded-[14px] text-white font-semibold transition-all disabled:opacity-50 ${
                    isDark
                      ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C] hover:shadow-lg'
                      : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] hover:shadow-lg'
                  }`}
                >
                  {inviting ? 'Einladen...' : `${selectedFriends.length} ${selectedFriends.length === 1 ? 'Person' : 'Personen'} einladen`}
                </button>
              </div>
            )}

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="mb-4">
                <h4 className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Ausstehende Einladungen
                </h4>
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {getUsername(invitation.users).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {getUsername(invitation.users)}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {invitation.role === 'editor' ? 'Editor' : 'Viewer'}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        Ausstehend
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Members */}
            {members.length > 0 && (
              <div>
                <h4 className={`text-sm font-semibold mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Aktuelle Mitglieder
                </h4>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.user_id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {getUsername(member.users).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {getUsername(member.users)}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Beigetreten {new Date(member.joined_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                      </div>
                      {isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                            isDark 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'bg-white border-gray-200 text-gray-700'
                          }`}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          member.role === 'editor'
                            ? isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {member.role === 'editor' ? 'Editor' : 'Viewer'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 border-t px-6 py-4 flex gap-3 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`flex-1 py-3 rounded-[14px] border font-semibold disabled:opacity-50 transition-all ${
              isDark
                ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className={`flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 transition-all ${
              isDark
                ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
            }`}
          >
            {isSubmitting ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Edit List Modal Component (für private Listen)
function EditListModal({ list, onClose, onSave }) {
  const { isDark } = useTheme()
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
      <div className={`rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 border-b px-6 py-4 flex items-center justify-between ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h2 className={`text-2xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Liste bearbeiten
          </h2>
          <button
            onClick={onClose}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* List Name */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Listenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.list_name}
              onChange={(e) => handleInputChange('list_name', e.target.value)}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.list_name 
                  ? 'border-red-400' 
                  : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
            />
            {errors.list_name && <p className="mt-1 text-sm text-red-500">{errors.list_name}</p>}
          </div>

          {/* City */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Stadt <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.city 
                  ? 'border-red-400' 
                  : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
            />
            {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Beschreibung (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              maxLength={250}
              rows={3}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all resize-none focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
              placeholder="z.B. Meine Lieblingsspots für den nächsten Urlaub..."
            />
            <p className={`mt-1 text-xs text-right ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>{formData.description.length}/250</p>
          </div>

          {/* Cover Image */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
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
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDark
                    ? 'border-gray-600 hover:border-[#FF9357] hover:bg-[#B85C2C]/20'
                    : 'border-gray-300 hover:border-[#FF7E42] hover:bg-[#FFE4C3]/30'
                }`}>
                  <div className="text-4xl mb-2">📸</div>
                  <p className={`font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>Bild auswählen</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 border-t px-6 py-4 flex gap-3 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`flex-1 py-3 rounded-[14px] border font-semibold disabled:opacity-50 transition-all ${
              isDark
                ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className={`flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 transition-all ${
              isDark
                ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
            }`}
          >
            {isSubmitting ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
