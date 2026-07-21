import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useSaveStatus } from '../contexts/SaveStatusContext'
import { supabase } from '../services/supabase'
import { scrollFieldIntoView } from '../utils/keyboard'
import { useHeaderHeight, getContentPaddingTop } from '../hooks/useHeaderHeight'
import { getCategoryTerms } from '../utils/categoryTerms'
import { calculateTier } from '../lib/categories'
import { hapticFeedback } from '../utils/haptics'
import LocationPickerSheet from '../components/LocationPickerSheet'

// Category definitions with their specific criteria
const DEFAULT_SCALE = 5

const CATEGORIES = {
  Döner: {
    imageUrl: '/images/categories/doener.jpg', // Will be uploaded to public folder
    criteria: ['Brot', 'Fleisch', 'Soße', 'Frische', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Burger: {
    imageUrl: '/images/categories/burger.jpg',
    criteria: ['Bun', 'Patty', 'Toppings/Cheese', 'Soßen', 'Preis-Leistung'],
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
      'Semmel',
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
    criteria: ['Fleischqualität', 'Gargrad & Zubereitung', 'Beilagen & Saucen', 'Konsistenz', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  'Fast Food': {
    imageUrl: '/images/categories/fast-food.jpg',
    criteria: ['Pommes', 'Sauberkeit & Ordnung', 'Preis / Leistung', 'Burger', 'Chicken Nuggets / Beilagen'],
    scale: DEFAULT_SCALE
  },
  Streetfood: {
    imageUrl: '/images/categories/streetfood.jpg',
    criteria: ['Authentizität & Geschmack', 'Kreativität & Vielfalt', 'Frische & Qualität', 'Atmosphäre & Erlebnis', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Leberkässemmel: {
    imageUrl: '/images/categories/leberkaessemmel.jpg',
    criteria: ['Semmel', 'Soßen', 'Leberkäs-Sorte', 'Rand / Knusprigkeit', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  }
}

// Emoji icons for criteria
const CRITERIA_ICONS = {
  'Brot': '🍞',
  'Fleisch': '🥩',
  'Soße': '🥫',
  'Soßen': '🥫',
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
  'Konsistenz': '🧈',
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
  'Semmel': '🥯',
  'Leberkäs-Sorte': '🥩',
  'Rand / Knusprigkeit': '🥨',
  'Preis-Leistungs-Verhältnis': '💰',
  'Pommes': '🍟',
  'Preis / Leistung': '💰',
  'Burger': '🍔',
  'Chicken Nuggets / Beilagen': '🍗'
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
  const _preselectedTier = searchParams.get('tier') || null
  const spotId = searchParams.get('spotId') || null // For edit mode
  const isEditMode = !!spotId
  const { user } = useAuth()
  const { isDark } = useTheme()
  const { beginSave, resolveSave, failSave } = useSaveStatus()
  const navigate = useNavigate()

  const [list, setList] = useState(null)
  const [_existingSpot, setExistingSpot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [listCategory, setListCategory] = useState(null) // Category from list
  // Skip category selection in edit mode OR if list has a specific category
  const [showCategorySelection, setShowCategorySelection] = useState(!isEditMode)
  
  // Dynamische Header-Höhen-Messung (für beide Header-Varianten)
  const { headerRef: categoryHeaderRef, headerHeight: categoryHeaderHeight } = useHeaderHeight()
  const { headerRef: formHeaderRef, headerHeight: formHeaderHeight } = useHeaderHeight()
  
  // Aktive Header-Höhe basierend auf angezeigtem Header
  const _activeHeaderHeight = showCategorySelection ? categoryHeaderHeight : formHeaderHeight

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    ratings: {},
    notes: '',
    cover_photo_url: null,
    cover_photo_file: null
  })
  const [sharedRedirectChecked, setSharedRedirectChecked] = useState(false)

  const [errors, setErrors] = useState({})
  const handleFieldFocus = (event) => scrollFieldIntoView(event.currentTarget)

  // Track the active cover-image Object-URL so we can revoke the previous one
  // before allocating a new preview, and revoke on unmount.
  // handedOffPreviewRef: bei optimistischem Submit übernimmt der Hintergrund-Upload
  // die Blob-URL (sie wird noch in der TierList als Preview gezeigt). Dann darf
  // der Unmount-Cleanup sie NICHT revoken — sonst bricht das Bild sofort weg.
  const previewUrlRef = useRef(null)
  const handedOffPreviewRef = useRef(false)
  useEffect(() => () => {
    if (previewUrlRef.current && !handedOffPreviewRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
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
            country_code: spotData.country_code || null,
            admin_area: spotData.admin_area || null,
            city: spotData.city || null,
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

  const overallRating = calculateOverallRating()
  const autoTier = calculateTier(overallRating)

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
    const terms = getCategoryTerms(list?.category || listCategory)
    setShowDeleteConfirm(false)
    hapticFeedback.success()

    // Optimistic update: Navigate immediately
    showToast(`${terms.singular} wird gelöscht...`, 'success')
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
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const previewUrl = URL.createObjectURL(compressedFile)
    previewUrlRef.current = previewUrl

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

  // Submit — optimistischer, nicht-blockierender Ablauf:
  // 1. Sofort mit lokaler Bild-Preview in die TierList navigieren (kein Overlay).
  // 2. Bild-Upload + DB-Insert/Update laufen im Hintergrund.
  // 3. Die globale Save-Pille läuft über die Navigation hinweg weiter, bis der
  //    echte DB-Eintrag steht — dann Häkchen. Bei Fehler: Rollback + Fehler-Pille.
  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)

    const termSingular = getCategoryTerms(list?.category || listCategory).singular

    // Snapshot der Formularwerte (formData kann nach dem Unmount nicht mehr gelesen werden)
    const fileToUpload = formData.cover_photo_file
    const localPreview = formData.cover_photo_url // Blob (neu) oder echte URL (Edit ohne neues Bild)
    const isBlobPreview = typeof localPreview === 'string' && localPreview.startsWith('blob:')

    const ratingsData = formData.ratings && Object.keys(formData.ratings).length > 0
      ? formData.ratings
      : {}

    const payload = {
      name: formData.name.trim(),
      address: formData.address.trim() || null,
      latitude: formData.latitude || null,
      longitude: formData.longitude || null,
      country_code: formData.country_code || null,
      admin_area: formData.admin_area || null,
      city: formData.city || null,
      ratings: ratingsData,
      tier: autoTier,
      rating: overallRating,
      notes: formData.notes.trim() || null,
    }

    // Optimistischer Spot zeigt sofort die lokale Preview (Blob) bzw. bestehende URL.
    const tempSpotId = `temp-${crypto.randomUUID()}`
    const optimisticFoodspot = {
      id: tempSpotId,
      list_id: id,
      user_id: user.id,
      category: selectedCategory || listCategory,
      cover_photo_url: localPreview || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload,
    }

    sessionStorage.setItem('newFoodspot', JSON.stringify({
      listId: id,
      foodspot: optimisticFoodspot
    }))

    // Blob-Preview an den Hintergrund-Task übergeben, damit der Unmount sie nicht revoked.
    if (isBlobPreview) handedOffPreviewRef.current = true

    // Globale Save-Pille starten — läuft über die Navigation hinweg weiter.
    beginSave(tempSpotId, isEditMode ? 'Änderungen werden gespeichert…' : `${termSingular} wird hinzugefügt…`)

    // Sofort navigieren — kein blockierendes Overlay.
    navigate(`/tierlist/${id}`, { state: { scrollToTop: true } })

    // --- Hintergrund: Upload + DB-Schreibvorgang ---
    try {
      let imageUrl = isEditMode && !fileToUpload ? (localPreview || null) : null

      if (fileToUpload) {
        const fileExt = fileToUpload.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('list-covers')
          .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('list-covers').getPublicUrl(fileName)
        imageUrl = urlData?.publicUrl || null
      }

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('foodspots')
          .update({ ...payload, cover_photo_url: imageUrl || null, updated_at: new Date().toISOString() })
          .eq('id', spotId)
        if (updateError) throw updateError
        sessionStorage.removeItem('newFoodspot')
      } else {
        const { data: insertedFoodspot, error: insertError } = await supabase
          .from('foodspots')
          .insert({
            list_id: id,
            user_id: user.id,
            category: selectedCategory || listCategory,
            cover_photo_url: imageUrl || null,
            ...payload,
          })
          .select()
          .single()
        if (insertError) throw insertError
        if (insertedFoodspot) {
          sessionStorage.setItem('newFoodspot', JSON.stringify({ listId: id, foodspot: insertedFoodspot }))
        }
      }
      // Echter Eintrag steht → Pille quittiert mit Häkchen. Realtime synchronisiert.
      resolveSave(tempSpotId, isEditMode ? 'Gespeichert' : `${termSingular} hinzugefügt`)
    } catch (error) {
      console.error('Error saving foodspot:', error)
      // Rollback: optimistischen Eintrag entfernen + Fehler-Pille + Flag für TierList-Cleanup.
      sessionStorage.removeItem('newFoodspot')
      sessionStorage.setItem('foodspotSaveError', JSON.stringify({ listId: id }))
      failSave(tempSpotId, isEditMode
        ? 'Änderungen konnten nicht gespeichert werden'
        : `${termSingular} konnte nicht gespeichert werden`)
    } finally {
      // Übergebene Blob-Preview jetzt sicher freigeben (echte URL ist gesetzt).
      if (isBlobPreview && localPreview) URL.revokeObjectURL(localPreview)
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-white'
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
        isDark ? 'bg-gray-900' : 'bg-white'
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
      <div className={`h-full flex flex-col ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } relative overflow-hidden`}>
        {/* Header */}
        <header 
          ref={categoryHeaderRef}
          className={`header-safe border-b fixed top-0 left-0 right-0 z-20 shadow-sm backdrop-blur-xl ${
            isDark
              ? 'bg-gray-900/80 border-gray-800/50'
              : 'bg-white/80 border-gray-200/50'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2">
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
              Neuer {getCategoryTerms(list?.category || listCategory).singular}
            </h1>

            <div className="w-10" />
          </div>
        </header>

        {/* Category Selection */}
        <main 
          className="page-content px-4"
          style={{
            paddingTop: getContentPaddingTop(categoryHeaderHeight, 24),
            paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`
          }}
        >
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
                          'Streetfood': '🌯',
                          'Leberkässemmel': '🥪'
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
            <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{getCategoryTerms(list?.category || listCategory).singular} konnte nicht geladen werden</p>
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
        isDark ? 'bg-gray-900' : 'bg-white'
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
      isDark ? 'bg-gray-900' : 'bg-white'
    }`}>
      {/* Header */}
      <header
        ref={formHeaderRef}
        className={`header-safe border-b fixed top-0 left-0 right-0 z-20 shadow-sm backdrop-blur-xl ${
          isDark
            ? 'bg-gray-900/80 border-gray-800/50'
            : 'bg-white/80 border-gray-200/50'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2 gap-2">
          {/* Close (X) — left */}
          <button
            onClick={() => { hapticFeedback.light(); navigate(`/tierlist/${id}`) }}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all flex-shrink-0 ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            aria-label="Abbrechen"
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>

          {/* Title — center */}
          <h1 className={`text-lg font-bold flex-1 text-center px-2 truncate ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            {isEditMode
              ? getCategoryTerms(list?.category || listCategory).editAction
              : getCategoryTerms(list?.category || listCategory).createAction}
          </h1>

          {/* Trash + Check — right */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isEditMode && (
              <button
                onClick={() => { hapticFeedback.light(); setShowDeleteConfirm(true) }}
                disabled={isSubmitting}
                className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${
                  isDark ? 'hover:bg-red-900/30' : 'hover:bg-red-50'
                }`}
                aria-label="Löschen"
              >
                <svg className={`w-[22px] h-[22px] ${
                  isDark ? 'text-red-400' : 'text-red-500'
                }`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            )}

            <button
              onClick={() => { hapticFeedback.medium(); handleSubmit() }}
              disabled={isSubmitting}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
                  : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
                boxShadow: '0 2px 10px rgba(255,126,66,0.35)',
              }}
              aria-label={isEditMode ? 'Speichern' : 'Erstellen'}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main 
        className="page-content px-4"
        style={{
          paddingTop: getContentPaddingTop(formHeaderHeight, 24),
          paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`
        }}
      >
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
              className={`w-full px-4 py-3 text-base rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
              onFocus={handleFieldFocus}
            />
            {errors.name && <p className="mt-2 text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* Location */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-3 flex items-center gap-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <span className="text-lg">📍</span>
              {list?.list_mode === 'product' ? 'Ort' : 'Standort'}
              <span className={`font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
            </label>

            <button
              type="button"
              onClick={() => { hapticFeedback.light(); setShowLocationPicker(true) }}
              className={`w-full rounded-[14px] border-2 border-dashed transition-all active:scale-[0.98] overflow-hidden ${
                formData.latitude
                  ? isDark ? 'border-[#FF9357]/40 bg-[#FF9357]/10' : 'border-[#FF7E42]/40 bg-[#FF7E42]/05'
                  : isDark ? 'border-gray-600 hover:border-[#FF9357]/60' : 'border-gray-300 hover:border-[#FF7E42]/60'
              }`}
            >
              {formData.latitude ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #FF9357, #B85C2C)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs mb-0.5" style={{
                      color: isDark ? '#FF9357' : '#FF7E42',
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      Standort gesetzt
                    </div>
                    <div className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}
                      style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {formData.address || `${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFormData(prev => ({ ...prev, address: '', latitude: null, longitude: null }))
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke={isDark ? '#aaa' : '#666'} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M6 6l12 12M6 18L18 6"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke={isDark ? '#888' : '#999'} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Auf Karte suchen...
                  </span>
                </div>
              )}
            </button>

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
              className={`w-full px-4 py-3 text-base rounded-[14px] border transition-all focus:outline-none focus:ring-2 resize-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
              onFocus={handleFieldFocus}
            />
            <p className={`text-sm mt-2 text-right ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>{formData.notes.length}/500</p>
          </div>

        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl shadow-2xl max-w-md w-full p-6 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className={`text-2xl font-bold mb-3 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Spot löschen?
            </h2>
            <p className={`mb-6 ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Möchtest du diesen Spot wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { hapticFeedback.light(); setShowDeleteConfirm(false) }}
                className={`flex-1 py-3 rounded-[14px] border font-semibold transition-all ${
                  isDark
                    ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                className={`flex-1 py-3 rounded-[14px] text-white font-semibold shadow-lg transition-all ${
                  isDark
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Location Picker */}
      <LocationPickerSheet
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        returnsName
        initialCenter={
          formData.latitude != null
            ? { lat: formData.latitude, lng: formData.longitude }
            : (list?.latitude != null ? { lat: list.latitude, lng: list.longitude } : undefined)
        }
        onConfirm={({ address, latitude, longitude, name, countryCode, adminArea, city }) => {
          setFormData(prev => ({
            ...prev,
            address,
            latitude,
            longitude,
            country_code: countryCode || null,
            admin_area: adminArea || null,
            city: city || null,
            ...(name && !prev.name ? { name } : {}),
          }))
        }}
      />
    </div>
  )
}

export default AddFoodspot
