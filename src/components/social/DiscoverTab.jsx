import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import Avatar from '../Avatar'
import { supabase } from '../../services/supabase'

function DiscoverTab() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [publicLists, setPublicLists] = useState([])
  const [popularProfiles, setPopularProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchDiscoverContent()
  }, [user])

  const fetchDiscoverContent = async () => {
    setLoading(true)
    try {
      // Geteilte Listen Feature deaktiviert - keine öffentlichen Listen mehr
      setPublicLists([])

      // Fetch popular profiles (users with most spots)
      // Note: This requires a view or function in Supabase
      // For now, we'll use a simple query
      const { data: spotsData } = await supabase
        .from('foodspots')
        .select('user_id')
        .limit(100)

      // Count spots per user
      const userSpotCounts = {}
      spotsData?.forEach(spot => {
        userSpotCounts[spot.user_id] = (userSpotCounts[spot.user_id] || 0) + 1
      })

      // Get top users
      const topUserIds = Object.entries(userSpotCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId]) => userId)

      // Fetch user details (this requires a users view)
      // For now, we'll create a placeholder
      setPopularProfiles([])
    } catch (error) {
      console.error('Error fetching discover content:', error)
    } finally {
      setLoading(false)
    }
  }

  const getUsername = (userData) => {
    return userData?.user_metadata?.username || userData?.email?.split('@')[0] || 'Unbekannt'
  }

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🔍</div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Lädt Entdecken...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="pb-24">
        {/* Public Lists */}
        <div className="p-4">
          <h3 className={`text-lg font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Empfohlene öffentliche Listen
          </h3>
          {publicLists.length === 0 ? (
            <div className={`text-center py-12 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="text-4xl mb-4">📋</div>
              <p className="text-sm">Noch keine öffentlichen Listen</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {publicLists.map((sharedList) => {
                const list = sharedList.list
                const owner = sharedList.owner
                if (!list) return null

                return (
                  <button
                    key={sharedList.id}
                    onClick={() => navigate(`/tierlist/${list.id}`)}
                    className={`p-3 rounded-xl text-left transition-all active:scale-95 ${
                      isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {list.cover_image_url ? (
                      <img
                        src={list.cover_image_url}
                        alt={list.list_name}
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                    ) : (
                      <div className={`w-full h-24 rounded-lg mb-2 flex items-center justify-center ${
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`}>
                        <span className="text-2xl">🍔</span>
                      </div>
                    )}
                    <p className={`font-semibold text-sm truncate mb-1 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {list.list_name}
                    </p>
                    <p className={`text-xs truncate ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {getUsername(owner)} • {sharedList.spotCount} Spots
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Popular Profiles */}
        <div className="p-4">
          <h3 className={`text-lg font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
            Beliebte Profile
          </h3>
          {popularProfiles.length === 0 ? (
            <div className={`text-center py-12 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="text-4xl mb-4">👥</div>
              <p className="text-sm">Noch keine Profile verfügbar</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {popularProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => navigate(`/friend/${profile.id}`)}
                  className={`flex-shrink-0 w-24 p-3 rounded-xl text-center transition-all active:scale-95 ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <Avatar size={48} />
                  <p className={`text-xs font-medium mt-2 truncate ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {getUsername(profile)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Placeholder for Location Feed */}
        <div className="p-4">
          <div className={`p-6 rounded-xl text-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="text-4xl mb-3">📍</div>
            <p className={`text-sm font-semibold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Standort-Feed
            </p>
            <p className={`text-xs ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Kommt bald
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DiscoverTab



