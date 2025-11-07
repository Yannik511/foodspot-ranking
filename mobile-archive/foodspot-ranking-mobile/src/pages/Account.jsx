import { useState, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import { supabase } from '../services/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { SafeAreaView } from 'react-native-safe-area-context'

function Account() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  
  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  }

  const hasProfileImage = !!user?.user_metadata?.profileImageUrl

  const handleSignOut = async () => {
    await signOut()
    router.replace('/')
  }

  const handleImageChange = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        showToast('Berechtigung für Fotos wurde nicht erteilt', 'error')
        return
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (result.canceled) return

      const image = result.assets[0]
      if (!image) return

      setUploading(true)

      // Resize and compress image
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        image.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )

      // Convert to blob
      const response = await fetch(manipulatedImage.uri)
      const blob = await response.blob()

      // Upload to storage
      const fileExt = 'jpg'
      const fileName = `${user.id}/avatar.${fileExt}`

      // Delete old avatar if exists
      await supabase.storage.from('profile-avatars').remove([fileName])

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName)

      const imageUrl = urlData?.publicUrl

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
      
      // Reload user data
      setTimeout(() => {
        router.replace('/(tabs)/account')
      }, 1000)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      showToast(error.message || 'Fehler beim Hochladen. Bitte versuche es erneut.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Account & Einstellungen</Text>

          <View style={styles.placeholder} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Profile Section */}
          <View style={styles.card}>
            <View style={styles.profileSection}>
              <Avatar size={80} showBorder={true} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{getUsername()}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
            </View>

            {/* Profile Image Upload */}
            <Pressable
              style={({ pressed }) => [
                styles.uploadButton,
                pressed && styles.uploadButtonPressed,
                uploading && styles.uploadButtonDisabled,
              ]}
              onPress={handleImageChange}
              disabled={uploading}
            >
              <Text style={styles.uploadButtonText}>
                {uploading ? 'Wird hochgeladen...' : hasProfileImage ? 'Profilbild ändern' : 'Profilbild hinzufügen'}
              </Text>
            </Pressable>
          </View>

          {/* Settings Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Einstellungen</Text>
            <View style={styles.settingsList}>
              <Pressable style={styles.settingItem}>
                <Text style={styles.settingText}>Benachrichtigungen</Text>
              </Pressable>
              <Pressable style={styles.settingItem}>
                <Text style={styles.settingText}>Datenschutz</Text>
              </Pressable>
            </View>
          </View>

          {/* Sign Out */}
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Abmelden</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Toast */}
      {toast && (
        <View style={[
          styles.toast,
          toast.type === 'success' ? styles.toastSuccess : styles.toastError
        ]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  backButtonText: {
    fontSize: 20,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'System',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    fontFamily: 'System',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  uploadButton: {
    backgroundColor: '#FF7E42',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'System',
  },
  settingsList: {
    gap: 12,
  },
  settingItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'System',
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signOutButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  toast: {
    position: 'absolute',
    top: 80,
    left: '50%',
    transform: [{ translateX: -150 }],
    width: 300,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
  },
  toastSuccess: {
    backgroundColor: '#10B981',
  },
  toastError: {
    backgroundColor: '#EF4444',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
})

export default Account

