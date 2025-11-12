import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'

// Category definitions with their specific criteria
const DEFAULT_SCALE = 5

const CATEGORIES = {
  Döner: {
    imageUrl: '/images/categories/doener.jpg', // Will be uploaded to public folder
    criteria: ['Brot', 'Fleisch', 'Soße', 'Frische', 'Location'],
    scale: DEFAULT_SCALE
  },
  Burger: {
    imageUrl: '/images/categories/burger.jpg',
    criteria: ['Bun', 'Patty', 'Toppings/Cheese', 'Geschmack', 'Location'],
    scale: DEFAULT_SCALE
  },
  Pizza: {
    imageUrl: '/images/categories/pizza.jpg',
    criteria: ['Teig', 'Belag', 'Soße', 'Backen', 'Location'],
    scale: DEFAULT_SCALE
  },
  Asiatisch: {
    imageUrl: '/images/categories/asiatisch.jpg',
    criteria: ['Nudeln/Reis', 'Protein', 'Soße', 'Gemüse', 'Location'],
    scale: DEFAULT_SCALE
  },
  Bratwurst: {
    imageUrl: '/images/categories/bratwurst.jpg',
    criteria: [
      'Geschmack & Würze',
      'Bratgrad & Textur',
      'Beilage & Sauce',
      'Authentizität & Atmosphäre',
      'Preis-Leistungs-Verhältnis'
    ],
    scale: DEFAULT_SCALE
  },
  Glühwein: {
    imageUrl: '/images/categories/gluehwein.jpg',
    criteria: ['Geschmack', 'Temperatur', 'Gewürze', 'Alkoholgehalt', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Sushi: {
    imageUrl: '/images/categories/sushi.jpg',
    criteria: ['Fischqualität', 'Reis & Textur', 'Frische & Temperatur', 'Kreativität & Vielfalt', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  'Deutsche Küche': {
    imageUrl: '/images/categories/deutsche-kuche.jpg', // Will be uploaded to public folder
    criteria: ['Soße & Braten', 'Beilagen', 'Würzung & Authentizität', 'Frische & Regionalität', 'Portion & Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Bier: {
    imageUrl: '/images/categories/bier.jpg', // Will be uploaded to public folder
    criteria: ['Geschmack & Ausgewogenheit', 'Aroma & Geruch', 'Frische & Temperatur', 'Schaumqualität & Kohlensäure', 'Sortencharakter & Authentizität'],
    scale: DEFAULT_SCALE
  },
  Steak: {
    imageUrl: '/images/categories/steak.jpg',
    criteria: ['Fleischqualität', 'Gargrad & Zubereitung', 'Beilagen & Saucen', 'Ambiente & Service', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  'Fast Food': {
    imageUrl: '/images/categories/fast-food.jpg',
    criteria: ['Geschmack & Frische', 'Schnelligkeit & Service', 'Sauberkeit & Ordnung', 'Preis-Leistung', 'Markenerlebnis'],
    scale: DEFAULT_SCALE
  },
  Streetfood: {
    imageUrl: '/images/categories/streetfood.jpg',
    criteria: ['Authentizität & Geschmack', 'Kreativität & Vielfalt', 'Frische & Qualität', 'Atmosphäre & Erlebnis', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  }
}

// Emoji icons for criteria
const CRITERIA_ICONS = {
  'Brot': '🍞',
  'Fleisch': '🥩',
  'Soße': '🥫',
  'Frische': '🥗',
  'Location': '📍',
  'Bun': '🍞',
  'Patty': '🥩',
  'Toppings/Cheese': '🧀',
  'Geschmack': '😋',
  'Teig': '🍞',
  'Belag': '🍕',
  'Backen': '🔥',
  'Nudeln/Reis': '🍜',
  'Protein': '🥩',
  'Gemüse': '🥗',
  'Tortilla': '🌯',
  'Füllung': '🥙',
  'Soße/Schärfe': '🌶️',
  'Temperatur': '🌡️',
  'Gewürze': '🧂',
  'Alkoholgehalt': '🍷',
  'Preis-Leistung': '💰',
  'Soße & Braten': '🥘',
  'Beilagen': '🥔',
  'Würzung & Authentizität': '🌿',
  'Frische & Regionalität': '🌱',
  'Portion & Preis-Leistung': '💰',
  'Geschmack & Ausgewogenheit': '😋',
  'Aroma & Geruch': '👃',
  'Frische & Temperatur': '❄️',
  'Schaumqualität & Kohlensäure': '🫧',
  'Sortencharakter & Authentizität': '🏆',
  'Fischqualität': '🐟',
  'Reis & Textur': '🍚',
  'Kreativität & Vielfalt': '🎨',
  'Fleischqualität': '🥩',
  'Gargrad & Zubereitung': '🔥',
  'Beilagen & Saucen': '🥄',
  'Ambiente & Service': '🛎️',
  'Geschmack & Frische': '😋',
  'Schnelligkeit & Service': '⚡',
  'Sauberkeit & Ordnung': '🧼',
  'Markenerlebnis': '✨',
  'Authentizität & Geschmack': '🧭',
  'Frische & Qualität': '🥗',
  'Atmosphäre & Erlebnis': '🎉',
  'Geschmack & Würze': '🌭',
  'Bratgrad & Textur': '🔥',
  'Beilage & Sauce': '🥖',
  'Authentizität & Atmosphäre': '🎪',
  'Preis-Leistungs-Verhältnis': '💰'
}

const getCategoryScale = (category) => CATEGORIES[category]?.scale || DEFAULT_SCALE

// Helper function to compress image
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            }))
          },
          'image/jpeg',
          0.8
        )
      }
    }
  })
}

function AddFoodspot() {
  const { id } = useParams() // list_id
  const [searchParams] = useSearchParams()
  const preselectedTier = searchParams.get('tier') || null
  const spotId = searchParams.get('spotId') || null // For edit mode
  const isEditMode = !!spotId
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [list, setList] = useState(null)
  const [existingSpot, setExistingSpot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [listCategory, setListCategory] = useState(null) // Category from list
  // Skip category selection in edit mode OR if list has a specific category
  const [showCategorySelection, setShowCategorySelection] = useState(!isEditMode)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const autocompleteService = useRef(null)
  const geocoder = useRef(null)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: null,
    longitude: null,
    ratings: {},
    notes: '',
    cover_photo_url: null,
    cover_photo_file: null
  })
  const [sharedRedirectChecked, setSharedRedirectChecked] = useState(false)

  const [errors, setErrors] = useState({})

  // Initialize Google Maps services
  useEffect(() => {
    if (window.google?.maps) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      geocoder.current = new window.google.maps.Geocoder()
    }
  }, [])

  // Shared list detection – redirect to shared component
  useEffect(() => {
    if (!user || !id || sharedRedirectChecked) return

    const checkSharedContext = async () => {
      const targetRoute = spotId
        ? `/shared/add-foodspot/${id}?spotId=${spotId}`
        : `/shared/add-foodspot/${id}`

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
        console.error('Error checking shared list context:', error)
      }

      setSharedRedirectChecked(true)
    }

    checkSharedContext()
  }, [user, id, spotId, navigate, sharedRedirectChecked])

  // Fetch list and existing spot (if edit mode)
  useEffect(() => {
    if (!sharedRedirectChecked) return

    const fetchData = async () => {
      if (!user || !id) return
      
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
        
        // Set list category if it exists
        if (listData.category) {
          setListCategory(listData.category)
          // If list has a category, auto-select it and skip category selection
          if (!isEditMode) {
            setSelectedCategory(listData.category)
            setShowCategorySelection(false)
          }
        }

        // If edit mode, fetch existing foodspot
        if (isEditMode) {
          const { data: spotData, error: spotError } = await supabase
            .from('foodspots')
            .select('*')
            .eq('id', spotId)
            .eq('list_id', id)
            .single()

          if (spotError) {
            console.error('Error fetching foodspot:', spotError)
            throw spotError
          }

          console.log('Fetched foodspot data:', spotData) // Debug
          setExistingSpot(spotData)

          // Pre-fill form with existing data
          // Handle ratings - could be JSON string or object
          let ratings = {}
          if (spotData.ratings) {
            if (typeof spotData.ratings === 'string') {
              try {
                ratings = JSON.parse(spotData.ratings)
              } catch (e) {
                console.error('Error parsing ratings JSON:', e)
                ratings = {}
              }
            } else {
              ratings = spotData.ratings
            }
          }

          setSelectedCategory(spotData.category || null)
          setShowCategorySelection(false)
          setFormData({
            name: spotData.name || '',
            address: spotData.address || '',
            latitude: spotData.latitude || null,
            longitude: spotData.longitude || null,
            ratings: ratings,
            notes: spotData.notes || '',
            cover_photo_url: spotData.cover_photo_url || null,
            cover_photo_file: null
          })
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, spotId, isEditMode, user, navigate, sharedRedirectChecked])

  // Handle category selection
  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
    setShowCategorySelection(false)
    
    // Initialize ratings for this category
    const initialRatings = {}
    CATEGORIES[category].criteria.forEach(criterion => {
      initialRatings[criterion] = 0
    })
    setFormData(prev => ({ ...prev, ratings: initialRatings }))
  }

  // Calculate overall rating (1-5 stars → 0-10 scale)
  const calculateOverallRating = () => {
    const activeCategory = selectedCategory || listCategory
    if (!activeCategory) return 0

    const ratings = Object.values(formData.ratings)
    const filledRatings = ratings.filter(r => r > 0)

    if (filledRatings.length === 0) return 0

    const sum = filledRatings.reduce((acc, r) => acc + r, 0)
    const average = sum / filledRatings.length
    const scale = getCategoryScale(activeCategory)
    if (scale <= 0) return 0
    // Convert average to 0-10 scale
    const normalized = (average / scale) * 10
    return Math.round(normalized * 10) / 10
  }

  // Auto-tier based on score
  const calculateTier = (overallRating) => {
    if (overallRating >= 9.0) return 'S'
    if (overallRating >= 8.0) return 'A'
    if (overallRating >= 6.5) return 'B'
    if (overallRating >= 5.0) return 'C'
    return 'D'
  }

  const overallRating = calculateOverallRating()
  const autoTier = calculateTier(overallRating)

  // Google Maps location search
  const handleLocationSearch = (query) => {
    setLocationQuery(query)
    
    if (!query || query.length < 3 || !autocompleteService.current) {
      setLocationSuggestions([])
      return
    }

    autocompleteService.current.getPlacePredictions(
      {
        input: query,
        types: ['establishment', 'geocode']
      },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setLocationSuggestions(predictions)
        } else {
          setLocationSuggestions([])
        }
      }
    )
  }

  // Select location from suggestions
  const handleLocationSelect = (place) => {
    if (!geocoder.current) return

    geocoder.current.geocode({ placeId: place.place_id }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location
        setFormData(prev => ({
          ...prev,
          address: place.description,
          latitude: location.lat(),
          longitude: location.lng()
        }))
        setLocationQuery(place.description)
        setLocationSuggestions([])
        
        // Clear location error
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.location
          return newErrors
        })
      }
    })
  }

  // Get current position
  const handleCurrentPosition = () => {
    if (!navigator.geolocation) {
      alert('Geolocation wird von deinem Browser nicht unterstützt')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        
        if (geocoder.current) {
          geocoder.current.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results, status) => {
              if (status === 'OK' && results[0]) {
                const address = results[0].formatted_address
                setFormData(prev => ({
                  ...prev,
                  address: address,
                  latitude: latitude,
                  longitude: longitude
                }))
                setLocationQuery(address)
              }
            }
          )
        }
      },
      (error) => {
        alert('Fehler beim Abrufen des Standorts: ' + error.message)
      }
    )
  }

  // Validation
  const validateForm = () => {
    const newErrors = {}

    if (!selectedCategory && !listCategory) {
      newErrors.category = 'Bitte wähle eine Kategorie'
    }
    
    // If list has a category, ensure foodspot matches it
    if (listCategory && selectedCategory && selectedCategory !== listCategory && selectedCategory !== 'Eigene Kategorie') {
      newErrors.category = `Diese Liste ist auf "${listCategory}" beschränkt`
    }

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Name muss mindestens 2 Zeichen haben'
    }

    // Location ist jetzt optional
    // Google Maps API kommt später

    const filledRatings = Object.values(formData.ratings).filter(r => r > 0)
    if (filledRatings.length < 3) {
      newErrors.ratings = 'Bitte bewerte mindestens 3 Kriterien'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle delete
  const handleDelete = async () => {
    if (!window.confirm('Möchtest du diesen Foodspot wirklich löschen?')) {
      return
    }

    // Optimistic update: Navigate immediately
    showToast('Foodspot wird gelöscht...', 'success')
    navigate(`/tierlist/${id}`)

    // Delete in background (non-blocking)
    try {
      const { error } = await supabase
        .from('foodspots')
        .delete()
        .eq('id', spotId)

      if (error) throw error

      // Real-time subscription will sync automatically
    } catch (error) {
      console.error('Error deleting foodspot:', error)
      // Show error toast (user is already on tierlist page)
      // The real-time subscription will handle rollback if needed
    }
  }

  // Handle image upload
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'Bitte wähle ein Bild aus' }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Bild muss kleiner als 5MB sein' }))
      return
    }

    // Compress the image
    const compressedFile = await compressImage(file)
    const previewUrl = URL.createObjectURL(compressedFile)
    
    setFormData(prev => ({
      ...prev,
      cover_photo_url: previewUrl,
      cover_photo_file: compressedFile
    }))
  }

  // Show toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Submit
  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)

    try {
      let imageUrl = null

      // Upload image if provided
      if (formData.cover_photo_file) {
        const fileExt = formData.cover_photo_file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('list-covers')
          .upload(fileName, formData.cover_photo_file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('list-covers')
          .getPublicUrl(fileName)

        if (urlData?.publicUrl) {
          imageUrl = urlData.publicUrl
        }
      } else if (isEditMode && formData.cover_photo_url) {
        // Keep existing image if no new one uploaded
        imageUrl = formData.cover_photo_url
      }

      // Ensure ratings is always a valid JSON object
      const ratingsData = formData.ratings && Object.keys(formData.ratings).length > 0 
        ? formData.ratings 
        : {}

      // Optimistic update: Create temporary foodspot for immediate display
      const tempSpotId = `temp-${Date.now()}`
      const optimisticFoodspot = {
        id: tempSpotId,
        list_id: id,
        user_id: user.id,
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        category: selectedCategory || listCategory,
        ratings: ratingsData,
        tier: autoTier,
        rating: overallRating,
        notes: formData.notes.trim() || null,
        cover_photo_url: imageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Store optimistic foodspot in sessionStorage for TierList to pick up
      sessionStorage.setItem('newFoodspot', JSON.stringify({
        listId: id,
        foodspot: optimisticFoodspot
      }))

      // Navigate immediately (optimistic) - no loading screen
      setIsSubmitting(false)
      navigate(`/tierlist/${id}`)
      
      // Update/Insert in background (non-blocking)
      if (isEditMode) {
        // Update existing foodspot
        const { error: updateError } = await supabase
          .from('foodspots')
          .update({
            name: formData.name.trim(),
            address: formData.address.trim() || null,
            latitude: formData.latitude || null,
            longitude: formData.longitude || null,
            ratings: ratingsData,
            tier: autoTier,
            rating: overallRating,
            notes: formData.notes.trim() || null,
            cover_photo_url: imageUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', spotId)

        if (updateError) {
          console.error('Update error details:', updateError)
          sessionStorage.removeItem('newFoodspot')
        } else {
          // Clear on success - real-time will sync
          sessionStorage.removeItem('newFoodspot')
        }
      } else {
        // Insert new foodspot
        const { data: insertedFoodspot, error: insertError } = await supabase
          .from('foodspots')
          .insert({
            list_id: id,
            user_id: user.id,
            name: formData.name.trim(),
            address: formData.address.trim() || null,
            latitude: formData.latitude || null,
            longitude: formData.longitude || null,
            category: selectedCategory || listCategory,
            ratings: ratingsData,
            tier: autoTier,
            rating: overallRating,
            notes: formData.notes.trim() || null,
            cover_photo_url: imageUrl || null
          })
          .select()
          .single()

        if (insertError) {
          console.error('Insert error details:', insertError)
          sessionStorage.removeItem('newFoodspot')
        } else if (insertedFoodspot) {
          // Update sessionStorage with real foodspot
          sessionStorage.setItem('newFoodspot', JSON.stringify({
            listId: id,
            foodspot: insertedFoodspot
          }))
        }
      }
      
      // Real-time subscription will sync automatically
    } catch (error) {
      console.error('Error adding foodspot:', error)
      showToast('Fehler beim Hinzufügen. Bitte versuche es erneut.', 'error')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt...</p>
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

  // Category Selection Screen - only show if NOT in edit mode, category not selected, AND list doesn't have a category
  if ((showCategorySelection || !selectedCategory) && !isEditMode && !listCategory) {
    return (
      <div className={`min-h-screen flex flex-col ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        {/* Header */}
        <header className={`border-b sticky top-0 z-20 ${
          isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(`/tierlist/${id}`)}
              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className={`text-lg font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Neuer Foodspot
            </h1>

            <div className="w-10" />
          </div>
        </header>

        {/* Category Selection */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            <div className={`rounded-[24px] shadow-lg border p-8 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">📝</span>
                <h2 className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Kategorie wählen:
                </h2>
              </div>

              <div className="space-y-3">
                {Object.entries(CATEGORIES).map(([category, { imageUrl }]) => (
                  <button
                    key={category}
                    onClick={() => handleCategorySelect(category)}
                    className={`w-full border-2 rounded-[20px] p-6 transition-all active:scale-[0.98] flex items-center gap-4 group ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-[#FF9357]'
                        : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-[#FF7E42]'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden transition-colors relative ${
                      isDark
                        ? 'bg-gray-600 group-hover:bg-[#B85C2C]/30'
                        : 'bg-gray-100 group-hover:bg-[#FFE4C3]/50'
                    }`}>
                      <img 
                        src={imageUrl} 
                        alt={category}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to emoji if image fails to load
                          const fallbackEmojis = {
                            'Döner': '🥙',
                            'Burger': '🍔',
                            'Pizza': '🍕',
                            'Asiatisch': '🍜',
                            'Bratwurst': '🥓',
                            'Glühwein': '🍷',
                            'Sushi': '🍣',
                            'Deutsche Küche': '🥨',
                            'Bier': '🍺',
                            'Steak': '🥩',
                            'Fast Food': '🍔',
                            'Streetfood': '🌯'
                          }
                          e.target.style.display = 'none'
                          const emoji = fallbackEmojis[category] || '🍔'
                          e.target.parentElement.innerHTML = `<span class="text-4xl">${emoji}</span>`
                        }}
                      />
                    </div>
                    <span className={`text-lg font-semibold transition-colors ${
                      isDark
                        ? 'text-white group-hover:text-[#FF9357]'
                        : 'text-gray-900 group-hover:text-[#FF7E42]'
                    }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {category}
                    </span>
                  </button>
                ))}

                <button
                  onClick={() => handleCategorySelect('Eigene Kategorie')}
                  className={`w-full border-2 border-dashed rounded-[20px] p-6 transition-all active:scale-[0.98] flex items-center gap-4 group ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-[#FF9357]'
                      : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-[#FF7E42]'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl transition-colors ${
                    isDark
                      ? 'bg-gray-600 group-hover:bg-[#B85C2C]/30'
                      : 'bg-gray-100 group-hover:bg-[#FFE4C3]/50'
                  }`}>
                    ➕
                  </div>
                  <span className={`text-lg font-semibold transition-colors ${
                    isDark
                      ? 'text-gray-400 group-hover:text-[#FF9357]'
                      : 'text-gray-500 group-hover:text-[#FF7E42]'
                  }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Eigene Kategorie
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Safety check: if no category selected and list has no category, show error or loading
  if (!selectedCategory && !listCategory) {
    if (isEditMode) {
      // In edit mode, if category not loaded, navigate back
      return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${
          isDark ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
          <div className="text-center">
            <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Foodspot konnte nicht geladen werden</p>
            <button
              onClick={() => navigate(`/tierlist/${id}`)}
              className={`px-6 py-3 text-white rounded-[14px] font-semibold ${
                isDark
                  ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                  : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
              }`}
            >
              Zurück zur Liste
            </button>
          </div>
        </div>
      )
    }
    // Should not happen, but fallback
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt...</p>
        </div>
      </div>
    )
  }

  // Main Form
  return (
    <div className={`min-h-screen flex flex-col ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-3xl p-8 text-center shadow-2xl max-w-sm mx-4 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className={`absolute inset-0 border-4 rounded-full ${
                isDark ? 'border-[#FF9357]/20' : 'border-[#FF7E42]/20'
              }`}></div>
              <div className={`absolute inset-0 border-4 border-t-transparent rounded-full animate-spin ${
                isDark ? 'border-[#FF9357]' : 'border-[#FF7E42]'
              }`}></div>
            </div>
            <h3 className={`text-xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              {isEditMode ? 'Wird gespeichert...' : 'Foodspot wird hinzugefügt...'}
            </h3>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`border-b sticky top-0 z-20 ${
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(`/tierlist/${id}`)}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className={`text-lg font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            {isEditMode ? 'Foodspot bearbeiten' : 'Foodspot erstellen'}
          </h1>

          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Name */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <span className="text-lg">📝</span>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="z. B. BLN Döner"
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
            />
            {errors.name && <p className="mt-2 text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* Location */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <span className="text-lg">📍</span>
              Standort <span className={`font-normal ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>(Optional - Google Maps kommt später)</span>
            </label>
            
            <div className="relative">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => handleLocationSearch(e.target.value)}
                placeholder="Suchen oder aktuelle Position verwenden..."
                className={`w-full px-4 py-3 pr-12 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
                }`}
              />
              
              <button
                onClick={handleCurrentPosition}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="Aktuelle Position"
              >
                <svg className={`w-5 h-5 ${isDark ? 'text-[#FF9357]' : 'text-[#FF7E42]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Location Suggestions */}
              {locationSuggestions.length > 0 && (
                <div className={`absolute z-50 w-full mt-2 rounded-[14px] shadow-xl border max-h-64 overflow-y-auto ${
                  isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-200'
                }`}>
                  {locationSuggestions.map((place) => (
                    <button
                      key={place.place_id}
                      onClick={() => handleLocationSelect(place)}
                      className={`w-full px-4 py-3 text-left transition-colors text-sm flex items-center gap-2 ${
                        isDark
                          ? 'hover:bg-gray-700 active:bg-gray-600 text-gray-200'
                          : 'hover:bg-gray-50 active:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <svg className={`w-4 h-4 flex-shrink-0 ${
                        isDark ? 'text-gray-400' : 'text-gray-400'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{place.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {formData.address && (
              <div className={`mt-3 p-3 border rounded-lg flex items-start gap-2 ${
                isDark
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-green-50 border-green-200'
              }`}>
                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isDark ? 'text-green-400' : 'text-green-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    isDark ? 'text-green-300' : 'text-green-900'
                  }`}>Standort ausgewählt:</p>
                  <p className={`text-sm mt-0.5 ${
                    isDark ? 'text-green-400' : 'text-green-700'
                  }`}>{formData.address}</p>
                </div>
              </div>
            )}

            {errors.location && <p className="mt-2 text-sm text-red-500">{errors.location}</p>}
          </div>

          {/* Photo Upload */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <span className="text-lg">📷</span>
              Foto <span className={`font-normal ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>(Optional)</span>
            </label>
            {formData.cover_photo_url ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={formData.cover_photo_url} alt="Preview" className="w-full h-64 object-cover" />
                <button
                  onClick={() => setFormData(prev => ({ ...prev, cover_photo_url: null, cover_photo_file: null }))}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDark
                    ? 'border-gray-600 hover:border-[#FF9357] hover:bg-[#B85C2C]/20'
                    : 'border-gray-300 hover:border-[#FF7E42] hover:bg-[#FFE4C3]/30'
                }`}>
                  <div className={`text-4xl mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>+ Foto hochladen</div>
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>PNG, JPG bis 5MB</p>
                </div>
              </label>
            )}
            {errors.image && <p className="mt-2 text-sm text-red-500">{errors.image}</p>}
          </div>

          {/* Criteria Rating */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <label className={`block text-sm font-semibold ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                📊 BEWERTUNG
              </label>
              <span className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {(() => {
                  const scale = getCategoryScale(selectedCategory)
                  return scale === 5 ? '1 - 5 Sterne' : `1 - ${scale} Punkte`
                })()}
              </span>
            </div>
            
            <div className="space-y-5">
              {CATEGORIES[selectedCategory].criteria.map((criterion) => {
                const ratingScale = getCategoryScale(selectedCategory)
                const ratingValues = Array.from({ length: ratingScale }, (_, index) => index + 1)
                return (
                <div key={criterion} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Label - feste Breite für Ausrichtung */}
                  <div className={`flex items-center gap-2 sm:w-40 sm:flex-shrink-0 ${
                    isDark ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    <span className="text-lg">{CRITERIA_ICONS[criterion]}</span>
                    <span className="text-sm font-medium">{criterion}</span>
                  </div>
                  
                  {/* Buttons - flex-grow für gleichmäßige Verteilung */}
                  <div 
                    className="grid gap-2 flex-1"
                    style={{ 
                      gridTemplateColumns: `repeat(${ratingScale <= 5 ? ratingScale : 5}, 1fr)`,
                      maxWidth: ratingScale <= 5 ? '280px' : '100%'
                    }}
                  >
                    {ratingValues.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          ratings: { ...prev.ratings, [criterion]: value }
                        }))}
                        className={`
                          aspect-square rounded-xl font-bold text-base
                          transition-all duration-200 ease-out
                          ${(formData.ratings[criterion] || 0) >= value
                            ? `text-white shadow-lg transform scale-105 ${
                                isDark
                                  ? 'bg-[#FF9357]'
                                  : 'bg-[#FF7E42]'
                              }`
                            : isDark
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:scale-95'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
                          }
                        `}
                        style={{
                          minWidth: '44px',
                          minHeight: '44px'
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                )
              })}
            </div>
            {errors.ratings && <p className="mt-3 text-sm text-red-500">{errors.ratings}</p>}
          </div>

          {/* Overall Rating & Tier */}
          <div className={`rounded-[20px] shadow-lg p-6 text-white ${
            isDark
              ? 'bg-gradient-to-br from-[#FF9357] to-[#B85C2C]'
              : 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-1">⭐ Gesamt:</p>
                <p className="text-4xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {overallRating.toFixed(1)}/10
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90 mb-1">🏆 Auto-Tier:</p>
                <p className="text-6xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {autoTier}
                </p>
              </div>
            </div>
          </div>

          {/* Comment */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <span className="text-lg">💬</span>
              Kommentar <span className={`font-normal ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Was macht diesen Spot besonders?"
              rows="4"
              maxLength="500"
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 resize-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
            />
            <p className={`text-sm mt-2 text-right ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>{formData.notes.length}/500</p>
          </div>

          {/* Submit/Edit Buttons */}
          {isEditMode ? (
            <div className="flex gap-3">
              {/* Delete Button - Left */}
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className={`flex-1 py-4 rounded-[20px] font-semibold text-lg text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${
                  isDark
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                🗑️ Löschen
              </button>

              {/* Save Button - Right */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-4 rounded-[20px] font-semibold text-lg text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${
                  isDark
                    ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                    : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                💾 Speichern
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-[20px] font-semibold text-lg text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${
                isDark
                  ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                  : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              💾 Foodspot speichern
            </button>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          style={{ animation: 'fadeSlideDown 0.3s ease-out' }}
        >
          <div className={`rounded-[16px] px-6 py-4 shadow-xl flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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

      {/* CSS */}
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

export default AddFoodspot
