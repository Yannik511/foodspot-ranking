import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { assertImageAllowed } from '../services/moderation'
import { scrollFieldIntoView } from '../utils/keyboard'
import { useHeaderHeight } from '../hooks/useHeaderHeight'
import LocationPickerSheet from '../components/LocationPickerSheet'
import { cityLabelFromAddress } from '../utils/locationLabel'
import { useSaveStatus } from '../contexts/SaveStatusContext'

function CreateList() {
  const { user } = useAuth()
  const { beginSave, resolveSave, failSave } = useSaveStatus()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { headerRef, headerHeight } = useHeaderHeight()
  
  // Get category from URL parameter
  const categoryParam = searchParams.get('category')
  const selectedCategory = categoryParam === 'all' ? null : (categoryParam || null)

  // Form state
  const [formData, setFormData] = useState({
    list_name: '',
    city: '',
    address: '',
    latitude: null,
    longitude: null,
    description: '',
    category: selectedCategory,
    list_mode: 'location', // 'location' = ortsbasiert, 'product' = produktbasiert
    coverImageUrl: null,
    coverImageFile: null,
  })
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  
  // If no category parameter, redirect to category selection
  useEffect(() => {
    if (!categoryParam) {
      navigate('/select-category')
    }
  }, [categoryParam, navigate])

  // Validation state
  const [errors, setErrors] = useState({})
  const [validationState, setValidationState] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { isDark } = useTheme()
  const handleFieldFocus = (event) => scrollFieldIntoView(event.currentTarget)

  // Track the active preview Object-URL so we can revoke it before allocating a new one
  // and on unmount. Without this, every cover-image pick leaks the previous blob.
  const previewUrlRef = useRef(null)
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  // Auto-save to localStorage
  useEffect(() => {
    if (formData.list_name || formData.city || formData.description) {
      localStorage.setItem('createListDraft', JSON.stringify({
        list_name: formData.list_name,
        city: formData.city,
        description: formData.description,
      }))
    }
  }, [formData.list_name, formData.city, formData.description])

  // Load draft from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('createListDraft')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setFormData(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Error loading draft:', e)
      }
    }
  }, [])

  // Validate form
  const validateForm = () => {
    const newErrors = {}
    const newValidationState = {}

    // Name validation
    if (!formData.list_name.trim()) {
      newErrors.list_name = 'Listenname ist erforderlich'
      newValidationState.list_name = 'error'
    } else if (formData.list_name.length < 3) {
      newErrors.list_name = 'Mindestens 3 Zeichen erforderlich'
      newValidationState.list_name = 'error'
    } else {
      newValidationState.list_name = 'valid'
    }

    // City validation — Pflicht nur im Orts-Modus
    if (formData.list_mode === 'location') {
      if (!formData.city.trim()) {
        newErrors.city = 'Stadt ist erforderlich'
        newValidationState.city = 'error'
      } else {
        newValidationState.city = 'valid'
      }
    } else if (formData.city.trim()) {
      newValidationState.city = 'valid'
    }

    setErrors(newErrors)
    setValidationState(newValidationState)
    return Object.keys(newErrors).length === 0
  }

  // Normalisiere Stadt-Eingabe (nur beim Speichern, nicht während der Eingabe)
  const _normalizeCity = (value) => {
    return value
      .trim()
      .replace(/\s+/g, ' ') // Mehrfache Leerzeichen → eins
      .replace(/[<>]/g, '') // HTML-Tags verbieten
  }

  // Handle input change
  const handleInputChange = (field, value) => {
    // Bei Stadt: Nur HTML-Tags entfernen während der Eingabe, trim() erst beim Speichern
    let normalizedValue = value
    if (field === 'city') {
      // Während der Eingabe: Nur HTML-Tags entfernen, Leerzeichen erlauben
      normalizedValue = value.replace(/[<>]/g, '')
    }
    
    setFormData(prev => ({ ...prev, [field]: normalizedValue }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Handle cover image upload
  const handleCoverImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, coverImage: 'Bitte wähle ein Bild aus' }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, coverImage: 'Bild muss kleiner als 5MB sein' }))
      return
    }

    // Create preview URL — revoke previous one to avoid memory leak
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setFormData(prev => ({
      ...prev,
      coverImageUrl: previewUrl,
      coverImageFile: file,
    }))
  }

  // Show toast helper

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)

    const saveId = `create-list-${Date.now()}`
    beginSave(saveId, 'Liste wird erstellt…')

    try {
      console.log('Creating list with data:', {
        list_name: formData.list_name,
        city: formData.city,
        hasImage: !!formData.coverImageFile,
        user_id: user?.id
      })

      // Upload image if provided
      let imageUrl = null
      if (formData.coverImageFile) {
        const fileExt = formData.coverImageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        // Inhalts-Moderation vor Upload (Apple 1.2)
        await assertImageAllowed(formData.coverImageFile)

        // Upload to storage
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

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('list-covers')
          .getPublicUrl(fileName)

        if (!urlData || !urlData.publicUrl) {
          throw new Error('Failed to get public URL for uploaded image')
        }

        imageUrl = urlData.publicUrl
      }

      const cityValue = formData.city.trim() || null

      // Insert list FIRST — wait for DB to confirm before navigating.
      // This guarantees the Dashboard fetch sees the real list, no race condition.
      const insertData = {
        user_id: user.id,
        list_name: formData.list_name.trim(),
        city: cityValue,
        address: formData.address?.trim() || null,
        latitude: formData.latitude ?? null,
        longitude: formData.longitude ?? null,
        list_mode: formData.list_mode,
        description: formData.description.trim() || null,
        category: formData.category || null,
        cover_image_url: imageUrl,
      }

      const { data: insertedList, error: insertError } = await supabase
        .from('lists')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Insert error details:', insertError)
        if (insertError.code === '23505') {
          failSave(saveId, 'Diese Liste existiert bereits')
        } else {
          failSave(saveId, 'Liste konnte nicht erstellt werden')
        }
        setIsSubmitting(false)
        return
      }

      // Persist real list for Dashboard to pick up (optimistic display + scroll target)
      if (insertedList) {
        const realList = { ...insertedList, entryCount: 0 }
        sessionStorage.setItem('newList', JSON.stringify(realList))
        sessionStorage.setItem('scrollTargetListId', realList.id)
      }

      // Liste steht — Pille quittiert; danach zum Dashboard.
      resolveSave(saveId, 'Liste erstellt')
      localStorage.removeItem('createListDraft')
      setIsSubmitting(false)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      console.error('Error creating list:', error)
      failSave(saveId, 'Liste konnte nicht erstellt werden')
      setIsSubmitting(false)
    }
  }

  // Check if form is valid
  const isFormValid = () => {
    const nameOk = formData.list_name.trim().length >= 3
    if (formData.list_mode === 'product') return nameOk
    return nameOk && formData.city.trim().length > 0
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} relative overflow-hidden`}>
      {/* Loading Overlay - Only show if submitting and not navigating */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm mx-4">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-[#FF7E42]/20 rounded-full dark:border-[#FF9357]/20"></div>
              <div className="absolute inset-0 border-4 border-[#FF7E42] border-t-transparent rounded-full animate-spin dark:border-[#FF9357]"></div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Liste wird erstellt...
            </h3>
            <p className="text-gray-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              Einen Moment bitte
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header 
        ref={headerRef}
        className={`header-safe backdrop-blur-xl border-b px-4 flex items-center justify-between fixed top-0 left-0 right-0 z-20 shadow-sm ${
          isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
        }`}
      >
        <button
          onClick={() => navigate('/select-category')}
          className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
            isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className={`text-lg font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
          Neue Liste erstellen
          {selectedCategory && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({selectedCategory})
            </span>
          )}
        </h1>

        <div className="w-10" />
      </header>

      {/* Main Content - scrollt von top: 0 (unter Dynamic Island) */}
      <main 
        className="absolute inset-0 overflow-y-auto px-4"
        style={{
          paddingTop: 0,
          paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Spacer für Header-Höhe + konsistenter Abstand - Content scrollt darüber */}
        <div 
          style={{ 
            height: headerHeight 
              ? `${headerHeight + 24}px` // Gemessene Header-Höhe + 24px konsistenter Abstand
              : `calc(60px + env(safe-area-inset-top, 0px) + 24px + 24px)`, // Fallback: Header + Safe-Area + 24px Abstand
            flexShrink: 0 
          }} 
        />
        
        {/* Content-Bereich - kein zusätzliches Padding, da bereits im Spacer enthalten */}
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* List Name */}
          <div className={`rounded-[20px] shadow-lg border overflow-hidden p-6 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Listenname <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.list_name}
                onChange={(e) => handleInputChange('list_name', e.target.value)}
                placeholder="z. B. Beste Burger Münchens"
                className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                  errors.list_name
                    ? 'border-red-400 focus:ring-red-200'
                    : validationState.list_name === 'valid'
                      ? 'border-green-400 focus:ring-green-200'
                      : isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                        : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
                }`}
                onFocus={handleFieldFocus}
              />
              {validationState.list_name === 'valid' && (
                <svg className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  isDark ? 'text-green-400' : 'text-green-500'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {errors.list_name && <p className="mt-2 text-sm text-red-500">{errors.list_name}</p>}
          </div>

          {/* List Mode Toggle */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-3 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Listentyp
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'location', emoji: '📍', label: 'Orte', desc: 'Restaurants, Buden' },
                { key: 'product', emoji: '🍺', label: 'Produkte', desc: 'Biere, Glühwein' },
              ].map(opt => {
                const active = formData.list_mode === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleInputChange('list_mode', opt.key)}
                    className={`p-3 rounded-[14px] border-2 text-left transition-all active:scale-[0.98] ${
                      active
                        ? (isDark ? 'border-[#FF9357] bg-[#FF9357]/10' : 'border-[#FF7E42] bg-[#FF7E42]/10')
                        : (isDark ? 'border-gray-700' : 'border-gray-200')
                    }`}
                  >
                    <div className="text-xl mb-1">{opt.emoji}</div>
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {opt.label}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {opt.desc}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className={`text-xs mt-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {formData.list_mode === 'product'
                ? 'Ort ist optional — wird gespeichert wenn angegeben (für spätere Kartenansicht).'
                : 'Ort ist Pflicht und wird bei jedem Spot abgefragt.'}
            </p>
          </div>

          {/* City */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              {formData.list_mode === 'product' ? 'Ort' : 'Stadt'}
              {formData.list_mode === 'location' ? (
                <span className="text-red-500"> *</span>
              ) : (
                <span className={`text-xs font-normal ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(optional)</span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setShowLocationPicker(true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[14px] border text-left transition-all ${
                errors.city
                  ? 'border-red-400'
                  : formData.city
                    ? (isDark ? 'border-[#FF9357]/40 bg-[#FF9357]/10' : 'border-[#FF7E42]/40 bg-[#FF7E42]/5')
                    : (isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                formData.city ? 'text-white' : (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-100 text-gray-400')
              }`} style={formData.city ? { background: 'linear-gradient(135deg, #FF9357, #B85C2C)' } : undefined}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                {formData.city ? (
                  <>
                    <span className={`block text-[11px] ${isDark ? 'text-[#FF9357]' : 'text-[#FF7E42]'}`}>
                      Standort gesetzt · tippen zum Ändern
                    </span>
                    <span className={`block text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formData.address || formData.city}
                    </span>
                  </>
                ) : (
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>
                    Auf Karte suchen…
                  </span>
                )}
              </span>
            </button>
            {errors.city && <p className="mt-2 text-sm text-red-500">{errors.city}</p>}
          </div>

          {/* Description */}
          <div className={`rounded-[20px] shadow-lg border overflow-hidden p-6 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Beschreibung <span className={`text-xs font-normal ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>(optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Kurze Beschreibung deiner Liste"
              rows="3"
              maxLength="250"
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 resize-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
              onFocus={handleFieldFocus}
            />
            <p className={`text-sm mt-2 text-right ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>{formData.description.length}/250</p>
          </div>

          {/* Cover Image */}
          <div className={`rounded-[20px] shadow-lg border overflow-hidden p-6 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Titelbild
            </label>
            
            {formData.coverImageUrl ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={formData.coverImageUrl} alt="Preview" className="w-full h-64 object-cover" />
                <button
                  onClick={() => handleInputChange('coverImageUrl', null)}
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
                    isDark ? 'text-gray-200' : 'text-gray-600'
                  }`}>Bild auswählen</p>
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>PNG, JPG bis 5MB</p>
                </div>
              </label>
            )}

            <button
              type="button"
              onClick={() => handleInputChange('coverImageUrl', null)}
              className={`mt-4 w-full px-4 py-3 rounded-[14px] border transition-all ${
                isDark
                  ? 'border-gray-600 text-gray-200 hover:border-[#FF9357] hover:bg-[#B85C2C]/20'
                  : 'border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              Kein Titelbild
            </button>
          </div>

          {/* Live Preview */}
          {formData.list_name && (formData.city || formData.list_mode === 'product') && (
            <div className="bg-white rounded-[20px] shadow-lg border border-gray-100 overflow-hidden p-6">
              <h2 className="text-xl font-bold mb-4">Vorschau</h2>
              <div className="rounded-2xl overflow-hidden shadow-md border border-gray-100 relative h-48">
                {/* Background Image */}
                {formData.coverImageUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${formData.coverImageUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
                )}

                {/* Gradient Overlay for text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                {/* Text Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                    {formData.list_name}
                  </h3>
                  {formData.city ? (
                    <p className="text-white/90 text-sm flex items-center gap-1 drop-shadow-md">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {formData.city}
                    </p>
                  ) : (
                    <p className="text-white/90 text-sm flex items-center gap-1 drop-shadow-md">
                      🍺 Produkt-Liste
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
            className={`w-full py-4 rounded-[20px] font-semibold text-lg transition-all ${
              isFormValid() && !isSubmitting
                ? 'bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white shadow-lg hover:shadow-xl active:scale-[0.98] dark:from-[#FF9357] dark:to-[#B85C2C]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            🍽️ Liste erstellen
          </button>
        </div>
      </main>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      <LocationPickerSheet
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        initialCenter={formData.latitude != null ? { lat: formData.latitude, lng: formData.longitude } : undefined}
        onConfirm={({ address, latitude, longitude }) => {
          setFormData(prev => ({
            ...prev,
            address: address || '',
            city: cityLabelFromAddress(address),
            latitude,
            longitude,
          }))
          setErrors(prev => ({ ...prev, city: undefined }))
        }}
      />
    </div>
  )
}

export default CreateList
