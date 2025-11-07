import { useState, useEffect, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { decode } from 'base64-arraybuffer'

const allCities = [
  'München', 'Berlin', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart',
  'Düsseldorf', 'Dortmund',
  'Amsterdam', 'Barcelona', 'Brussels', 'Budapest', 'Copenhagen', 'Dublin',
  'Lisbon', 'London', 'Madrid', 'Milan', 'Oslo', 'Paris', 'Prague',
  'Rome', 'Stockholm', 'Vienna', 'Warsaw', 'Zurich',
]

function CreateList() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams()
  
  // Get category from URL params
  const categoryParam = params?.category
  const selectedCategory = categoryParam === 'all' ? null : (categoryParam || null)

  // Form state
  const [formData, setFormData] = useState({
    list_name: '',
    city: '',
    description: '',
    category: selectedCategory,
    coverImageUri: null,
    coverImageFile: null,
  })

  // Redirect if no category
  useEffect(() => {
    if (!categoryParam) {
      router.replace('/select-category')
    }
  }, [categoryParam, router])

  // Validation state
  const [errors, setErrors] = useState({})
  const [validationState, setValidationState] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // City dropdown state
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [citySearchTerm, setCitySearchTerm] = useState('')
  const cityDropdownRef = useRef(null)

  // Filtered cities
  const filteredCities = useMemo(() => {
    if (!citySearchTerm.trim()) return allCities
    const search = citySearchTerm.toLowerCase()
    return allCities.filter(city =>
      city.toLowerCase().includes(search) ||
      city.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').includes(search)
    )
  }, [citySearchTerm])

  // Auto-save to AsyncStorage
  useEffect(() => {
    if (formData.list_name || formData.city || formData.description) {
      AsyncStorage.setItem('createListDraft', JSON.stringify({
        list_name: formData.list_name,
        city: formData.city,
        description: formData.description,
      }))
    }
  }, [formData.list_name, formData.city, formData.description])

  // Load draft from AsyncStorage
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const savedData = await AsyncStorage.getItem('createListDraft')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          setFormData(prev => ({ ...prev, ...parsed }))
          if (parsed.city) {
            setCitySearchTerm(parsed.city)
          }
        }
      } catch (e) {
        console.error('Error loading draft:', e)
      }
    }
    loadDraft()
  }, [])

  // Validate form
  const validateForm = () => {
    const newErrors = {}
    const newValidationState = {}

    if (!formData.list_name.trim()) {
      newErrors.list_name = 'Listenname ist erforderlich'
      newValidationState.list_name = 'error'
    } else if (formData.list_name.length < 3) {
      newErrors.list_name = 'Mindestens 3 Zeichen erforderlich'
      newValidationState.list_name = 'error'
    } else {
      newValidationState.list_name = 'valid'
    }

    if (!formData.city.trim()) {
      newErrors.city = 'Stadt ist erforderlich'
      newValidationState.city = 'error'
    } else {
      newValidationState.city = 'valid'
    }

    setErrors(newErrors)
    setValidationState(newValidationState)
    return Object.keys(newErrors).length === 0
  }

  // Handle input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Handle city input change
  const handleCityInputChange = (value) => {
    setCitySearchTerm(value)
    handleInputChange('city', value)
    setIsCityDropdownOpen(true)
  }

  // Handle city selection
  const handleCitySelect = (city) => {
    handleInputChange('city', city)
    setCitySearchTerm('')
    setIsCityDropdownOpen(false)
  }

  // Handle cover image picker
  const handleCoverImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true, // Get base64 data for upload
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Fehler', 'Bild muss kleiner als 5MB sein')
          return
        }

        // Store URI for preview and base64 for upload
        setFormData(prev => ({
          ...prev,
          coverImageUri: asset.uri,
          coverImageFile: asset, // Store asset with base64 data
        }))
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Fehler', 'Bild konnte nicht ausgewählt werden')
    }
  }

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)

    try {
      console.log('Creating list with data:', {
        list_name: formData.list_name,
        city: formData.city,
        hasImage: !!formData.coverImageFile,
        user_id: user?.id
      })

      // Upload image if provided (following web app logic, adapted for React Native)
      let imageUrl = null
      if (formData.coverImageFile && formData.coverImageUri) {
        // Validate user ID
        if (!user || !user.id) {
          console.error('User ID not available, skipping image upload')
          Alert.alert('Fehler', 'Benutzer-ID nicht gefunden. Bitte erneut einloggen.')
        } else {
          // Get file extension from asset or default to jpg
          // In React Native, ImagePicker returns type like "image" or "image/jpeg"
          const fileExt = formData.coverImageFile.type?.includes('jpeg') || formData.coverImageFile.type?.includes('jpg') 
            ? 'jpg' 
            : formData.coverImageFile.type?.includes('png') 
            ? 'png' 
            : 'jpg'
          const fileName = `${user.id}/${Date.now()}.${fileExt}`
          
          console.log('Preparing image upload...')
          console.log('User ID:', user.id)
          console.log('File name:', fileName)
          console.log('File type from picker:', formData.coverImageFile.type)
          console.log('Detected extension:', fileExt)

          try {
            // Get content type from file extension (React Native ImagePicker type is unreliable)
            const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg'
            
            console.log('Preparing upload...')
            console.log('Bucket: list-covers')
            console.log('File path:', fileName)
            console.log('Content type:', contentType)
            
            // Check current session before upload
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
              console.error('No active session found!')
              throw new Error('No active session. Please log in again.')
            }
            console.log('Session user ID:', session.user.id)
            
            // React Native: Read file using expo-file-system and convert to ArrayBuffer
            let fileData
            if (formData.coverImageUri) {
              // Method 1: Read file from URI using expo-file-system
              console.log('Reading file from URI:', formData.coverImageUri.substring(0, 50) + '...')
              const base64 = await FileSystem.readAsStringAsync(formData.coverImageUri, {
                encoding: FileSystem.EncodingType.Base64,
              })
              console.log('File read as base64, length:', base64.length)
              // Convert base64 to ArrayBuffer for Supabase
              fileData = decode(base64)
              console.log('ArrayBuffer created, size:', fileData.byteLength)
            } else if (formData.coverImageFile.base64) {
              // Method 2: Use base64 directly
              console.log('Using base64 for upload, length:', formData.coverImageFile.base64.length)
              // Convert base64 to ArrayBuffer
              fileData = decode(formData.coverImageFile.base64)
              console.log('ArrayBuffer created from base64, size:', fileData.byteLength)
            } else {
              throw new Error('No image data available (neither URI nor base64)')
            }
            
            // Upload to storage using ArrayBuffer
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('list-covers')
              .upload(fileName, fileData, {
                cacheControl: '3600',
                upsert: false,
                contentType: contentType,
              })

            if (uploadError) {
              console.error('Upload error:', uploadError)
              console.error('Upload error details:', JSON.stringify(uploadError, null, 2))
              console.error('Upload error code:', uploadError.statusCode)
              console.error('Upload error message:', uploadError.message)
              throw new Error(`Upload failed: ${uploadError.message}`)
            }
            
            console.log('Image uploaded successfully!', uploadData)

            // Get public URL (same as web app)
            const { data: urlData } = supabase.storage
              .from('list-covers')
              .getPublicUrl(fileName)

            if (!urlData || !urlData.publicUrl) {
              throw new Error('Failed to get public URL for uploaded image')
            }

            imageUrl = urlData.publicUrl
            console.log('Image URL:', imageUrl)
          } catch (uploadErr) {
            console.error('Image upload error:', uploadErr)
            console.error('Error type:', typeof uploadErr)
            console.error('Error details:', JSON.stringify(uploadErr, Object.getOwnPropertyNames(uploadErr), 2))
            // Continue without image if upload fails (same as web app would)
            Alert.alert('Bild-Upload fehlgeschlagen', 'Die Liste wird ohne Titelbild erstellt.')
          }
        }
      }

      // Optimistic update
      const tempListId = `temp-${Date.now()}`
      const optimisticList = {
        id: tempListId,
        user_id: user.id,
        list_name: formData.list_name.trim(),
        city: formData.city.trim(),
        description: formData.description.trim() || null,
        category: formData.category || null,
        cover_image_url: imageUrl,
        entryCount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_public: false,
        accent_color: '#FF784F',
      }

      // Store optimistic list in AsyncStorage
      await AsyncStorage.setItem('newList', JSON.stringify(optimisticList))

      // Clear draft
      await AsyncStorage.removeItem('createListDraft')

      // Navigate immediately
      setIsSubmitting(false)
      router.replace('/(tabs)/dashboard')

      // Insert list in background (same as web app)
      try {
        // Check session before insert
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !session.user) {
          console.error('No active session found for insert!')
          console.error('User from context:', user)
          throw new Error('No active session. Please log in again.')
        }
        
        console.log('Session user ID:', session.user.id)
        console.log('User ID from context:', user?.id)
        
        const insertData = {
          user_id: session.user.id, // Use session user ID instead of context user ID
          list_name: formData.list_name.trim(),
          city: formData.city.trim(),
          description: formData.description.trim() || null,
          category: formData.category || null,
          cover_image_url: imageUrl,
        }

        console.log('Inserting list with data:', insertData)
        console.log('Auth UID check (will be done by RLS):', session.user.id)

        const { data: insertedList, error: insertError } = await supabase
          .from('lists')
          .insert(insertData)
          .select()
          .single()

        if (insertError) {
          console.error('Insert error details:', JSON.stringify(insertError, null, 2))
          console.error('Insert error code:', insertError.code)
          console.error('Insert error message:', insertError.message)
          console.error('Insert error hint:', insertError.hint)
          
          if (insertError.code === '23505') {
            // Duplicate key - list already exists
            console.log('Duplicate list detected, removing optimistic list')
            await AsyncStorage.removeItem('newList')
            // Real-time subscription will handle sync
            return
          }
          
          // For other errors, log but don't throw - real-time subscription will handle sync
          console.error('Non-duplicate insert error, will be handled by real-time subscription')
          // Don't remove optimistic list - let user see it until real-time sync
        } else {
          console.log('List inserted successfully:', insertedList)
          
          if (insertedList) {
            const realList = {
              ...insertedList,
              entryCount: 0,
            }
            await AsyncStorage.setItem('newList', JSON.stringify(realList))
            console.log('Real list stored in AsyncStorage')
          }
        }
      } catch (error) {
        console.error('Error creating list in background:', error)
        console.error('Error type:', typeof error)
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
        // Don't remove optimistic list - let real-time subscription handle sync
        // The list might still be created, just delayed
      }
    } catch (error) {
      console.error('Error creating list:', error)
      showToast('Fehler beim Erstellen der Liste. Bitte versuche es erneut.', 'error')
      setIsSubmitting(false)
    }
  }

  const isFormValid = () => {
    return formData.list_name.trim().length >= 3 && formData.city.trim().length > 0
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#FFFFFF', '#FFF2EB', '#FFFFFF']}
        style={styles.background}
      >
        {/* Loading Overlay */}
        {isSubmitting && (
          <Modal transparent visible={isSubmitting === true}>
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#FF7E42" />
                <Text style={styles.loadingTitle}>Liste wird erstellt...</Text>
                <Text style={styles.loadingText}>Einen Moment bitte</Text>
              </View>
            </View>
          </Modal>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed === true ? styles.backButtonPressed : null,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Neue Liste erstellen</Text>
            {selectedCategory && (
              <Text style={styles.headerSubtitle}>({selectedCategory})</Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* List Name */}
          <View style={styles.formCard}>
            <Text style={styles.label}>
              Listenname <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.list_name ? styles.inputError : null,
                validationState.list_name === 'valid' ? styles.inputValid : null,
              ]}
              value={formData.list_name}
              onChangeText={(value) => handleInputChange('list_name', value)}
              placeholder="z. B. Beste Burger Münchens"
              placeholderTextColor="#9CA3AF"
            />
            {errors.list_name && (
              <Text style={styles.errorText}>{errors.list_name}</Text>
            )}
          </View>

          {/* City */}
          <View style={styles.formCard}>
            <Text style={styles.label}>
              Stadt <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.cityInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.city ? styles.inputError : null,
                  validationState.city === 'valid' ? styles.inputValid : null,
                ]}
                value={formData.city}
                onChangeText={handleCityInputChange}
                onFocus={() => setIsCityDropdownOpen(true)}
                placeholder="z. B. München"
                placeholderTextColor="#9CA3AF"
              />
              <Pressable
                style={styles.cityDropdownButton}
                onPress={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              >
                <Text style={styles.cityDropdownArrow}>
                  {isCityDropdownOpen === true ? '▲' : '▼'}
                </Text>
              </Pressable>
            </View>
            {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

            {/* City Dropdown */}
            {isCityDropdownOpen === true && (
              <View style={styles.cityDropdown} ref={cityDropdownRef}>
                <ScrollView style={styles.cityDropdownScroll} nestedScrollEnabled>
                  {filteredCities.length > 0 ? (
                    filteredCities.map((city) => (
                      <Pressable
                        key={city}
                        style={({ pressed }) => [
                          styles.cityDropdownItem,
                          pressed === true ? styles.cityDropdownItemPressed : null,
                          formData.city === city ? styles.cityDropdownItemSelected : null,
                        ]}
                        onPress={() => handleCitySelect(city)}
                      >
                        <Text style={styles.cityDropdownItemText}>📍 {city}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.cityDropdownEmpty}>
                      <Text style={styles.cityDropdownEmptyText}>Keine Städte gefunden</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.formCard}>
            <Text style={styles.label}>
              Beschreibung <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="Kurze Beschreibung deiner Liste"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={250}
            />
            <Text style={styles.charCount}>
              {formData.description.length}/250
            </Text>
          </View>

          {/* Cover Image */}
          <View style={styles.formCard}>
            <Text style={styles.label}>Titelbild</Text>
            {formData.coverImageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: formData.coverImageUri }}
                  style={styles.imagePreview}
                />
                <Pressable
                  style={styles.removeImageButton}
                  onPress={() => handleInputChange('coverImageUri', null)}
                >
                  <Text style={styles.removeImageButtonText}>×</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.imagePickerButton,
                  pressed === true ? styles.imagePickerButtonPressed : null,
                ]}
                onPress={handleCoverImagePick}
              >
                <Text style={styles.imagePickerIcon}>📸</Text>
                <Text style={styles.imagePickerText}>Bild auswählen</Text>
                <Text style={styles.imagePickerSubtext}>PNG, JPG bis 5MB</Text>
              </Pressable>
            )}
          </View>

          {/* Live Preview */}
          {formData.list_name && formData.city && (
            <View style={styles.formCard}>
              <Text style={styles.previewTitle}>Vorschau</Text>
              <View style={styles.previewCard}>
                {formData.coverImageUri ? (
                  <Image
                    source={{ uri: formData.coverImageUri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <LinearGradient
                    colors={['#F3F4F6', '#E5E7EB']}
                    style={styles.previewImagePlaceholder}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)']}
                  style={styles.previewOverlay}
                />
                <View style={styles.previewContent}>
                  <Text style={styles.previewName}>{formData.list_name}</Text>
                  <Text style={styles.previewCity}>📍 {formData.city}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              isFormValid() && !isSubmitting
                ? styles.submitButtonActive
                : styles.submitButtonDisabled,
              pressed === true ? styles.submitButtonPressed : null,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid() || isSubmitting === true}
          >
            <LinearGradient
              colors={isFormValid() && !isSubmitting ? ['#FF7E42', '#FFB25A'] : ['#E5E7EB', '#D1D5DB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>🍽️ Liste erstellen</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>

        {/* Toast Notification */}
        {toast && (
          <View style={styles.toastContainer}>
            <View
              style={[
                styles.toast,
                toast.type === 'success' ? styles.toastSuccess : styles.toastError,
              ]}
            >
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  backButtonText: {
    fontSize: 20,
    color: '#374151',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  optional: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputValid: {
    borderColor: '#10B981',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 8,
  },
  cityInputContainer: {
    position: 'relative',
  },
  cityDropdownButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  cityDropdownArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  cityDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cityDropdownScroll: {
    maxHeight: 200,
  },
  cityDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cityDropdownItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  cityDropdownItemSelected: {
    backgroundColor: 'rgba(255, 126, 66, 0.1)',
  },
  cityDropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  cityDropdownEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  cityDropdownEmptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  textArea: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageButton: {
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
  removeImageButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  imagePickerButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  imagePickerButtonPressed: {
    borderColor: '#FF7E42',
    backgroundColor: 'rgba(255, 126, 66, 0.1)',
  },
  imagePickerIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  imagePickerSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  previewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 192,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewImagePlaceholder: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  previewContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  previewName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  previewCity: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  submitButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitButtonActive: {
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  submitButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  toastContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: '#10B981',
  },
  toastError: {
    backgroundColor: '#EF4444',
  },
  toastText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})

export default CreateList

