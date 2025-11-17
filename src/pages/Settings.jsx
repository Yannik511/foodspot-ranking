import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'
import { hapticFeedback } from '../utils/haptics'
import { springEasing } from '../utils/animations'

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
              // If still too large, compress more
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

function Settings() {
  const { user, signOut } = useAuth()
  const { darkMode, isDark, setDarkMode } = useTheme()
  const navigate = useNavigate()
  
  // Form state
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accentColor, setAccentColor] = useState('orange') // 'orange' | 'neutral'
  const [notificationsNewRatings, setNotificationsNewRatings] = useState(true)
  const [notificationsSharedLists, setNotificationsSharedLists] = useState(true)
  const [notificationsFriendRequests, setNotificationsFriendRequests] = useState(true)
  const [profileVisibility, setProfileVisibility] = useState('private') // 'private' | 'friends'
  const [pullToRefresh, setPullToRefresh] = useState(true)
  const [autoSync, setAutoSync] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const fileInputRef = useRef(null)
  
  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  }
  
  const getDisplayNameFromUser = () => {
    return user?.user_metadata?.display_name || getUsername()
  }
  
  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      setUsername(getUsername())
      setDisplayName(getDisplayNameFromUser())
      // Load profile visibility (default: 'private')
      const visibility = user?.user_metadata?.profile_visibility || 'private'
      setProfileVisibility(visibility)
    }
  }, [user])
  
  // Validate username
  useEffect(() => {
    if (username && username !== getUsername()) {
      // Username validation
      if (username.length < 3) {
        setUsernameError('Benutzername muss mindestens 3 Zeichen lang sein')
      } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setUsernameError('Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten')
      } else {
        setUsernameError('')
      }
    } else {
      setUsernameError('')
    }
  }, [username, user])
  
  // Validate password
  useEffect(() => {
    // Only validate if user is trying to change password
    if (newPassword || confirmPassword || currentPassword) {
      if (newPassword && newPassword.length > 0 && newPassword.length < 6) {
        setPasswordError('Passwort muss mindestens 6 Zeichen lang sein')
      } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        setPasswordError('Passwörter stimmen nicht überein')
      } else if (newPassword && !currentPassword) {
        setPasswordError('Bitte gib dein aktuelles Passwort ein')
      } else {
        setPasswordError('')
      }
    } else {
      setPasswordError('')
    }
  }, [currentPassword, newPassword, confirmPassword])
  
  useEffect(() => {
    // Check if there are any changes
    const originalDisplayName = getDisplayNameFromUser()
    const originalUsername = getUsername()
    
    const originalVisibility = user?.user_metadata?.profile_visibility || 'private'
    
    const changed = 
      (displayName !== originalDisplayName && displayName.trim() !== '') ||
      (username !== originalUsername && username.trim() !== '' && !usernameError) ||
      (currentPassword !== '' && newPassword !== '' && !passwordError) ||
      (profileVisibility !== originalVisibility)
    
    setHasChanges(changed)
  }, [displayName, username, currentPassword, newPassword, confirmPassword, usernameError, passwordError, profileVisibility, user])
  
  const handleSave = async () => {
    if (!hasChanges || loading) return
    
    // Clear previous messages
    setError('')
    setSuccess('')
    
    // Validate before save
    if (usernameError) {
      setError(usernameError)
      hapticFeedback.error()
      return
    }
    
    if (passwordError) {
      setError(passwordError)
      hapticFeedback.error()
      return
    }
    
    // Validate password if password change is attempted
    if (newPassword && !currentPassword) {
      setError('Bitte gib dein aktuelles Passwort ein')
      hapticFeedback.error()
      return
    }
    
    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      hapticFeedback.error()
      return
    }
    
    setLoading(true)
    hapticFeedback.medium()
    
    try {
      const updates = {}
      let hasUsernameUpdate = false
      let hasPasswordUpdate = false
      
      // Update username and profile visibility if changed
      const metadataUpdates = { ...user?.user_metadata }
      let hasMetadataUpdate = false
      
      if (username && username !== getUsername() && !usernameError) {
        hasUsernameUpdate = true
        metadataUpdates.username = username.trim()
        hasMetadataUpdate = true
      }
      
      const originalVisibility = user?.user_metadata?.profile_visibility || 'private'
      if (profileVisibility !== originalVisibility) {
        metadataUpdates.profile_visibility = profileVisibility
        hasMetadataUpdate = true
      }
      
      if (hasMetadataUpdate) {
        updates.data = metadataUpdates
      }
      
      // Update password if changed
      // Note: Supabase requires re-authentication for password changes in some cases
      // We'll update password separately if needed
      if (newPassword && currentPassword && !passwordError) {
        hasPasswordUpdate = true
        // For password update, we need to verify the current password first
        // Supabase will handle this, but we can also update password separately
        updates.password = newPassword
      }
      
      // Only update if there are changes
      if (hasMetadataUpdate || hasPasswordUpdate) {
        // If both metadata and password need update, do them separately
        if (hasMetadataUpdate && hasPasswordUpdate) {
          // First update metadata (username + profile_visibility)
          const { error: metadataError } = await supabase.auth.updateUser({
            data: metadataUpdates
          })
          
          if (metadataError) {
            if (metadataError.message.includes('username') || metadataError.message.includes('unique')) {
              setError('Dieser Benutzername ist bereits vergeben')
            } else {
              setError(metadataError.message || 'Fehler beim Speichern der Einstellungen')
            }
            hapticFeedback.error()
            setLoading(false)
            return
          }
          
          // Then update password
          const { error: passwordUpdateError } = await supabase.auth.updateUser({
            password: newPassword
          })
          
          if (passwordUpdateError) {
            setError('Fehler beim Ändern des Passworts. Bitte stelle sicher, dass dein aktuelles Passwort korrekt ist.')
            hapticFeedback.error()
            setLoading(false)
            return
          }
        } else if (hasMetadataUpdate) {
          // Only metadata update
          const { error: updateError } = await supabase.auth.updateUser({
            data: metadataUpdates
          })
          
          if (updateError) {
            if (updateError.message.includes('username') || updateError.message.includes('unique')) {
              setError('Dieser Benutzername ist bereits vergeben')
            } else {
              setError(updateError.message || 'Fehler beim Speichern der Einstellungen')
            }
            hapticFeedback.error()
            setLoading(false)
            return
          }
        } else if (hasPasswordUpdate) {
          // Only password update
          const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
          })
          
          if (updateError) {
            setError('Fehler beim Ändern des Passworts. Bitte stelle sicher, dass dein aktuelles Passwort korrekt ist.')
            hapticFeedback.error()
            setLoading(false)
            return
          }
        }
        
        // Success
        hapticFeedback.success()
        setSuccess('Änderungen erfolgreich gespeichert!')
        
        // Reset password fields
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setHasChanges(false)
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess('')
        }, 3000)
        
        // The auth state change will automatically update the user object via AuthContext
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.')
      hapticFeedback.error()
    } finally {
      setLoading(false)
    }
  }
  
  const handleSignOut = async () => {
    hapticFeedback.medium()
    const { error } = await signOut()
    if (!error) {
      navigate('/', { replace: true })
    }
  }
  
  const handleDarkModeChange = (mode) => {
    hapticFeedback.light()
    setDarkMode(mode)
  }
  
  const handleAbout = () => {
    hapticFeedback.light()
    navigate('/about')
  }

  const handleChangelog = () => {
    hapticFeedback.light()
    // TODO: Navigate to changelog page or show modal
    alert('Changelog wird angezeigt... (bald verfügbar)')
  }

  const handleSendFeedback = () => {
    hapticFeedback.light()
    // TODO: Open feedback form or email
    window.location.href = 'mailto:feedback@rankify.app?subject=Rankify Feedback'
  }

  const handleClearCache = async () => {
    hapticFeedback.medium()
    if (!window.confirm('Möchtest du wirklich den Cache leeren? Lokale Daten werden gelöscht.')) {
      return
    }
    try {
      // Clear localStorage and sessionStorage (UI data only)
      localStorage.clear()
      sessionStorage.clear()
      hapticFeedback.success()
      setSuccess('Cache erfolgreich geleert!')
      setTimeout(() => {
        setSuccess('')
      }, 3000)
    } catch (err) {
      console.error('Error clearing cache:', err)
      setError('Fehler beim Leeren des Caches')
      hapticFeedback.error()
    }
  }
  
  const handleBack = () => {
    hapticFeedback.light()
    navigate(-1)
  }
  
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Bitte wähle ein Bild aus')
      hapticFeedback.error()
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Bild muss kleiner als 5MB sein')
      hapticFeedback.error()
      return
    }

    setUploadingAvatar(true)
    setError('')
    hapticFeedback.medium()

    try {
      // Compress image
      const compressedFile = await compressImage(file)
      
      // Upload to storage
      const fileExt = 'jpg'
      const fileName = `${user.id}/avatar.${fileExt}`

      // Delete old avatar if exists (ignore errors if file doesn't exist)
      const oldAvatarPath = `${user.id}/avatar.${fileExt}`
      await supabase.storage.from('profile-avatars').remove([oldAvatarPath])

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('Der Storage-Bucket "profile-avatars" wurde nicht gefunden. Bitte erstelle ihn in Supabase.')
        }
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy') || uploadError.message?.includes('permission')) {
          throw new Error('Keine Berechtigung zum Hochladen. Die Storage Policies fehlen oder sind falsch.')
        }
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`)
      }

      // Get public URL
      let imageUrl
      const { data: urlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName)
      
      imageUrl = urlData?.publicUrl

      // If public URL doesn't work, try signed URL
      if (!imageUrl) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('profile-avatars')
          .createSignedUrl(fileName, 31536000) // 1 year in seconds
        
        if (!signedError && signedData?.signedUrl) {
          imageUrl = signedData.signedUrl
        }
      }

      if (!imageUrl) {
        throw new Error('Konnte URL für das hochgeladene Bild nicht abrufen')
      }

      // Update user metadata with cache busting
      const imageUrlWithCache = `${imageUrl}?v=${Date.now()}`
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...user?.user_metadata,
          profileImageUrl: imageUrlWithCache
        }
      })

      if (updateError) throw updateError

      // WICHTIG: Auch user_profiles Tabelle aktualisieren!
      // (Damit Freunde und geteilte Listen das Avatar sehen)
      try {
        await supabase
          .from('user_profiles')
          .update({ profile_image_url: imageUrlWithCache })
          .eq('id', user.id)
      } catch (profileUpdateErr) {
        console.warn('Could not update user_profiles table:', profileUpdateErr)
        // Nicht kritisch - auth.users ist die Hauptquelle
      }

      hapticFeedback.success()
      setSuccess('Profilbild erfolgreich aktualisiert!')
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('')
      }, 3000)
      
      // The auth state change will automatically update the user object via AuthContext
      // Avatar will update automatically through the user context update
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError(err.message || 'Fehler beim Hochladen. Bitte versuche es erneut.')
      hapticFeedback.error()
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  
  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      hapticFeedback.light()
      fileInputRef.current.click()
    }
  }
  
  // isDark is now from ThemeContext
  
  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'} relative overflow-hidden`}>
      {/* Header */}
      <header 
        className={`header-safe ${isDark ? 'bg-gray-800' : 'bg-white'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between fixed top-0 left-0 right-0 z-10`}
        style={{
          paddingLeft: 'clamp(16px, 4vw, 24px)',
          paddingRight: 'clamp(16px, 4vw, 24px)'
        }}
      >
        <button
          onClick={handleBack}
          className="flex items-center justify-center"
          style={{
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
          }}
          aria-label="Zurück"
        >
          <svg 
            className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-900'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h1 
          className={`${isDark ? 'text-white' : 'text-gray-900'} flex-1 text-center px-2`}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(16px, 4vw, 18px)',
            lineHeight: '1.2',
          }}
        >
          Einstellungen
        </h1>
        
        <div style={{ width: '44px', height: '44px' }} />
      </header>
      
      {/* Content */}
      <main 
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: `calc(60px + env(safe-area-inset-top, 0px) + 12px + 24px)`,
          paddingBottom: `calc(80px + env(safe-area-inset-bottom, 0px) + 24px)`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Error/Success Messages */}
        {error && (
          <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-800 dark:text-red-300 text-sm font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {error}
            </p>
          </div>
        )}
        
        {success && (
          <div className="mx-4 mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <p className="text-green-800 dark:text-green-300 text-sm font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {success}
            </p>
          </div>
        )}
        {/* Account Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              Account
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-4">
            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="relative"
                  style={{
                    width: '64px',
                    height: '64px',
                    minWidth: '64px',
                    minHeight: '64px',
                  }}
                  aria-label="Profilbild ändern"
                >
                  <Avatar 
                    size={64} 
                    className="flex-shrink-0"
                  />
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium mb-1`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Profilbild
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className={`${isDark ? 'text-[#FF7E42] hover:text-[#FF6B2E]' : 'text-[#FF7E42] hover:text-[#FF6B2E]'} text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {uploadingAvatar ? 'Wird hochgeladen...' : 'Profilbild ändern'}
                </button>
              </div>
            </div>
            
            {/* Display Name */}
            <div>
              <label 
                htmlFor="displayName"
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Anzeigename
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dein Anzeigename"
                disabled
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-[#FF7E42] disabled:opacity-50`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                (bald verfügbar)
              </p>
            </div>
            
            {/* Username */}
            <div>
              <label 
                htmlFor="username"
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="dein-username"
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  usernameError
                    ? 'border-red-500'
                    : isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-[#FF7E42]`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              {usernameError && (
                <p className={`mt-1 text-xs text-red-500`} style={{ fontFamily: "'Inter', sans-serif" }}>
                  {usernameError}
                </p>
              )}
              {!usernameError && username !== getUsername() && username.length > 0 && (
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                  Mindestens 3 Zeichen, nur Buchstaben, Zahlen und Unterstriche
                </p>
              )}
            </div>
            
            {/* Email (read-only) */}
            <div>
              <label 
                htmlFor="email"
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                readOnly
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-400' 
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                } focus:outline-none cursor-not-allowed`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            
            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 active:scale-[0.98] transition-all"
              style={{ 
                fontFamily: "'Poppins', sans-serif",
                transition: `all 0.2s ${springEasing.default}`
              }}
            >
              Abmelden
            </button>
          </div>
        </section>
        
        {/* Security Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              Sicherheit
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-4">
            {/* Current Password */}
            <div>
              <label 
                htmlFor="currentPassword"
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Aktuelles Passwort
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  passwordError && !currentPassword
                    ? 'border-red-500'
                    : isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-[#FF7E42]`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            
            {/* New Password */}
            <div>
              <label 
                htmlFor="newPassword"
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Neues Passwort
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  passwordError && newPassword
                    ? 'border-red-500'
                    : isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-[#FF7E42]`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            
            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="confirmPassword"
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Passwort bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort bestätigen"
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  passwordError && confirmPassword
                    ? 'border-red-500'
                    : isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-[#FF7E42]`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              {passwordError && (
                <p className={`mt-1 text-xs text-red-500`} style={{ fontFamily: "'Inter', sans-serif" }}>
                  {passwordError}
                </p>
              )}
              {!passwordError && newPassword && newPassword.length >= 6 && (
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                  Passwort muss mindestens 6 Zeichen lang sein
                </p>
              )}
            </div>
          </div>
        </section>
        
        {/* Appearance Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              Darstellung
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-4">
            {/* Dark Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Dark Mode
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {darkMode === 'system' && 'System'}
                  {darkMode === 'light' && 'Hell'}
                  {darkMode === 'dark' && 'Dunkel'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDarkModeChange('light')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    darkMode === 'light'
                      ? 'bg-[#FF7E42] text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Hell
                </button>
                <button
                  onClick={() => handleDarkModeChange('system')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    darkMode === 'system'
                      ? 'bg-[#FF7E42] text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  System
                </button>
                <button
                  onClick={() => handleDarkModeChange('dark')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    darkMode === 'dark'
                      ? 'bg-[#FF7E42] text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Dunkel
                </button>
              </div>
            </div>

            {/* Accent Color */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Akzentfarbe
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {accentColor === 'orange' && 'Orange/Coral'}
                  {accentColor === 'neutral' && 'Neutral'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    hapticFeedback.light()
                    setAccentColor('orange')
                  }}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    accentColor === 'orange'
                      ? 'bg-[#FF7E42] text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Orange
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.light()
                    setAccentColor('neutral')
                  }}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    accentColor === 'neutral'
                      ? 'bg-[#FF7E42] text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Neutral
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              Datenschutz
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-4">
            {/* Profile Visibility */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Profil & Statistiken für Freund:innen sichtbar
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {profileVisibility === 'friends' 
                    ? 'Freund:innen können deine Statistiken sehen und dich vergleichen'
                    : 'Nur Avatar, Name und Username werden angezeigt'}
                </p>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setProfileVisibility(profileVisibility === 'friends' ? 'private' : 'friends')
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  profileVisibility === 'friends' ? 'bg-[#FF7E42]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    profileVisibility === 'friends' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              Benachrichtigungen
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-4">
            {/* New Ratings */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Neue Bewertungen
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Benachrichtigungen zu eigenen Listen
                </p>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setNotificationsNewRatings(!notificationsNewRatings)
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notificationsNewRatings ? 'bg-[#FF7E42]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notificationsNewRatings ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Shared Lists */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Geteilte Listen
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Benachrichtigungen wenn jemand eine Liste teilt
                </p>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setNotificationsSharedLists(!notificationsSharedLists)
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notificationsSharedLists ? 'bg-[#FF7E42]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notificationsSharedLists ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Friend Requests */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Freundschaftsanfragen
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Benachrichtigungen für neue Anfragen
                </p>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setNotificationsFriendRequests(!notificationsFriendRequests)
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notificationsFriendRequests ? 'bg-[#FF7E42]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notificationsFriendRequests ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Data & Sync Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              Daten & Sync
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-4">
            {/* Pull to Refresh */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Pull-to-Refresh
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Aktiviere Pull-to-Refresh für manuelles Aktualisieren
                </p>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setPullToRefresh(!pullToRefresh)
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  pullToRefresh ? 'bg-[#FF7E42]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    pullToRefresh ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Auto Sync */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <p 
                  className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-medium`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Bei Start automatisch syncen
                </p>
                <p 
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm mt-1`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Daten beim App-Start automatisch synchronisieren
                </p>
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light()
                  setAutoSync(!autoSync)
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoSync ? 'bg-[#FF7E42]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    autoSync ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Clear Cache */}
            <button
              onClick={handleClearCache}
              className={`w-full text-left py-3 pt-4 border-t border-gray-200 dark:border-gray-700 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              } hover:opacity-80 transition-opacity`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Cache leeren (nur UI-Daten)
            </button>
          </div>
        </section>

        {/* Language Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              App-Sprache
            </h2>
          </div>
          
          <div className="px-4 py-4">
            {/* Language */}
            <div>
              <label 
                className={`block ${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Sprache
              </label>
              <div className="flex gap-2">
                <button
                  disabled
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all bg-[#FF7E42] text-white opacity-50 cursor-not-allowed`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Deutsch
                </button>
                <button
                  disabled
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                    isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  } opacity-50 cursor-not-allowed`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  English (bald verfügbar)
                </button>
              </div>
            </div>
          </div>
        </section>
        
        {/* App Info Section */}
        <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} mt-4 mx-4 rounded-2xl overflow-hidden shadow-sm`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 
              className={`${isDark ? 'text-gray-200' : 'text-gray-900'} font-semibold`}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}
            >
              App-Info
            </h2>
          </div>
          
          <div className="px-4 py-4 space-y-0">
            {/* Version */}
            <div className={`py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <span 
                className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Version
              </span>
              <span 
                className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                1.0.0
              </span>
            </div>

            {/* Changelog */}
            <button
              onClick={handleChangelog}
              className={`w-full text-left py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isDark ? 'text-gray-300' : 'text-gray-700'} hover:opacity-80 transition-opacity`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Changelog
            </button>

            {/* About */}
            <button
              onClick={handleAbout}
              className={`w-full text-left py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isDark ? 'text-gray-300' : 'text-gray-700'} hover:opacity-80 transition-opacity`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Über Rankify
            </button>

            {/* Send Feedback */}
            <button
              onClick={handleSendFeedback}
              className={`w-full text-left py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'} hover:opacity-80 transition-opacity`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Feedback senden
            </button>
          </div>
        </section>
      </main>
      
      {/* Bottom Action Bar */}
      <div 
        className={`fixed bottom-0 left-0 right-0 ${isDark ? 'bg-gray-800' : 'bg-white'} border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} px-4 py-3 flex gap-3`}
        style={{
          paddingBottom: `max(12px, env(safe-area-inset-bottom))`,
        }}
      >
        <button
          onClick={handleBack}
          className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          style={{ 
            fontFamily: "'Poppins', sans-serif",
            transition: `all 0.2s ${springEasing.default}`
          }}
        >
          Zurück
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || loading || !!usernameError || !!passwordError}
          className={`flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-all ${
            hasChanges && !loading && !usernameError && !passwordError
              ? 'bg-[#FF7E42] text-white hover:bg-[#FF6B2E]'
              : isDark
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          style={{ 
            fontFamily: "'Poppins', sans-serif",
            transition: `all 0.2s ${springEasing.default}`
          }}
        >
          {loading ? 'Wird gespeichert...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

export default Settings

