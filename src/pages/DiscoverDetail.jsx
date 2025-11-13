import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'

function DiscoverDetail() {
  const { spotKey } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const [spotData, setSpotData] = useState(location.state?.spot || null)
  const [loading, setLoading] = useState(!location.state?.spot)
  const [error, setError] = useState(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Falls die Daten nicht über state übergeben wurden, lade sie
  useEffect(() => {
    if (!spotData && spotKey) {
      fetchSpotDetails()
    }
  }, [spotKey, spotData])

  const fetchSpotDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Dekodiere den spotKey (format: "name|city|category")
      const decodedKey = decodeURIComponent(spotKey)
      const [name, city, category] = decodedKey.split('|')
      
      // 1. Hole alle User mit öffentlichem Profil (profile_visibility = 'public')
      const { data: publicUsers, error: usersError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('profile_visibility', 'public')

      if (usersError) throw usersError

      if (!publicUsers || publicUsers.length === 0) {
        setError('Keine öffentlichen User gefunden')
        setLoading(false)
        return
      }

      const publicUserIds = publicUsers.map(u => u.id)

      // 2. Hole PRIVATE Listen dieser User
      const { data: privateLists, error: listsError } = await supabase
        .from('lists')
        .select('id, user_id')
        .in('user_id', publicUserIds)

      if (listsError) throw listsError

      if (!privateLists || privateLists.length === 0) {
        setError('Keine Listen gefunden')
        setLoading(false)
        return
      }

      // 3. Filtere geteilte Listen raus (Listen MIT Mitgliedern)
      const { data: sharedListMembers } = await supabase
        .from('list_members')
        .select('list_id')
      
      const sharedListIds = new Set(sharedListMembers?.map(m => m.list_id) || [])
      
      // Nur Listen OHNE Mitglieder (private Listen)
      const privateListIds = privateLists
        .filter(list => !sharedListIds.has(list.id))
        .map(l => l.id)

      if (privateListIds.length === 0) {
        setError('Keine privaten Listen gefunden')
        setLoading(false)
        return
      }

      // 4. Hole alle Spots mit diesem Key aus privaten Listen
      // WICHTIG: Spaltenname ist 'name' nicht 'foodspot_name'
      const { data: allSpots, error: spotsError } = await supabase
        .from('foodspots')
        .select('id, name, city, category, rating, created_at, list_id')
        .in('list_id', privateListIds)
        .ilike('name', name)
        .ilike('city', city)
        .not('rating', 'is', null)

      if (spotsError) throw spotsError
      
      // Filter nach Kategorie (wenn vorhanden und nicht 'uncategorized')
      let filteredSpots = allSpots
      if (category && category !== 'uncategorized') {
        filteredSpots = allSpots?.filter(s => 
          s.category?.toLowerCase() === category.toLowerCase()
        )
      }

      if (!filteredSpots || filteredSpots.length === 0) {
        setError('Spot nicht gefunden')
        setLoading(false)
        return
      }

      // Merge die Daten
      const ratings = filteredSpots.map(s => s.rating).filter(r => r != null)
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0

      // Hole Bilder
      const { data: photos } = await supabase
        .from('spot_photos')
        .select('photo_url, created_at')
        .in('foodspot_id', filteredSpots.map(s => s.id))
        .order('created_at', { ascending: true })
        .limit(20)

      setSpotData({
        name: filteredSpots[0].name,
        city: filteredSpots[0].city,
        category: filteredSpots[0].category,
        avgRating,
        ratingCount: ratings.length,
        images: photos?.map(p => p.photo_url) || [],
        key: decodedKey
      })
    } catch (err) {
      console.error('Error fetching spot details:', err)
      setError('Fehler beim Laden der Details')
    } finally {
      setLoading(false)
    }
  }

  // Helper: Zeige Sterne-Rating
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="flex items-center gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-500 text-2xl">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-500 text-2xl">☆</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 dark:text-gray-600 text-2xl">★</span>
        ))}
      </div>
    )
  }

  // Helper: Kategorie-Farben
  const getCategoryColor = (category) => {
    const colors = {
      'Döner': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      'Burger': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'Pizza': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Asiatisch': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'Sushi': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    }
    return colors[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-b from-white via-[#FFF2EB] to-white'}`}>
        <div className="flex items-center justify-center py-20">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#FF7E42]/20 rounded-full dark:border-[#FF9357]/20"></div>
            <div className="absolute inset-0 border-4 border-[#FF7E42] border-t-transparent rounded-full animate-spin dark:border-[#FF9357]"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !spotData) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-b from-white via-[#FFF2EB] to-white'}`}>
        <div className="text-center py-20">
          <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error || 'Spot nicht gefunden'}</p>
          <button
            onClick={() => navigate('/discover')}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] text-white rounded-full font-semibold"
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-b from-white via-[#FFF2EB] to-white'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 backdrop-blur-[12px] border-b px-4 py-3 flex items-center justify-between ${
        isDark 
          ? 'bg-gray-800/70 border-gray-700/30' 
          : 'bg-white/70 border-gray-200/30'
      }`}>
        <button
          onClick={() => {
            hapticFeedback.light()
            navigate('/discover')
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
            isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
          }`}
        >
          <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 
          className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}
        >
          Spot Details
        </h1>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 pb-24 max-w-3xl mx-auto">
        {/* Hero Image Section */}
        {spotData.images && spotData.images.length > 0 && (
          <div className="mb-6">
            <div className="relative w-full h-72 rounded-[24px] overflow-hidden bg-gray-200 dark:bg-gray-700">
              <img 
                src={spotData.images[selectedImageIndex]} 
                alt={spotData.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Image Thumbnails */}
            {spotData.images.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {spotData.images.slice(0, 20).map((img, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      hapticFeedback.light()
                      setSelectedImageIndex(index)
                    }}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-[#FF7E42] dark:border-[#FF9357] scale-105'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <img 
                      src={img} 
                      alt={`${spotData.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className={`rounded-[24px] shadow-lg border p-6 mb-6 ${
          isDark 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-100'
        }`}>
          {/* Name */}
          <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {spotData.name}
          </h2>

          {/* Location */}
          <div className="flex items-center gap-2 mb-4">
            <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {spotData.city}
            </span>
          </div>

          {/* Category */}
          {spotData.category && (
            <div className="mb-6">
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getCategoryColor(spotData.category)}`}>
                {spotData.category}
              </span>
            </div>
          )}

          {/* Rating Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {renderStars(spotData.avgRating)}
                  <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {spotData.avgRating.toFixed(1)}
                  </span>
                </div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Basierend auf {spotData.ratingCount} {spotData.ratingCount === 1 ? 'Bewertung' : 'Bewertungen'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className={`rounded-[24px] shadow-lg border p-6 ${
          isDark 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-100'
        }`}>
          <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Community Statistiken
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-[#FF7E42]/10 to-[#FFB25A]/10 dark:from-[#FF9357]/10 dark:to-[#B85C2C]/10">
              <div className="text-3xl font-bold text-[#FF7E42] dark:text-[#FF9357] mb-1">
                {spotData.ratingCount}
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Bewertungen
              </div>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-600/10">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mb-1">
                {spotData.avgRating.toFixed(1)}★
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Durchschnitt
              </div>
            </div>

            {spotData.images && spotData.images.length > 0 && (
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-500 mb-1">
                  {spotData.images.length}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {spotData.images.length === 1 ? 'Foto' : 'Fotos'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className={`mt-6 rounded-xl p-4 ${
          isDark ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}>
          <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            💡 Diese Bewertungen stammen aus den privaten Listen aller Rankify-Nutzer
          </p>
        </div>
      </main>
    </div>
  )
}

export default DiscoverDetail

