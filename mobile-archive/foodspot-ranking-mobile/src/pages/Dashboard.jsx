import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl, FlatList } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../services/supabase'
import WelcomeCard from '../components/WelcomeCard'
import FeaturesSection from '../components/FeaturesSection'
import Avatar from '../components/Avatar'
import AsyncStorage from '@react-native-async-storage/async-storage'

function Dashboard() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  
  // Initialize with optimistic list from AsyncStorage if available
  const [lists, setLists] = useState(() => {
    // Try to load optimistic list immediately (synchronous check)
    return []
  })
  const [loading, setLoading] = useState(false) // Start with false - show content immediately
  const [refreshing, setRefreshing] = useState(false)

  const getUsername = () => user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'

  // Update counts for a specific list (non-blocking)
  const updateCountsForList = React.useCallback(async (listId) => {
    if (!listId) return
    try {
      const { count } = await supabase
        .from('foodspots')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', listId)
      
      setLists(prev => prev.map(list => 
        list.id === listId ? { ...list, entryCount: count || 0 } : list
      ))
    } catch (error) {
      console.error('Error updating count:', error)
    }
  }, [])

  const fetchLists = React.useCallback(async () => {
    if (!user) {
      console.log('❌ Dashboard: No user, skipping fetch')
      return
    }
    
    // Verify session before fetching
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      console.error('❌ Dashboard: No valid session', sessionError)
      return
    }
    
    console.log('=== Dashboard Fetch Debug ===')
    console.log('User from context:', user.id)
    console.log('User from session:', session.user.id)
    console.log('User IDs match:', user.id === session.user.id)
    
    // Don't show loading spinner - just fetch in background
    try {
      // First, fetch lists quickly without counts
      console.log('Fetching lists for user_id:', user.id)
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      console.log('Lists fetch result:', {
        count: listsData?.length || 0,
        error: listsError,
        firstList: listsData?.[0]?.list_name || 'none'
      })

      if (listsError) {
        console.error('❌ Lists fetch error:', listsError)
        console.error('Error code:', listsError.code)
        console.error('Error message:', listsError.message)
        console.error('Error details:', listsError.details)
        // Bei Network-Fehler: Leere Liste setzen → Welcome Screen wird angezeigt
        setLists([])
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Set lists immediately with placeholder counts
      const listsWithPlaceholder = (listsData || []).map(list => ({ ...list, entryCount: 0 }))
      console.log('✅ Lists fetched successfully:', listsWithPlaceholder.length, 'lists')
      setLists(listsWithPlaceholder)

      // Then update counts in background (non-blocking)
      listsWithPlaceholder.forEach(list => {
        updateCountsForList(list.id)
      })
    } catch (error) {
      console.error('Error fetching lists:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      // Bei Fehler: Leere Liste → Welcome Screen wird angezeigt
      setLists([])
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, updateCountsForList])

  // Load optimistic list on focus and initial mount
  useFocusEffect(
    React.useCallback(() => {
      const loadOptimisticList = async () => {
        try {
          const newListData = await AsyncStorage.getItem('newList')
          if (newListData) {
            const newList = JSON.parse(newListData)
            setLists(prev => {
              // Check if list already exists
              const exists = prev.some(l => l.id === newList.id || (l.id?.startsWith('temp-') && newList.id?.startsWith('temp-')))
              if (!exists) {
                return [newList, ...prev]
              }
              return prev
            })
            // Clear after loading
            await AsyncStorage.removeItem('newList')
          }
        } catch (error) {
          console.error('Error loading optimistic list:', error)
        }
      }
      loadOptimisticList()
    }, [])
  )

  useEffect(() => {
    if (!user) {
      console.log('Dashboard: No user, waiting...')
      return
    }
    
    // Wait for auth state to be fully initialized
    const checkAuthAndFetch = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Dashboard: Session error', sessionError)
        return
      }
      if (!session) {
        console.log('Dashboard: No session yet, waiting...')
        return
      }
      
      console.log('Dashboard: Session confirmed, fetching lists...')
      console.log('Session user ID:', session.user.id)
      console.log('Context user ID:', user.id)
      
      // Fetch lists after session is confirmed
      fetchLists()
    }
    
    // Small delay to ensure auth state is fully initialized
    const timeoutId = setTimeout(() => {
      checkAuthAndFetch()
    }, 100)
    
    // Also listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('Dashboard: Auth state changed to SIGNED_IN, fetching lists...')
        fetchLists()
      }
    })
    
    // Subscribe to lists changes
    const listsChannel = supabase
      .channel('lists_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'lists',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Optimistically add new list
          if (payload.new) {
            setLists(prev => {
              const exists = prev.some(l => l.id === payload.new.id)
              if (!exists) {
                return [{ ...payload.new, entryCount: 0 }, ...prev]
              }
              return prev
            })
          }
          // Update counts in background
          updateCountsForList(payload.new?.id)
        } else if (payload.eventType === 'UPDATE') {
          setLists(prev => prev.map(l => l.id === payload.new.id ? { ...payload.new, entryCount: l.entryCount || 0 } : l))
        } else if (payload.eventType === 'DELETE') {
          setLists(prev => prev.filter(l => l.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
      supabase.removeChannel(listsChannel)
    }
  }, [user, updateCountsForList, fetchLists])

  const onRefresh = () => {
    setRefreshing(true)
    fetchLists()
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/')
  }

  const formatEntryCount = (count) => {
    return count === 1 ? '1 Eintrag' : `${count} Einträge`
  }

  const renderListCard = ({ item: list }) => (
    <Pressable
      style={({ pressed }) => [
        styles.listCard,
        pressed === true ? styles.listCardPressed : null,
      ]}
      onPress={() => {
        // Don't navigate to TierList if it's a temp ID (not yet created)
        if (list.id?.startsWith('temp-')) {
          console.log('Cannot navigate to temp list, waiting for real list...')
          return
        }
        router.push(`/tierlist/${list.id}`)
      }}
    >
      {list.cover_image_url ? (
        <Image 
          source={{ uri: list.cover_image_url }} 
          style={styles.listCardImage}
        />
      ) : (
        <View style={[styles.listCardImage, styles.listCardPlaceholder]} />
      )}
      <View style={styles.listCardOverlay} />
      <View style={styles.listCardContent}>
        <Text style={styles.listCardTitle}>{list.list_name}</Text>
        <Text style={styles.listCardSubtitle}>📍 {list.city}</Text>
        {list.description ? (
          <Text style={styles.listCardDescription} numberOfLines={2}>
            {list.description}
          </Text>
        ) : null}
        <Text style={styles.listCardCount}>
          🧾 {formatEntryCount(list.entryCount || 0)}
        </Text>
      </View>
    </Pressable>
  )

  // Dashboard-Logik:
  // - Wenn Listen vorhanden (≥1) → Listen anzeigen
  // - Wenn keine Listen (0) → Welcome Screen mit "Erste Liste erstellen"
  const isEmpty = lists.length === 0
  const hasLists = lists.length > 0

  console.log('Dashboard state:', {
    listsCount: lists.length,
    isEmpty,
    hasLists,
    loading,
    user: user?.id || 'none'
  })

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.avatarButton}
          onPress={() => router.push('/(tabs)/account')}
        >
          <Avatar size={48} onPress={() => router.push('/(tabs)/account')} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {isEmpty ? 'Foodspot Ranker' : `${getUsername()}s Foodspots`}
          </Text>
          {user?.email && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {user.email}
            </Text>
          )}
        </View>
        <View style={{ width: 48 }} />
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Dashboard-Logik:
            - Wenn Listen vorhanden (≥1) → Listen anzeigen
            - Wenn keine Listen (0) und nicht loading → Welcome Screen
            - Wenn loading → nichts (wird automatisch geladen)
        */}
        {hasLists ? (
          <>
            <FlatList
              data={lists}
              renderItem={renderListCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listsContainer}
            />
            <Pressable
              style={({ pressed }) => [
                styles.createButton,
                pressed === true ? styles.createButtonPressed : null,
              ]}
              onPress={() => router.push('/select-category')}
            >
              <Text style={styles.createButtonEmoji}>📋</Text>
              <Text style={styles.createButtonText}>+ Weitere Liste erstellen</Text>
            </Pressable>
          </>
        ) : !loading ? (
          <View style={styles.emptyContainer}>
            <WelcomeCard 
              username={getUsername()} 
              onCreateList={() => router.push('/select-category')}
            />
            <FeaturesSection />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF1E8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  avatarButton: {
    width: 48,
    height: 48,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  listsContainer: {
    gap: 16,
  },
  listCard: {
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  listCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  listCardImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  listCardPlaceholder: {
    backgroundColor: '#E5E7EB',
  },
  listCardOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  listCardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  listCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  listCardSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  listCardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  listCardCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  createButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  createButtonPressed: {
    borderColor: '#FFB25A',
    backgroundColor: 'rgba(255, 178, 90, 0.1)',
  },
  createButtonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
})

export default Dashboard
