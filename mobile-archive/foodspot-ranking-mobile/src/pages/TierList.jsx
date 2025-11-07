import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, TextInput, Alert, Dimensions, RefreshControl } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'

const TIER_COLORS = {
  S: { 
    color: '#E53935',
    gradient: ['#E53935', '#C62828'],
    emoji: '🍕'
  },
  A: { 
    color: '#FB8C00',
    gradient: ['#FB8C00', '#E65100'],
    emoji: '🍔'
  },
  B: { 
    color: '#FDD835',
    gradient: ['#FDD835', '#F9A825'],
    emoji: '🌮'
  },
  C: { 
    color: '#43A047',
    gradient: ['#43A047', '#2E7D32'],
    emoji: '🍣'
  },
  D: { 
    color: '#1E88E5',
    gradient: ['#1E88E5', '#1565C0'],
    emoji: '🍜'
  }
}

const TIERS = ['S', 'A', 'B', 'C', 'D']

function TierList({ listId: propListId }) {
  const params = useLocalSearchParams()
  const listId = propListId || params?.id
  const { user } = useAuth()
  const router = useRouter()
  
  const [list, setList] = useState(null)
  const [foodspots, setFoodspots] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTierModal, setShowTierModal] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({ list_name: '', city: '', cover_image_url: null })
  const [screenData, setScreenData] = useState(Dimensions.get('window'))
  const scrollRefs = useRef({})
  const menuRef = useRef(null)

  // Track screen dimensions
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window)
    })
    return () => subscription?.remove()
  }, [])

  // Close menu when clicking outside (TouchableWithoutFeedback)
  useEffect(() => {
    if (menuOpen) {
      // In React Native, we handle this differently - menu closes on blur
      return () => setMenuOpen(false)
    }
  }, [menuOpen])

  // Check for optimistic foodspot from AddFoodspot
  useEffect(() => {
    const loadOptimisticFoodspot = async () => {
      try {
        const newFoodspotData = await AsyncStorage.getItem('newFoodspot')
        if (newFoodspotData && listId) {
          const { listId: storedListId, foodspot } = JSON.parse(newFoodspotData)
          if (storedListId === listId) {
            setFoodspots(prev => {
              const exists = prev.some(f => 
                f.id === foodspot.id || 
                (f.id?.startsWith('temp-') && f.name === foodspot.name && f.list_id === foodspot.list_id)
              )
              if (exists) return prev
              return [foodspot, ...prev]
            })
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Error parsing new foodspot:', error)
        AsyncStorage.removeItem('newFoodspot')
      }
    }
    loadOptimisticFoodspot()
  }, [listId])

  // Fetch list and foodspots
  useEffect(() => {
    if (!user || !listId) return
    
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch list
        const { data: listData, error: listError } = await supabase
          .from('lists')
          .select('*')
          .eq('id', listId)
          .eq('user_id', user.id)
          .single()

        if (listError) throw listError
        setList(listData)

        // Fetch foodspots
        const { data: spotsData, error: spotsError } = await supabase
          .from('foodspots')
          .select('*')
          .eq('list_id', listId)
          .order('rating', { ascending: false, nullsLast: true })

        if (spotsError) throw spotsError
        
        // Merge with existing optimistic foodspots
        const newFoodspotData = await AsyncStorage.getItem('newFoodspot')
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
        
        // Clear AsyncStorage if real foodspot was found
        if (newFoodspotData) {
          try {
            const { listId: storedListId, foodspot } = JSON.parse(newFoodspotData)
            if (storedListId === listId) {
              const realFoodspotExists = spotsData?.some(s => 
                s.name === foodspot.name && s.list_id === foodspot.list_id
              )
              if (realFoodspotExists) {
                await AsyncStorage.removeItem('newFoodspot')
              }
            }
          } catch (error) {
            console.error('Error parsing new foodspot:', error)
            await AsyncStorage.removeItem('newFoodspot')
          }
        }
        
        // Sort by rating
        mergedFoodspots.sort((a, b) => {
          if (a.id?.startsWith('temp-') && !b.id?.startsWith('temp-')) return -1
          if (!a.id?.startsWith('temp-') && b.id?.startsWith('temp-')) return 1
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
      .channel(`tierlist_${listId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspots',
        filter: `list_id=eq.${listId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newFoodspot = payload.new
          setFoodspots(prev => {
            const filtered = prev.filter(f => 
              !(f.id?.startsWith('temp-') && 
                f.name === newFoodspot.name && 
                f.list_id === newFoodspot.list_id)
            )
            const exists = filtered.some(f => f.id === newFoodspot.id)
            if (exists) return filtered
            return [newFoodspot, ...filtered].sort((a, b) => {
              const aRating = a.rating || 0
              const bRating = b.rating || 0
              return bRating - aRating
            })
          })
          AsyncStorage.removeItem('newFoodspot')
        } else {
          fetchData()
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [listId, user])

  // Group foodspots by tier
  const foodspotsByTier = TIERS.reduce((acc, tier) => {
    acc[tier] = foodspots.filter(spot => spot.tier === tier)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    return acc
  }, {})

  // Calculate dynamic tier sizing
  const calculateTierSizing = useMemo(() => {
    const screenHeight = screenData.height
    if (screenHeight === 0) return {}
    
    const MIN_TIER_HEIGHT = 120
    const CARD_HEIGHT = 80
    const CARD_GAP = 8
    const VERTICAL_PADDING = 8
    const VIEW_ALL_BUTTON_HEIGHT = 32
    const VIEW_ALL_BUTTON_TOP_PADDING = 8
    const VIEW_ALL_BUTTON_BOTTOM_PADDING = 12
    
    // Determine items per row based on screen width
    const screenWidth = screenData.width
    const itemsPerRow = screenWidth < 640 ? 1 : screenWidth < 1024 ? 2 : screenWidth < 1280 ? 3 : 4
    const maxItemsPerTier = 8
    
    const tierHeights = {}
    
    TIERS.forEach((tier) => {
      const count = foodspotsByTier[tier]?.length || 0
      const displayCount = Math.min(count, maxItemsPerTier)
      const hasOverflow = count > maxItemsPerTier
      
      if (count === 0) {
        tierHeights[tier] = {
          height: MIN_TIER_HEIGHT,
          maxItems: 0,
          hasOverflow: false
        }
      } else {
        const rowsNeeded = Math.ceil(displayCount / itemsPerRow)
        const gridHeight = (rowsNeeded * CARD_HEIGHT) + ((rowsNeeded - 1) * CARD_GAP)
        const viewAllSectionHeight = hasOverflow 
          ? VIEW_ALL_BUTTON_TOP_PADDING + VIEW_ALL_BUTTON_HEIGHT + VIEW_ALL_BUTTON_BOTTOM_PADDING 
          : 0
        const totalContentHeight = VERTICAL_PADDING + gridHeight + viewAllSectionHeight + (hasOverflow ? 0 : VERTICAL_PADDING)
        
        tierHeights[tier] = {
          height: Math.max(MIN_TIER_HEIGHT, totalContentHeight),
          maxItems: displayCount,
          hasOverflow
        }
      }
    })
    
    return tierHeights
  }, [screenData, foodspotsByTier])

  const handleDeleteList = async () => {
    // Optimistic update: Navigate immediately
    router.replace('/(tabs)/dashboard')
    
    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting list:', error)
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
    const previousList = { ...list }
    const updatedList = {
      ...list,
      list_name: editFormData.list_name.trim(),
      city: editFormData.city.trim(),
      cover_image_url: editFormData.cover_image_url
    }
    
    setList(updatedList)
    setShowEditModal(false)
    
    try {
      const { error } = await supabase
        .from('lists')
        .update({
          list_name: editFormData.list_name.trim(),
          city: editFormData.city.trim(),
          cover_image_url: editFormData.cover_image_url
        })
        .eq('id', listId)

      if (error) throw error
      
      const { data: listData } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .single()
      
      if (listData) {
        setList(listData)
      }
    } catch (error) {
      console.error('Error updating list:', error)
      setList(previousList)
      setShowEditModal(true)
      Alert.alert('Fehler', 'Fehler beim Speichern. Bitte versuche es erneut.')
    }
  }

  const handleCoverImageChange = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Berechtigung', 'Berechtigung für Fotos wurde nicht erteilt')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      })

      if (result.canceled) return

      const image = result.assets[0]
      if (!image) return

      // Resize and compress
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        image.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )

      // Convert to blob
      const response = await fetch(manipulatedImage.uri)
      const blob = await response.blob()

      const fileExt = 'jpg'
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('list-covers')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
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
      Alert.alert('Fehler', 'Fehler beim Hochladen des Bildes')
    }
  }

  const handlePullToRefresh = async () => {
    setRefreshing(true)
    const { data: spotsData, error: spotsError } = await supabase
      .from('foodspots')
      .select('*')
      .eq('list_id', listId)
      .order('rating', { ascending: false, nullsLast: true })

    if (!spotsError) {
      setFoodspots(spotsData || [])
    }
    setRefreshing(false)
  }

  const getCategoryEmoji = (category) => {
    const emojis = {
      'Döner': '🥙',
      'Burger': '🍔',
      'Pizza': '🍕',
      'Asiatisch': '🍜',
      'Mexikanisch': '🌮',
      'Glühwein': '🍷'
    }
    return emojis[category] || '🍽️'
  }

  // Don't show loading screen if we have optimistic foodspots
  if (loading && !list && foodspots.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingEmoji}>🍔</Text>
          <Text style={styles.loadingText}>Lädt Liste...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!list) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Liste nicht gefunden</Text>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)/dashboard')}
          >
            <Text style={styles.backButtonText}>Zurück zum Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const totalSpots = foodspots.length

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Text style={styles.headerButtonText}>←</Text>
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Foodspots in {list.city}
        </Text>

        <View style={styles.headerRight}>
          <Pressable
            ref={menuRef}
            style={styles.headerButton}
            onPress={() => setMenuOpen(!menuOpen)}
          >
            <Text style={styles.menuIcon}>⋯</Text>
          </Pressable>

          {menuOpen && (
            <View style={styles.menu}>
              <Pressable
                style={styles.menuItem}
                onPress={() => handleOpenEditModal('name')}
              >
                <Text style={styles.menuItemText}>✏️ Liste umbenennen</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => handleOpenEditModal('city')}
              >
                <Text style={styles.menuItemText}>📍 Stadt ändern</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => handleOpenEditModal('cover')}
              >
                <Text style={styles.menuItemText}>📸 Titelbild ändern</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={[styles.menuItem, styles.menuItemDanger]}
                onPress={() => {
                  setMenuOpen(false)
                  setShowDeleteConfirm(true)
                }}
              >
                <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>🗑️ Liste löschen</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Main Content - All Tiers Always Visible */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} />
        }
      >
        {TIERS.map((tier) => {
          const tierData = TIER_COLORS[tier]
          const tierSpots = foodspotsByTier[tier] || []
          const tierSizing = calculateTierSizing[tier] || { height: 120, maxItems: 3, hasOverflow: false }
          const displayedSpots = tierSpots.slice(0, tierSizing.maxItems)
          const isEmpty = tierSpots.length === 0

          return (
            <View
              key={tier}
              style={[styles.tierContainer, { height: tierSizing.height }]}
            >
              {/* Left Tier Bar */}
              <LinearGradient
                colors={tierData.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tierBar}
              >
                <Text style={styles.tierLetter}>{tier}</Text>
              </LinearGradient>

              {/* Right Content Area */}
              <View style={styles.tierContent}>
                {isEmpty ? (
                  <View style={styles.emptyTier}>
                    <Text style={styles.emptyTierEmoji}>{tierData.emoji}</Text>
                    <Text style={styles.emptyTierText}>Noch leer</Text>
                  </View>
                ) : (
                  <View style={styles.tierContentInner}>
                    <View style={[styles.tierGrid, tierSizing.hasOverflow && styles.tierGridWithOverflow]}>
                      {displayedSpots.map((spot) => (
                        <Pressable
                          key={spot.id}
                          style={styles.foodspotCard}
                          onPress={() => router.push(`/add-foodspot/${listId}?spotId=${spot.id}`)}
                        >
                          <View style={styles.foodspotCardContent}>
                            <View style={styles.foodspotCardText}>
                              <Text style={styles.foodspotCardName} numberOfLines={1}>
                                {spot.name}
                              </Text>
                              <View style={styles.foodspotCardMeta}>
                                <View style={styles.foodspotCardRating}>
                                  <Text style={styles.foodspotCardRatingEmoji}>⭐</Text>
                                  <Text style={styles.foodspotCardRatingText}>
                                    {(spot.rating || 0).toFixed(1)}/10
                                  </Text>
                                </View>
                                {spot.category && (
                                  <View style={styles.foodspotCardCategory}>
                                    <Text style={styles.foodspotCardCategoryEmoji}>
                                      {getCategoryEmoji(spot.category)}
                                    </Text>
                                    <Text style={styles.foodspotCardCategoryText} numberOfLines={1}>
                                      {spot.category}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {spot.address && (
                                <Text style={styles.foodspotCardAddress} numberOfLines={1}>
                                  📍 {spot.address.split(',')[0]}
                                </Text>
                              )}
                            </View>
                            {spot.cover_photo_url ? (
                              <Image
                                source={{ uri: spot.cover_photo_url }}
                                style={styles.foodspotCardImage}
                              />
                            ) : (
                              <View style={[styles.foodspotCardImage, styles.foodspotCardImagePlaceholder]} />
                            )}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                    
                    {tierSizing.hasOverflow && (
                      <Pressable
                        style={styles.viewAllButton}
                        onPress={() => setShowTierModal(tier)}
                      >
                        <Text style={styles.viewAllButtonText}>
                          Alle {tier}-Tier Einträge anzeigen
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable
        style={styles.floatingAddButton}
        onPress={() => router.push(`/add-foodspot/${listId}`)}
      >
        <Text style={styles.floatingAddButtonText}>+</Text>
      </Pressable>

      {/* Edit Modal */}
      {showEditModal && (
        <Modal
          visible={!!showEditModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {showEditModal === 'name' && 'Liste umbenennen'}
                {showEditModal === 'city' && 'Stadt ändern'}
                {showEditModal === 'cover' && 'Titelbild ändern'}
              </Text>
              
              {showEditModal === 'name' && (
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Neuer Listenname</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editFormData.list_name}
                    onChangeText={(text) => setEditFormData(prev => ({ ...prev, list_name: text }))}
                    placeholder="z. B. Beste Burger Münchens"
                  />
                </View>
              )}
              
              {showEditModal === 'city' && (
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Neue Stadt</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editFormData.city}
                    onChangeText={(text) => setEditFormData(prev => ({ ...prev, city: text }))}
                    placeholder="z. B. München"
                  />
                </View>
              )}
              
              {showEditModal === 'cover' && (
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Neues Titelbild</Text>
                  {editFormData.cover_image_url ? (
                    <View style={styles.modalImageContainer}>
                      <Image
                        source={{ uri: editFormData.cover_image_url }}
                        style={styles.modalImage}
                      />
                      <Pressable
                        style={styles.modalImageRemove}
                        onPress={() => setEditFormData(prev => ({ ...prev, cover_image_url: null }))}
                      >
                        <Text style={styles.modalImageRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.modalImagePicker}
                      onPress={handleCoverImageChange}
                    >
                      <Text style={styles.modalImagePickerEmoji}>📸</Text>
                      <Text style={styles.modalImagePickerText}>Bild auswählen</Text>
                      <Text style={styles.modalImagePickerHint}>PNG, JPG bis 5MB</Text>
                    </Pressable>
                  )}
                </View>
              )}
              
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.modalButtonCancelText}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.modalButtonSaveText}>Speichern</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Liste löschen?</Text>
              <Text style={styles.modalText}>
                Möchtest du diese Liste wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={styles.modalButtonCancelText}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonDanger]}
                  onPress={handleDeleteList}
                >
                  <Text style={styles.modalButtonDangerText}>Löschen</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Tier Modal - View All Entries */}
      {showTierModal && (
        <Modal
          visible={!!showTierModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTierModal(null)}
        >
          <SafeAreaView style={styles.tierModalContainer} edges={['top', 'bottom']}>
            <View style={styles.tierModalHeader}>
              <View style={styles.tierModalHeaderLeft}>
                <LinearGradient
                  colors={TIER_COLORS[showTierModal]?.gradient || ['#000', '#000']}
                  style={styles.tierModalBadge}
                >
                  <Text style={styles.tierModalBadgeText}>{showTierModal}</Text>
                </LinearGradient>
                <View>
                  <Text style={styles.tierModalTitle}>{showTierModal}-Tier</Text>
                  <Text style={styles.tierModalSubtitle}>
                    {foodspotsByTier[showTierModal]?.length || 0} Foodspots
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.tierModalClose}
                onPress={() => setShowTierModal(null)}
              >
                <Text style={styles.tierModalCloseText}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.tierModalContent}>
              {(foodspotsByTier[showTierModal] || []).map((spot, spotIndex) => (
                <Pressable
                  key={spot.id}
                  style={styles.tierModalItem}
                  onPress={() => {
                    setShowTierModal(null)
                    router.push(`/add-foodspot/${listId}?spotId=${spot.id}`)
                  }}
                >
                  <View style={styles.tierModalItemContent}>
                    <View style={styles.tierModalItemText}>
                      <Text style={styles.tierModalItemName} numberOfLines={1}>
                        {spot.name}
                      </Text>
                      {spot.address && (
                        <Text style={styles.tierModalItemAddress} numberOfLines={1}>
                          📍 {spot.address.split(',')[0]}
                        </Text>
                      )}
                      <View style={styles.tierModalItemMeta}>
                        <View style={styles.tierModalItemRating}>
                          <Text style={styles.tierModalItemRatingEmoji}>⭐</Text>
                          <Text style={styles.tierModalItemRatingText}>
                            {(spot.rating || 0).toFixed(1)}/10
                          </Text>
                        </View>
                        {spot.category && (
                          <View style={styles.tierModalItemCategory}>
                            <Text style={styles.tierModalItemCategoryEmoji}>
                              {getCategoryEmoji(spot.category)}
                            </Text>
                            <Text style={styles.tierModalItemCategoryText}>
                              {spot.category}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {spot.cover_photo_url && (
                      <Image
                        source={{ uri: spot.cover_photo_url }}
                        style={styles.tierModalItemImage}
                      />
                    )}
                  </View>
                  {spotIndex < foodspotsByTier[showTierModal].length - 1 && (
                    <View style={styles.tierModalItemDivider} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#FF7E42',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 24,
    color: '#1F2937',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  headerRight: {
    width: 40,
    position: 'relative',
  },
  menuIcon: {
    fontSize: 24,
    color: '#1F2937',
    transform: [{ rotate: '90deg' }],
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemDanger: {
    // Styled separately
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  menuItemTextDanger: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  tierContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tierBar: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierLetter: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tierContentInner: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyTier: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTierEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTierText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tierGrid: {
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierGridWithOverflow: {
    paddingBottom: 0,
  },
  foodspotCard: {
    width: '48%',
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  foodspotCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: '100%',
  },
  foodspotCardText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  foodspotCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  foodspotCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  foodspotCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  foodspotCardRatingEmoji: {
    fontSize: 12,
  },
  foodspotCardRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  foodspotCardCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  foodspotCardCategoryEmoji: {
    fontSize: 12,
  },
  foodspotCardCategoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  foodspotCardAddress: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  foodspotCardImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  foodspotCardImagePlaceholder: {
    backgroundColor: '#E5E7EB',
  },
  viewAllButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  viewAllButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF7E42',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingAddButtonText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
  },
  modalText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  modalInputContainer: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  modalImageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  modalImage: {
    width: '100%',
    height: 192,
    resizeMode: 'cover',
  },
  modalImageRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageRemoveText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  modalImagePicker: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  modalImagePickerEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalImagePickerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  modalImagePickerHint: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonSave: {
    backgroundColor: '#FF7E42',
  },
  modalButtonSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonDanger: {
    backgroundColor: '#EF4444',
  },
  modalButtonDangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tierModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tierModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tierModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierModalBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierModalBadgeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  tierModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tierModalClose: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierModalCloseText: {
    fontSize: 32,
    color: '#6B7280',
    fontWeight: '300',
  },
  tierModalContent: {
    flex: 1,
  },
  tierModalItem: {
    paddingHorizontal: 24,
  },
  tierModalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  tierModalItemText: {
    flex: 1,
    minWidth: 0,
  },
  tierModalItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  tierModalItemAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  tierModalItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  tierModalItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierModalItemRatingEmoji: {
    fontSize: 16,
  },
  tierModalItemRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  tierModalItemCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierModalItemCategoryEmoji: {
    fontSize: 14,
  },
  tierModalItemCategoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tierModalItemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tierModalItemDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 24,
  },
})

export default TierList
