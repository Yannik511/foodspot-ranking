import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'

function Discover() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const [top10Spots, setTop10Spots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch und merge Spots nach Name + Stadt + Kategorie
  // Basierend auf der Freundeslogik (FriendProfile.jsx) - zeigt private Listen von öffentlichen Usern
  const fetchTop10 = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)

      // 1. Hole alle User mit öffentlichem Profil (profile_visibility = 'public')
      const { data: publicUsers, error: usersError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('profile_visibility', 'public')

      if (usersError) {
        console.error('Error fetching public users:', usersError)
        throw usersError
      }

      if (!publicUsers || publicUsers.length === 0) {
        setTop10Spots([])
        setLoading(false)
        return
      }

      const publicUserIds = publicUsers.map(u => u.id)
      console.log(`Found ${publicUserIds.length} public users`)

      // 2. Hole PRIVATE Listen dieser User (user_id ist owner, NICHT in list_members)
      // Analog zur Freundeslogik: fetchFriendStats holt nur die Listen des Friend-Users (l.user_id)
      const { data: privateLists, error: listsError } = await supabase
        .from('lists')
        .select('id, user_id')
        .in('user_id', publicUserIds)

      if (listsError) {
        console.error('Error fetching private lists:', listsError)
        throw listsError
      }

      if (!privateLists || privateLists.length === 0) {
        setTop10Spots([])
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
        setTop10Spots([])
        setLoading(false)
        return
      }

      console.log(`Found ${privateListIds.length} private lists from public users`)

      // 4. Hole alle Foodspots aus diesen privaten Listen
      // WICHTIG: Spaltenname ist 'name' nicht 'foodspot_name'
      const { data: allSpots, error: spotsError } = await supabase
        .from('foodspots')
        .select('id, name, city, category, rating, created_at, list_id')
        .in('list_id', privateListIds)
        .not('rating', 'is', null)
        .order('created_at', { ascending: true })

      if (spotsError) {
        console.error('Error fetching spots:', spotsError)
        throw spotsError
      }

      if (!allSpots || allSpots.length === 0) {
        setTop10Spots([])
        setLoading(false)
        return
      }

      // 5. Spots nach Name + Stadt + Kategorie gruppieren (mergen)
      const mergedSpots = {}
      
      for (const spot of allSpots) {
        // Normalisiere den Key (lowercase für case-insensitive matching)
        const key = `${spot.name?.toLowerCase()}|${spot.city?.toLowerCase()}|${spot.category?.toLowerCase() || 'uncategorized'}`
        
        if (!mergedSpots[key]) {
          mergedSpots[key] = {
            name: spot.name,
            city: spot.city,
            category: spot.category,
            ratings: [],
            spotIds: [],
            firstCreated: spot.created_at,
            images: []
          }
        }
        
        // Rating hinzufügen
        if (spot.rating != null) {
          mergedSpots[key].ratings.push(spot.rating)
        }
        
        mergedSpots[key].spotIds.push(spot.id)
        
        // Frühestes Erstellungsdatum tracken
        if (new Date(spot.created_at) < new Date(mergedSpots[key].firstCreated)) {
          mergedSpots[key].firstCreated = spot.created_at
        }
      }

      // 3. Bilder für jeden gemergten Spot laden (bis zu 20, früheste zuerst)
      const spotsWithImages = await Promise.all(
        Object.entries(mergedSpots).map(async ([key, mergedSpot]) => {
          // Hole bis zu 20 Bilder von allen Spots dieses gemergten Eintrags
          const { data: photos } = await supabase
            .from('spot_photos')
            .select('photo_url, created_at')
            .in('foodspot_id', mergedSpot.spotIds)
            .order('created_at', { ascending: true })
            .limit(20)
          
          mergedSpot.images = photos?.map(p => p.photo_url) || []
          return { key, ...mergedSpot }
        })
      )

      // 4. Durchschnittsbewertung berechnen und sortieren
      const spotsWithAverage = spotsWithImages
        .map(spot => {
          const avgRating = spot.ratings.length > 0
            ? spot.ratings.reduce((sum, r) => sum + r, 0) / spot.ratings.length
            : 0
          
          return {
            ...spot,
            avgRating,
            ratingCount: spot.ratings.length
          }
        })
        .filter(spot => spot.ratingCount > 0) // Nur Spots mit mindestens einer Bewertung
        .sort((a, b) => {
          // Sortierung: 1. Ø-Score absteigend
          if (b.avgRating !== a.avgRating) {
            return b.avgRating - a.avgRating
          }
          // 2. Anzahl Bewertungen absteigend
          if (b.ratingCount !== a.ratingCount) {
            return b.ratingCount - a.ratingCount
          }
          // 3. Alphabetisch (Fallback)
          return a.name.localeCompare(b.name)
        })
        .slice(0, 10) // Top 10

      setTop10Spots(spotsWithAverage)
    } catch (err) {
      console.error('Error fetching top 10:', err)
      setError('Fehler beim Laden der Top 10')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTop10()
  }, [user])

  // Helper: Zeige Sterne-Rating
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-500">★</span>
        ))}
        {hasHalfStar && <span className="text-yellow-500">☆</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 dark:text-gray-600">★</span>
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
            navigate('/dashboard')
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
          🔥 Entdecken
        </h1>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-[#FF7E42]/20 rounded-full dark:border-[#FF9357]/20"></div>
              <div className="absolute inset-0 border-4 border-[#FF7E42] border-t-transparent rounded-full animate-spin dark:border-[#FF9357]"></div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
          </div>
        ) : top10Spots.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🍽️</div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Noch keine Bewertungen
            </h2>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Sei der Erste und bewerte deine Lieblingsspots!
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Top 10 Header */}
            <div className="text-center mb-6">
              <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Top 10 Foodspots
              </h2>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Die beliebtesten Spots unserer Community
              </p>
            </div>

            {/* Top 10 List */}
            {top10Spots.map((spot, index) => (
              <div
                key={spot.key}
                onClick={() => {
                  hapticFeedback.light()
                  navigate(`/discover/${encodeURIComponent(spot.key)}`, { state: { spot } })
                }}
                className={`rounded-[20px] shadow-lg border overflow-hidden cursor-pointer active:scale-[0.98] transition-all ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' 
                    : 'bg-white border-gray-100 hover:shadow-xl'
                }`}
              >
                <div className="flex gap-4 p-4">
                  {/* Ranking Number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] dark:from-[#FF9357] dark:to-[#B85C2C] flex items-center justify-center">
                    <span className="text-white font-bold text-xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {index + 1}
                    </span>
                  </div>

                  {/* Image */}
                  <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700">
                    {spot.images && spot.images[0] ? (
                      <img 
                        src={spot.images[0]} 
                        alt={spot.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-lg mb-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {spot.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <svg className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {spot.city}
                      </span>
                    </div>

                    {/* Category Chip */}
                    {spot.category && (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${getCategoryColor(spot.category)}`}>
                        {spot.category}
                      </span>
                    )}

                    {/* Rating */}
                    <div className="flex items-center gap-2">
                      {renderStars(spot.avgRating)}
                      <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {spot.avgRating.toFixed(1)}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        ({spot.ratingCount} {spot.ratingCount === 1 ? 'Bewertung' : 'Bewertungen'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Discover
