import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import { scrollFieldIntoView } from '../../utils/keyboard'
import {
  uploadSharedSpotPhoto,
  deleteSharedSpotPhoto,
  SUPPORTED_IMAGE_TYPES,
  MAX_SPOT_PHOTOS
} from '../../services/sharedPhotos'

const DEFAULT_SCALE = 5

const CATEGORIES = {
  Döner: {
    imageUrl: '/images/categories/doener.jpg',
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
    imageUrl: '/images/categories/deutsche-kuche.jpg',
    criteria: ['Soße & Braten', 'Beilagen', 'Würzung & Authentizität', 'Frische & Regionalität', 'Portion & Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Bier: {
    imageUrl: '/images/categories/bier.jpg',
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

function AddSharedFoodspot() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const spotId = searchParams.get('spotId')
  const isEditMode = !!spotId
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [list, setList] = useState(null)
  const [existingSpot, setExistingSpot] = useState(null)
  const [existingRating, setExistingRating] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [userRole, setUserRole] = useState('viewer')
  const [canEdit, setCanEdit] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [listCategory, setListCategory] = useState(null)
  const [showCategorySelection, setShowCategorySelection] = useState(!isEditMode)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    ratings: {}
  })
  const [sharedDescription, setSharedDescription] = useState('')
  const [ratingComment, setRatingComment] = useState('')
  const [errors, setErrors] = useState({})
  const [photoEntries, setPhotoEntries] = useState([])
  const [coverPhotoEntryId, setCoverPhotoEntryId] = useState(null)
  const photoInputRef = useRef(null)
  const photoEntriesRef = useRef([])
  const handleFieldFocus = (event) => scrollFieldIntoView(event.currentTarget)


  useEffect(() => {
    if (!user || !id) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: listData, error: listError } = await supabase
          .from('lists')
          .select('*')
          .eq('id', id)
          .single()

        if (listError) throw listError

        setList(listData)
        setListCategory(listData.category || null)

        let role = 'viewer'
        if (listData.user_id === user.id) {
          role = 'owner'
        } else {
          const { data: membership, error: membershipError } = await supabase
            .from('list_members')
            .select('role')
            .eq('list_id', id)
            .eq('user_id', user.id)
            .single()

          if (membershipError && membershipError.code !== 'PGRST116') {
            throw membershipError
          }

          if (membership?.role) {
            role = membership.role
          }
        }

        setUserRole(role)
        setCanEdit(role === 'owner' || role === 'editor')

        if (listData.category) {
          setSelectedCategory(listData.category)
          setShowCategorySelection(false)
        }

        if (isEditMode) {
          const { data: spotData, error: spotError } = await supabase
            .from('foodspots')
            .select('*')
            .eq('id', spotId)
            .eq('list_id', id)
            .single()

          if (spotError) throw spotError

          setExistingSpot(spotData)
          setSharedDescription(spotData.description || '')
          setSelectedCategory(spotData.category || listData.category || null)
          setShowCategorySelection(false)
          setFormData(prev => ({
            ...prev,
            name: spotData.name || '',
            address: spotData.address || '',
            ratings: {}
          }))

          const { data: ratingData, error: ratingError } = await supabase
            .from('foodspot_ratings')
            .select('score, criteria, comment')
            .eq('foodspot_id', spotId)
            .eq('user_id', user.id)
            .single()

          if (ratingError && ratingError.code !== 'PGRST116') {
            throw ratingError
          }

          if (ratingData) {
            setExistingRating(ratingData)
            setFormData(prev => ({
              ...prev,
              ratings: ratingData.criteria || {}
            }))
            setRatingComment(ratingData.comment || '')
          } else if (spotData.category && CATEGORIES[spotData.category]) {
            const initialRatings = {}
            CATEGORIES[spotData.category].criteria.forEach(criterion => {
              initialRatings[criterion] = 0
            })
            setFormData(prev => ({ ...prev, ratings: initialRatings }))
          }
        } else if (listData.category && CATEGORIES[listData.category]) {
          const initialRatings = {}
          CATEGORIES[listData.category].criteria.forEach(criterion => {
            initialRatings[criterion] = 0
          })
          setFormData(prev => ({ ...prev, ratings: initialRatings }))
        }
      } catch (error) {
        console.error('Error loading shared list data:', error)
        showToast('Liste konnte nicht geladen werden', 'error')
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, id, isEditMode, spotId, navigate])

  useEffect(() => {
    photoEntriesRef.current = photoEntries
  }, [photoEntries])

  useEffect(() => {
    return () => {
      photoEntriesRef.current.forEach(entry => {
        if (entry?.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl)
        }
      })
    }
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const calculateOverallRating = () => {
    const activeCategory = selectedCategory || listCategory
    if (!activeCategory) return 0
    const ratings = Object.values(formData.ratings || {})
    const filledRatings = ratings.filter(r => r > 0)
    if (filledRatings.length === 0) return 0
    const sum = filledRatings.reduce((acc, r) => acc + r, 0)
    const average = sum / filledRatings.length
    const scale = getCategoryScale(activeCategory)
    if (scale <= 0) return 0
    const normalized = (average / scale) * 10
    return Math.round(normalized * 10) / 10
  }

  const calculateTier = (overallRating) => {
    if (overallRating >= 9.0) return 'S'
    if (overallRating >= 8.0) return 'A'
    if (overallRating >= 6.5) return 'B'
    if (overallRating >= 5.0) return 'C'
    return 'D'
  }

  const overallRating = calculateOverallRating()
  const autoTier = calculateTier(overallRating)

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Name muss mindestens 2 Zeichen haben'
    }

    const filledRatings = Object.values(formData.ratings || {}).filter(r => r > 0)
    if (filledRatings.length < 3) {
      newErrors.ratings = 'Bitte bewerte mindestens 3 Kriterien'
    }

    if (!selectedCategory) {
      newErrors.category = 'Bitte wähle eine Kategorie'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }


  const handleDelete = async () => {
    if (!spotId || !canEdit) {
      showToast('Keine Berechtigung für diese Aktion', 'error')
      return
    }
    if (!window.confirm('Möchtest du diesen Foodspot wirklich löschen?')) {
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('foodspots')
        .delete()
        .eq('id', spotId)

      if (error) throw error

      showToast('Foodspot gelöscht', 'success')
      navigate(`/shared/tierlist/${id}`)
    } catch (error) {
      console.error('Error deleting shared foodspot:', error)
      showToast(error?.message || 'Foodspot konnte nicht gelöscht werden.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }


  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
    setShowCategorySelection(false)

    const initialRatings = {}
    CATEGORIES[category].criteria.forEach(criterion => {
      initialRatings[criterion] = 0
    })
    setFormData(prev => ({ ...prev, ratings: initialRatings }))
  }

  const releasePreviewUrl = (entry) => {
    if (entry?.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl)
    }
  }

  const handlePhotoSelection = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const normalized = files.map(file => ({
      file,
      type: (file.type || '').toLowerCase()
    }))

    const allowed = normalized.filter(item => SUPPORTED_IMAGE_TYPES.includes(item.type))
    const rejectedCount = normalized.length - allowed.length

    if (rejectedCount > 0) {
      showToast('Nur JPG, PNG oder HEIC-Dateien sind erlaubt.', 'error')
    }

    if (!allowed.length) return

    const availableSlots = MAX_SPOT_PHOTOS - photoEntries.length
    if (availableSlots <= 0) {
      showToast(`Maximum von ${MAX_SPOT_PHOTOS} Fotos erreicht.`, 'info')
      return
    }

    const trimmed = allowed.slice(0, availableSlots)
    if (allowed.length > availableSlots) {
      showToast('Limit erreicht – zusätzliche Dateien wurden ignoriert.', 'info')
    }

    const newEntries = trimmed.map(({ file }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      return {
        id,
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
        error: null
      }
    })

    setPhotoEntries(prev => {
      const next = [...prev, ...newEntries]
      setCoverPhotoEntryId(currentCover => currentCover || (next[0]?.id ?? null))
      return next
    })
    setErrors(prev => ({ ...prev, image: undefined }))
  }

  const handleRemovePhotoEntry = (entryId) => {
    setPhotoEntries(prev => {
      const entry = prev.find(item => item.id === entryId)
      if (entry) {
        releasePreviewUrl(entry)
      }
      const filtered = prev.filter(item => item.id !== entryId)
      setCoverPhotoEntryId(currentCover => (currentCover === entryId ? (filtered[0]?.id || null) : currentCover))
      return filtered
    })
  }

  const handleMarkCoverPhoto = (entryId) => {
    setCoverPhotoEntryId(entryId)
  }

  const handleSubmit = async () => {
    if (!canEdit) {
      showToast('Keine Berechtigung für diese Liste', 'error')
      return
    }

    if (!validateForm()) return

    setIsSubmitting(true)
    setErrors(prev => ({ ...prev, image: undefined }))

    const entriesSnapshot = photoEntries.map(entry => ({ ...entry }))
    if (entriesSnapshot.length > 0) {
      setPhotoEntries(prev => prev.map(entry => ({
        ...entry,
        status: 'pending',
        progress: 0,
        error: null
      })))
    }

    let spotIdForPhotos = existingSpot?.id || null
    const uploadedPhotoIds = []

    try {
      const ratingsData = formData.ratings && Object.keys(formData.ratings).length > 0 
        ? formData.ratings 
        : {}

      const preservedCoverUrl = existingSpot?.cover_photo_url || null
      const { data: mergedSpot, error: mergeError } = await supabase.rpc('merge_foodspot', {
        p_list_id: id,
        p_name: formData.name.trim(),
        p_score: overallRating || null,
        p_criteria: ratingsData,
        p_comment: ratingComment.trim() ? ratingComment.trim() : null,
        p_description: sharedDescription.trim() ? sharedDescription.trim() : null,
        p_category: selectedCategory || listCategory,
        p_address: formData.address.trim() || null,
        p_cover_photo: preservedCoverUrl,
        p_phone: null,
        p_website: null
      })

      if (mergeError) throw mergeError
      spotIdForPhotos = spotIdForPhotos || mergedSpot?.id

      if (!spotIdForPhotos) {
        throw new Error('Konnte Spot-ID nach dem Speichern nicht ermitteln.')
      }

      const coverSelectionId = entriesSnapshot.length > 0
        ? (entriesSnapshot.some(entry => entry.id === coverPhotoEntryId) ? coverPhotoEntryId : entriesSnapshot[0].id)
        : null

      if (entriesSnapshot.length > 0) {
        try {
          for (const entry of entriesSnapshot) {
            setPhotoEntries(prev => prev.map(item => (
              item.id === entry.id
                ? { ...item, status: 'uploading', progress: 0, error: null }
                : item
            )))

            const uploaded = await uploadSharedSpotPhoto({
              listId: id,
              spotId: spotIdForPhotos,
              file: entry.file,
              setAsCover: coverSelectionId ? entry.id === coverSelectionId : entry === entriesSnapshot[0],
              onProgress: (progress) => {
                setPhotoEntries(prev => prev.map(item => (
                  item.id === entry.id
                    ? { ...item, progress }
                    : item
                )))
              }
            })

            uploadedPhotoIds.push(uploaded.id)

            setPhotoEntries(prev => prev.map(item => (
              item.id === entry.id
                ? { ...item, status: 'success', progress: 100 }
                : item
            )))
          }
        } catch (photoError) {
          console.error('Error uploading shared spot photos:', photoError)
          setPhotoEntries(prev => prev.map(item => (
            item.status === 'uploading'
              ? { ...item, status: 'error', progress: 0, error: photoError?.message || 'Upload fehlgeschlagen' }
              : item
          )))

          throw photoError
        }
      }

      entriesSnapshot.forEach(releasePreviewUrl)
      setPhotoEntries([])
      setCoverPhotoEntryId(null)

      showToast(isEditMode ? 'Foodspot aktualisiert' : 'Foodspot hinzugefügt', 'success')
      navigate(`/shared/tierlist/${id}`)
    } catch (error) {
      console.error('Error merging shared foodspot:', error)
      if (uploadedPhotoIds.length > 0) {
        await Promise.all(
          uploadedPhotoIds.map(photoId =>
            deleteSharedSpotPhoto({ photoId }).catch(() => {})
          )
        )
      }
      if (!isEditMode && spotIdForPhotos) {
        await supabase.from('foodspots').delete().eq('id', spotIdForPhotos).catch(() => {})
      }
      setPhotoEntries(prev => prev.map(item => ({
        ...item,
        status: 'pending',
        progress: 0,
        error: null
      })))
      showToast(error?.message || 'Fehler beim Speichern. Bitte versuche es erneut.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveRating = async () => {
    if (!existingSpot) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('delete_foodspot_rating', {
        p_foodspot_id: existingSpot.id
      })
      if (error) throw error
      showToast('Bewertung entfernt', 'success')
      navigate(`/shared/tierlist/${id}`)
    } catch (error) {
      console.error('Error removing rating:', error)
      showToast(error?.message || 'Bewertung konnte nicht entfernt werden.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🤝</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt geteilte Liste...</p>
        </div>
      </div>
    )
  }

  if (!list) {
    return null
  }

  if (!canEdit) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${
        isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'
      }`}>
        <div className="text-6xl mb-4">👀</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Keine Bearbeitung möglich
        </h2>
        <p className="text-center text-sm max-w-md mb-6">
          Du bist als Viewer in dieser geteilten Liste. Nur Owner und Editor können Spots hinzufügen oder Bewertungen anpassen.
        </p>
        <button
          onClick={() => navigate(`/shared/tierlist/${id}`)}
          className={`px-6 py-3 rounded-[18px] font-semibold text-white shadow-lg ${
            isDark
              ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
              : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
          }`}
        >
          Zurück zur Liste
        </button>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col ${
      isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
    } relative overflow-hidden`}>
      <header className="header-safe fixed top-0 left-0 right-0 z-10 backdrop-blur-lg bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/40 dark:border-gray-800/60">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => navigate(`/shared/tierlist/${id}`)}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-200/40 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Geteilte Liste
            </p>
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {list.list_name}
            </h1>
          </div>
          <div className="w-11" />
        </div>
      </header>

      <main 
        className="flex-1 overflow-y-auto max-w-3xl mx-auto px-4"
        style={{
          paddingTop: `calc(60px + env(safe-area-inset-top, 0px) + 12px + 24px)`,
          paddingBottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="space-y-6">
        {/* Kategorie Auswahl */}
        {showCategorySelection && (
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
                  <div className="flex-1 flex flex-col">
                    <span className={`text-lg font-semibold transition-colors ${
                      isDark
                        ? 'text-white group-hover:text-[#FF9357]'
                        : 'text-gray-900 group-hover:text-[#FF7E42]'
                    }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {category}
                    </span>
                    <span className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {CATEGORIES[category].criteria.slice(0, 3).join(' · ')}
                    </span>
                  </div>
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
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-colors ${
                  isDark
                    ? 'bg-gray-600 group-hover:bg-[#B85C2C]/30 text-white'
                    : 'bg-gray-100 group-hover:bg-[#FFE4C3]/50 text-[#FF7E42]'
                }`}>
                  ➕
                </div>
                <div className="flex-1">
                  <span className={`text-lg font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Eigene Kategorie
                  </span>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Erstelle eine Liste mit deinen eigenen Bewertungskriterien
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {selectedCategory && (
          <div className="space-y-6">
            {/* Spot Name */}
            <div className="rounded-[20px] shadow-lg border p-6 bg-white/80 dark:bg-gray-900/80 border-gray-200/60 dark:border-gray-800/60">
              <label className="block text-sm font-semibold mb-2">Name des Spots</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. BLN Döner"
                className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-[#FF7E42]/30'
                }`}
              onFocus={handleFieldFocus}
              />
              {errors.name && <p className="mt-2 text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Location */}
            <div className="rounded-[20px] shadow-lg border p-6 bg-white/80 dark:bg-gray-900/80 border-gray-200/60 dark:border-gray-800/60">
              <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                <span className="text-lg">📍</span>
                Adresse / Stadtteil <span className={`font-normal ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>(Optional)</span>
              </label>
              
                  <input
                    type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  address: e.target.value.replace(/[<>]/g, '') 
                }))}
                placeholder="z. B. Hauptstr. 5, Gilching oder nur Gilching"
                maxLength={200}
                    className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                      isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
                    }`}
                    onFocus={handleFieldFocus}
                  />
            </div>

            {/* Ratings */}
            <div className="rounded-[20px] shadow-lg border p-4 sm:p-6 bg-white/80 dark:bg-gray-900/80 border-gray-200/60 dark:border-gray-800/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold">Bewertungskriterien</h3>
                <span className="text-xs text-gray-500">Mindestens 3 Kriterien bewerten</span>
              </div>
              <div className="space-y-5">
                {CATEGORIES[selectedCategory].criteria.map((criterion) => {
                  const ratingScale = getCategoryScale(selectedCategory)
                  const ratingValues = Array.from({ length: ratingScale }, (_, index) => index + 1)
                  const ratingLabel = ratingScale === 5
                    ? '1 - 5 Sterne'
                    : `1 - ${ratingScale} Punkte`

                  return (
                    <div key={criterion} className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-4 sm:p-5">
                      {/* Header mit Icon, Label und Skala-Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">
                            {CRITERIA_ICONS[criterion] || '⭐'}
                          </span>
                          <h4 className="font-semibold text-base">{criterion}</h4>
                        </div>
                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{ratingLabel}</span>
                      </div>
                      
                      {/* Rating Buttons - responsive grid */}
                      <div
                        className="grid gap-2 sm:gap-2.5"
                        style={{ 
                          gridTemplateColumns: `repeat(${ratingScale <= 5 ? ratingScale : 5}, 1fr)`,
                          maxWidth: '100%'
                        }}
                      >
                        {ratingValues.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              ratings: {
                                ...prev.ratings,
                                [criterion]: value
                              }
                            }))}
                            className={`
                              aspect-square rounded-xl font-bold text-sm sm:text-base
                              transition-all duration-200 ease-out
                              ${formData.ratings[criterion] >= value
                                ? 'bg-gradient-to-r from-[#FF9357] to-[#FFB25A] text-white shadow-lg transform scale-105'
                                : isDark
                                  ? 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 active:scale-95'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95'
                              }
                            `}
                            style={{
                              minWidth: '48px',
                              minHeight: '48px'
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

            {/* Overall Rating */}
            <div className={`rounded-[20px] shadow-lg p-6 text-white ${
              isDark
                ? 'bg-gradient-to-br from-[#FF9357] to-[#B85C2C]'
                : 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80 mb-1">⭐ Durchschnitt</p>
                  <p className="text-4xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {overallRating.toFixed(1)}/10
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80 mb-1">🏆 Auto-Tier</p>
                  <p className="text-6xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {autoTier}
                  </p>
                </div>
              </div>
            </div>

          {/* Photos */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-xl">📷</span>
                  Fotos (optional)
                </h3>
                <p className="text-xs text-gray-500">
                  Maximal {MAX_SPOT_PHOTOS} Fotos pro Spot
                </p>
              </div>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-[14px] text-sm font-semibold transition-all ${
                  isDark
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-60`}
              >
                Fotos auswählen
              </button>
            </div>

            {photoEntries.length === 0 ? (
              <div className={`rounded-2xl border-2 border-dashed px-6 py-14 text-center ${
                isDark ? 'border-gray-800 bg-gray-900/40' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="text-4xl mb-3">🖼️</div>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Füge ein Foto hinzu, damit alle sofort einen Eindruck bekommen.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {photoEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border overflow-hidden bg-black/5 dark:bg-white/5 border-gray-200 dark:border-gray-800">
                    <div className="relative aspect-[4/3] bg-black/10">
                      <img
                        src={entry.previewUrl}
                        alt={entry.name}
                        className="w-full h-full object-cover"
                      />
                      {entry.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white text-sm">
                          <span>Upload läuft...</span>
                          <div className="w-32 h-1.5 rounded-full bg-white/30 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]"
                              style={{ width: `${Math.max(entry.progress || 5, 5)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {entry.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/20 backdrop-blur-sm flex flex-col items-center justify-center px-4 text-center">
                          <span className="text-sm font-semibold text-red-200">Upload fehlgeschlagen</span>
                          <span className="text-[11px] text-red-100">{entry.error || 'Bitte erneut versuchen.'}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhotoEntry(entry.id)}
                        disabled={isSubmitting || entry.status === 'uploading'}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70 transition-all disabled:opacity-60"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleMarkCoverPhoto(entry.id)}
                          disabled={isSubmitting || entry.status === 'uploading'}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                            coverPhotoEntryId === entry.id
                              ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow'
                              : isDark
                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } disabled:opacity-60`}
                        >
                          {coverPhotoEntryId === entry.id ? 'Titelbild' : 'Als Titelbild'}
                        </button>
                        <span className={`text-[11px] font-semibold ${
                          entry.status === 'success'
                            ? 'text-green-500'
                            : entry.status === 'error'
                              ? 'text-red-500'
                              : entry.status === 'uploading'
                                ? 'text-[#FF7E42]'
                                : isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                        }`}>
                          {entry.status === 'success' && 'Fertig'}
                          {entry.status === 'pending' && 'Bereit'}
                          {entry.status === 'uploading' && `${entry.progress || 0}%`}
                          {entry.status === 'error' && 'Fehler'}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {entry.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={handlePhotoSelection}
            />
          </div>

            {/* Shared Description */}
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="text-lg">📝</span>
                Gemeinsame Beschreibung <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <textarea
                value={sharedDescription}
                onChange={(e) => setSharedDescription(e.target.value)}
                rows="4"
                placeholder="Beschreibe diesen Spot für alle Mitglieder..."
                className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 resize-none ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-[#FF7E42]/20'
                }`}
                onFocus={handleFieldFocus}
              />
            </div>

            {/* Personal Comment */}
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="text-lg">💬</span>
                Persönlicher Kommentar <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows="4"
                placeholder="Was macht diesen Spot für dich besonders?"
                className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 resize-none ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-[#FF7E42]/20'
                }`}
                onFocus={handleFieldFocus}
              />
            </div>

            {/* Remove own rating */}
            {isEditMode && existingRating && (
              <button
                type="button"
                onClick={handleRemoveRating}
                disabled={isSubmitting}
                className={`w-full py-3 rounded-[16px] font-semibold text-base transition-all border mb-4 ${
                  isDark
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                } disabled:opacity-60`}
              >
                Meine Bewertung entfernen
              </button>
            )}

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-3">
              {isEditMode && userRole === 'owner' && (
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className={`flex-1 py-4 rounded-[18px] font-semibold text-base shadow-lg transition-all ${
                    isDark
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  } disabled:opacity-60`}
                >
                  Löschen
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-4 rounded-[22px] font-semibold text-lg text-white shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all disabled:opacity-60 ${
                  isDark
                    ? 'bg-gradient-to-r from-[#FF9357] to-[#B85C2C]'
                    : 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A]'
                }`}
              >
                {isEditMode ? 'Änderungen speichern' : 'Spot hinzufügen'}
              </button>
            </div>
          </div>
        )}
        </div>
      </main>

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
    </div>
  )
}

export default AddSharedFoodspot


