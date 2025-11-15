import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { scrollFieldIntoView } from '../utils/keyboard'

function CreateList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // Get category from URL parameter
  const categoryParam = searchParams.get('category')
  const selectedCategory = categoryParam === 'all' ? null : (categoryParam || null)

  // Form state
  const [formData, setFormData] = useState({
    list_name: '',
    city: '',
    description: '',
    category: selectedCategory,
    coverImageUrl: null,
    coverImageFile: null,
  })
  
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
  const [toast, setToast] = useState(null)

  const { isDark } = useTheme()
  const handleFieldFocus = (event) => scrollFieldIntoView(event.currentTarget)

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

    // City validation
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

  // Normalisiere Stadt-Eingabe
  const normalizeCity = (value) => {
    return value
      .trim()
      .replace(/\s+/g, ' ') // Mehrfache Leerzeichen → eins
      .replace(/[<>]/g, '') // HTML-Tags verbieten
  }

  // Handle input change
  const handleInputChange = (field, value) => {
    // Bei Stadt: Normalisierung anwenden
    const normalizedValue = field === 'city' ? normalizeCity(value) : value
    
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

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setFormData(prev => ({
      ...prev,
      coverImageUrl: previewUrl,
      coverImageFile: file,
    }))
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

      // Upload image if provided
      let imageUrl = null
      if (formData.coverImageFile) {
        const fileExt = formData.coverImageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

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

      // Optimistic update: Create temporary list object for immediate display
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

      // Store optimistic list in sessionStorage for Dashboard to pick up
      sessionStorage.setItem('newList', JSON.stringify(optimisticList))
      sessionStorage.setItem('scrollTargetListId', tempListId)

      // Clear draft
      localStorage.removeItem('createListDraft')

      // Navigate immediately (optimistic) - no loading screen
      setIsSubmitting(false)
      navigate('/dashboard', { replace: true })

      // Insert list in background (non-blocking)
      try {
        const insertData = {
          user_id: user.id,
          list_name: formData.list_name.trim(),
          city: formData.city.trim(),
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
          // Remove optimistic list auf Duplikat
          sessionStorage.removeItem('newList')
          sessionStorage.removeItem('scrollTargetListId')
          // Real-time subscription wird syncen
          return
        }
        throw insertError
      }

        // Replace optimistic list with real one via sessionStorage
        if (insertedList) {
          const realList = {
            ...insertedList,
            entryCount: 0,
          }
          sessionStorage.setItem('newList', JSON.stringify(realList))
          sessionStorage.setItem('scrollTargetListId', realList.id)
        }
        
        // Real-time subscription will sync automatically
      } catch (error) {
        console.error('Error creating list in background:', error)
        // Remove optimistic list on error
        sessionStorage.removeItem('newList')
        sessionStorage.removeItem('scrollTargetListId')
        // Real-time subscription will handle sync
      }
    } catch (error) {
      console.error('Error creating list:', error)
      showToast('Fehler beim Erstellen der Liste. Bitte versuche es erneut.', 'error')
      setIsSubmitting(false)
    }
  }

  // Check if form is valid
  const isFormValid = () => {
    return formData.list_name.trim().length >= 3 && formData.city.trim().length > 0
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
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
      <header className={`header-safe backdrop-blur-[12px] border-b px-4 flex items-center justify-between sticky top-0 z-10 ${
        isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white/70 border-gray-200/30'
      }`}>
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

      {/* Main Content */}
      <main className="px-4 py-6 pb-8">
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

          {/* City */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <label className={`block text-sm font-semibold mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Stadt <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="z. B. München oder Gilching"
              maxLength={100}
              className={`w-full px-4 py-3 rounded-[14px] border transition-all focus:outline-none focus:ring-2 ${
                errors.city 
                  ? 'border-red-400 focus:ring-red-200' 
                  : validationState.city === 'valid'
                  ? 'border-green-400 focus:ring-green-200'
                  : isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-[#FF9357]/20'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-[#FF7E42]/20'
              }`}
              onFocus={handleFieldFocus}
            />
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
          {formData.list_name && formData.city && (
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
                  <p className="text-white/90 text-sm flex items-center gap-1 drop-shadow-md">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {formData.city}
                  </p>
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
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

export default CreateList
