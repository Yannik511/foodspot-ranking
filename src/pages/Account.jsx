import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'

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

function Account() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  
  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  }

  const hasProfileImage = !!user?.user_metadata?.profileImageUrl

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

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
      // Compress image
      const compressedFile = await compressImage(file)
      
      // Upload to storage (direct approach, same as list-covers)
      const fileExt = 'jpg'
      const fileName = `${user.id}/avatar.${fileExt}`

      // Delete old avatar if exists (ignore errors if file doesn't exist)
      const oldAvatarPath = `${user.id}/avatar.${fileExt}`
      await supabase.storage.from('profile-avatars').remove([oldAvatarPath])

      // Upload new avatar (direct upload, like list-covers)
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        console.error('Error details:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError
        })
        
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('Der Storage-Bucket "profile-avatars" wurde nicht gefunden. Bitte erstelle ihn in Supabase (Storage → New Bucket → Name: profile-avatars, Public: AUS).')
        }
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy') || uploadError.message?.includes('permission')) {
          throw new Error('Keine Berechtigung zum Hochladen. Die Storage Policies fehlen oder sind falsch. Bitte führe AVATAR_SETUP_FIX.sql in Supabase SQL Editor aus.')
        }
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`)
      }

      // Get public URL (try public first, then signed if bucket is private)
      let imageUrl
      
      // Try public URL first
      const { data: urlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName)
      
      imageUrl = urlData?.publicUrl
      
      // If public URL doesn't work or bucket is private, try signed URL
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

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          profileImageUrl: imageUrl
        }
      })

      if (updateError) throw updateError

      showToast('Profilbild erfolgreich aktualisiert!', 'success')
      
      // Reload page to update avatar everywhere
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Account & Einstellungen
          </h1>

          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Profile Section */}
          <div className="bg-white rounded-[20px] shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar size={80} showBorder={true} />
              <div>
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {getUsername()}
                </h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>

            {/* Profile Image Upload */}
            <div className="block">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] hover:from-[#FF9357] hover:to-[#FFB25A] rounded-[14px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed dark:from-[#FF9357] dark:to-[#B85C2C]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Wird hochgeladen...
                  </span>
                ) : (
                  hasProfileImage ? 'Profilbild ändern' : 'Profilbild hinzufügen'
                )}
              </button>
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-white rounded-[20px] shadow-lg border border-gray-100 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Einstellungen
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-[14px] transition-colors">
                <span className="font-medium text-gray-700">Benachrichtigungen</span>
              </button>
              <button className="w-full text-left py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-[14px] transition-colors">
                <span className="font-medium text-gray-700">Datenschutz</span>
              </button>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full py-4 rounded-[20px] font-semibold text-lg bg-red-500 text-white shadow-lg hover:bg-red-600 transition-all active:scale-[0.98]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Abmelden
          </button>
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

export default Account

