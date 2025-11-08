import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'

// Category emojis for display
const CATEGORY_EMOJIS = {
  'Döner': '🥙',
  'Burger': '🍔',
  'Pizza': '🍕',
  'Asiatisch': '🍜',
  'Mexikanisch': '🌮',
  'Glühwein': '🍷',
  'Sushi': '🍣',
  'Deutsche Küche': '🥨',
  'Bier': '🍺'
}

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
        const MAX_SIZE = 512
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (blob.size > 200 * 1024) {
              canvas.toBlob(
                (compressedBlob) => {
                  resolve(new File([compressedBlob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  }))
                },
                'image/jpeg',
                0.7
              )
            } else {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              }))
            }
          },
          'image/jpeg',
          0.8
        )
      }
    }
  })
}

function Account() {
  const { user, signOut } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Profile stats
  const [stats, setStats] = useState({
    totalSpots: 0,
    totalCities: 0,
    averageScore: 0,
    tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
    categoryCounts: {},
    topCities: [],
    topSpots: [],
    recentSpots: [],
    activityStreak: 0,
    lastActivityDates: []
  })
  
  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  }

  const getMemberSince = () => {
    if (!user?.created_at) return ''
    const date = new Date(user.created_at)
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    return `${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const getProfileVisibility = () => {
    return user?.user_metadata?.profile_visibility || 'private'
  }
  
  const isProfileVisibleToFriends = () => {
    return getProfileVisibility() === 'friends'
  }

  // Fetch profile statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return
      
      setLoading(true)
      try {
        // Fetch all lists for user
        const { data: listsData, error: listsError } = await supabase
          .from('lists')
          .select('id, city')
          .eq('user_id', user.id)

        if (listsError) throw listsError

        // Fetch all foodspots for user
        const { data: spotsData, error: spotsError } = await supabase
          .from('foodspots')
          .select('id, name, rating, tier, category, address, cover_photo_url, list_id, created_at, updated_at')
          .eq('user_id', user.id)

        if (spotsError) throw spotsError

        // Calculate statistics
        const totalSpots = spotsData?.length || 0
        
        // Get unique cities from lists
        const uniqueCities = new Set(listsData?.map(l => l.city) || [])
        const totalCities = uniqueCities.size

        // Calculate average score
        const ratings = spotsData?.filter(s => s.rating != null).map(s => s.rating) || []
        const averageScore = ratings.length > 0 
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
          : 0

        // Tier distribution
        const tierDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0 }
        spotsData?.forEach(spot => {
          if (spot.tier && tierDistribution[spot.tier] !== undefined) {
            tierDistribution[spot.tier]++
          }
        })

        // Category counts
        const categoryCounts = {}
        spotsData?.forEach(spot => {
          if (spot.category) {
            categoryCounts[spot.category] = (categoryCounts[spot.category] || 0) + 1
          }
        })

        // Top cities (by spot count per city)
        const cityCounts = {}
        spotsData?.forEach(spot => {
          const list = listsData?.find(l => l.id === spot.list_id)
          if (list?.city) {
            cityCounts[list.city] = (cityCounts[list.city] || 0) + 1
          }
        })
        const topCities = Object.entries(cityCounts)
          .map(([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)

        // Top 10 spots (by rating)
        const topSpots = [...(spotsData || [])]
          .filter(s => s.rating != null)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 10)
          .map((spot, index) => ({
            ...spot,
            rank: index + 1,
            city: listsData?.find(l => l.id === spot.list_id)?.city || ''
          }))

        // Recent spots (last 5)
        const recentSpots = [...(spotsData || [])]
          .sort((a, b) => {
            const aDate = new Date(a.updated_at || a.created_at)
            const bDate = new Date(b.updated_at || b.created_at)
            return bDate - aDate
          })
          .slice(0, 5)
          .map(spot => ({
            ...spot,
            city: listsData?.find(l => l.id === spot.list_id)?.city || ''
          }))

        // Activity streak (last 7 days)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today)
          date.setDate(date.getDate() - i)
          return date.toISOString().split('T')[0]
        })

        const activityDates = new Set()
        spotsData?.forEach(spot => {
          const createdDate = new Date(spot.created_at).toISOString().split('T')[0]
          const updatedDate = new Date(spot.updated_at).toISOString().split('T')[0]
          if (last7Days.includes(createdDate) || last7Days.includes(updatedDate)) {
            activityDates.add(createdDate)
            activityDates.add(updatedDate)
          }
        })

        const lastActivityDates = last7Days.map(date => ({
          date,
          active: activityDates.has(date)
        }))

        // Calculate streak (consecutive days with activity, counting backwards from today)
        let streak = 0
        for (let i = 0; i < last7Days.length; i++) {
          if (activityDates.has(last7Days[i])) {
            streak++
          } else {
            break
          }
        }

        setStats({
          totalSpots,
          totalCities,
          averageScore,
          tierDistribution,
          categoryCounts,
          topCities,
          topSpots,
          recentSpots,
          activityStreak: streak,
          lastActivityDates
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Subscribe to changes
    const channel = supabase
      .channel('account_stats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foodspots',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchStats()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lists',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const hasProfileImage = !!user?.user_metadata?.profileImageUrl

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Bitte wähle ein Bild aus', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Bild muss kleiner als 5MB sein', 'error')
      return
    }

    setUploading(true)

    try {
      const compressedFile = await compressImage(file)
      const fileExt = 'jpg'
      const fileName = `${user.id}/avatar.${fileExt}`

      const oldAvatarPath = `${user.id}/avatar.${fileExt}`
      await supabase.storage.from('profile-avatars').remove([oldAvatarPath])

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('Der Storage-Bucket "profile-avatars" wurde nicht gefunden.')
        }
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`)
      }

      const { data: urlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName)
      
      const imageUrl = urlData?.publicUrl

      if (!imageUrl) {
        throw new Error('Konnte URL für das hochgeladene Bild nicht abrufen')
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          profileImageUrl: imageUrl
        }
      })

      if (updateError) throw updateError

      showToast('Profilbild erfolgreich aktualisiert!', 'success')
      
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      showToast('Fehler beim Hochladen. Bitte versuche es erneut.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSpotClick = (spot) => {
    if (spot.list_id) {
      // Navigate to the tier list for this spot's list
      navigate(`/tierlist/${spot.list_id}`)
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🍔</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt Profil...</p>
        </div>
      </div>
    )
  }

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
            onClick={() => navigate('/dashboard')}
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
            Profil
          </h1>

          <button
            onClick={() => navigate('/settings')}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            aria-label="Einstellungen"
          >
            <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Hero Section */}
          <div className={`rounded-[24px] shadow-lg border p-8 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="relative">
                    <Avatar size={100} showBorder={true} />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                    <input
                      id="avatar-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={uploading}
                    />
                  </div>
                </label>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className={`text-2xl font-bold mb-1 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {getUsername()}
                </h2>
                <p className={`text-sm mb-2 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  @{getUsername().toLowerCase().replace(/\s+/g, '')}
                </p>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Mitglied seit {getMemberSince()}
                </p>
                {isProfileVisibleToFriends() && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">
                      Für Freund:innen sichtbar
                    </span>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`mt-4 px-4 py-2 rounded-[14px] text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${
                    isDark
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Profil bearbeiten
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Total Spots */}
            <div className={`rounded-[20px] shadow-lg border p-4 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className={`text-2xl font-bold mb-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.totalSpots}
              </div>
              <div className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Gesamte Spots
              </div>
            </div>

            {/* Total Cities */}
            <div className={`rounded-[20px] shadow-lg border p-4 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className={`text-2xl font-bold mb-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.totalCities}
              </div>
              <div className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Städte/Orte
              </div>
            </div>

            {/* Average Score */}
            <div className={`rounded-[20px] shadow-lg border p-4 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className={`text-2xl font-bold mb-1 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.averageScore.toFixed(1)}/10
              </div>
              <div className={`text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Ø Score
              </div>
            </div>

            {/* Tier Distribution */}
            <div className={`rounded-[20px] shadow-lg border p-4 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center gap-1 mb-1">
                {['S', 'A', 'B', 'C', 'D'].map((tier) => (
                  <div key={tier} className="flex-1 flex flex-col items-center">
                    <div className={`text-xs font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {stats.tierDistribution[tier]}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 mt-1 overflow-hidden">
                      <div 
                        className={`h-full ${
                          tier === 'S' ? 'bg-red-500' :
                          tier === 'A' ? 'bg-orange-500' :
                          tier === 'B' ? 'bg-yellow-500' :
                          tier === 'C' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}
                        style={{
                          width: stats.totalSpots > 0 
                            ? `${(stats.tierDistribution[tier] / stats.totalSpots) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className={`text-xs mt-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Tier-Verteilung
              </div>
            </div>
          </div>

          {/* Category Mix */}
          {Object.keys(stats.categoryCounts).length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Kategorie-Mix
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                        isDark
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                      }`}
                    >
                      <span className="text-base">{CATEGORY_EMOJIS[category] || '🍔'}</span>
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {category}
                      </span>
                      <span className={`text-xs font-bold ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top 10 All-Time */}
          {stats.topSpots.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                🏆 Top 10 All-Time
              </h3>
              <div className="space-y-3">
                {stats.topSpots.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => handleSpotClick(spot)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
                      isDark
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      spot.rank <= 3
                        ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] text-white'
                        : isDark
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                    }`}>
                      {spot.rank}
                    </div>
                    {spot.cover_photo_url ? (
                      <img
                        src={spot.cover_photo_url}
                        alt={spot.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className={`font-semibold text-sm truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.name}
                      </div>
                      <div className={`text-xs truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {spot.city}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-sm">⭐</span>
                      <span className={`font-bold text-sm ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {spot.rating?.toFixed(1)}/10
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Activity Section */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <h3 className={`text-lg font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Aktivität
            </h3>
            
            {/* Streak */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Wochen-Streak
                </span>
                <span className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {stats.activityStreak} Tage
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {stats.lastActivityDates.reverse().map((day, index) => {
                  const date = new Date(day.date)
                  const dayName = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][date.getDay()]
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-1">
                      <div className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {dayName}
                      </div>
                      <div
                        className={`w-full aspect-square rounded-lg flex items-center justify-center ${
                          day.active
                            ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A]'
                            : isDark
                              ? 'bg-gray-700'
                              : 'bg-gray-200'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Spots */}
            {stats.recentSpots.length > 0 && (
              <div>
                <h4 className={`text-sm font-semibold mb-3 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Zuletzt hinzugefügt/aktualisiert
                </h4>
                <div className="space-y-2">
                  {stats.recentSpots.map((spot) => (
                    <button
                      key={spot.id}
                      onClick={() => handleSpotClick(spot)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all active:scale-[0.98] ${
                        isDark
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {spot.cover_photo_url ? (
                        <img
                          src={spot.cover_photo_url}
                          alt={spot.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex-shrink-0 ${
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className={`font-medium text-sm truncate ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {spot.name}
                        </div>
                        <div className={`text-xs truncate ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {spot.city}
                        </div>
                      </div>
                      <div className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {new Date(spot.updated_at || spot.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top Cities */}
          {stats.topCities.length > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Am meisten getestet in
              </h3>
              <div className="space-y-3">
                {stats.topCities.map((item, index) => (
                  <div
                    key={item.city}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, rgba(255, 157, 104, 0.1) 0%, rgba(255, 126, 66, 0.15) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 228, 195, 0.3) 0%, rgba(255, 210, 163, 0.4) 100%)'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-gradient-to-br from-[#FF7E42] to-[#FFB25A] text-white'
                          : isDark
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-200 text-gray-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {item.city}
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {item.count} {item.count === 1 ? 'Spot' : 'Spots'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Badges */}
          {stats.totalSpots > 0 && (
            <div className={`rounded-[20px] shadow-lg border p-6 ${
              isDark
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-100'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.totalSpots >= 10 && (
                  <div className={`px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      🏆 {stats.totalSpots}× Spots
                    </span>
                  </div>
                )}
                {stats.totalCities >= 5 && (
                  <div className={`px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      🌍 {stats.totalCities} Städte
                    </span>
                  </div>
                )}
                {stats.averageScore >= 9.0 && (
                  <div className={`px-3 py-2 rounded-full ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      ⭐ Ø > 9,0
                    </span>
                  </div>
                )}
                {Object.entries(stats.categoryCounts).map(([category, count]) => {
                  if (count >= 10) {
                    return (
                      <div key={category} className={`px-3 py-2 rounded-full ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <span className={`text-sm font-medium ${
                          isDark ? 'text-gray-200' : 'text-gray-700'
                        }`}>
                          {CATEGORY_EMOJIS[category] || '🍔'} {count}× {category}
                        </span>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={`rounded-[20px] shadow-lg border p-6 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-100'
          }`}>
            <h3 className={`text-lg font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Aktionen
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/settings')}
                className={`w-full text-left py-3 px-4 rounded-[14px] transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Zu Einstellungen</span>
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <button
                onClick={() => {
                  showToast('Feature kommt bald!', 'info')
                }}
                className={`w-full text-left py-3 px-4 rounded-[14px] transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Profil teilen</span>
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <button
                onClick={() => {
                  showToast('Feature kommt bald!', 'info')
                }}
                className={`w-full text-left py-3 px-4 rounded-[14px] transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Daten exportieren (CSV)</span>
                  <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          style={{ animation: 'fadeSlideDown 0.3s ease-out' }}
        >
          <div className={`rounded-[16px] px-6 py-4 shadow-xl flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 
            toast.type === 'info' ? 'bg-blue-500 text-white' :
            'bg-red-500 text-white'
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

export default Account
