import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../../contexts/AuthContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'

// LocalAuthentication optional - funktioniert nur in Development Builds, nicht in Expo Go
let LocalAuthentication = null
try {
  LocalAuthentication = require('expo-local-authentication')
} catch (e) {
  console.log('expo-local-authentication not available (normal in Expo Go)')
}

function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  // Check for biometric authentication
  useEffect(() => {
    const checkBiometric = async () => {
      if (!LocalAuthentication) return
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync()
        const enrolled = await LocalAuthentication.isEnrolledAsync()
        if (compatible && enrolled) {
          setBiometricAvailable(true)
        }
      } catch (err) {
        console.log('Biometric not available:', err.message)
      }
    }
    checkBiometric()
  }, [])

  // Load saved credentials
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('foodspot_saved_email')
        const savedRemember = await AsyncStorage.getItem('foodspot_remember_me')
        
        if (savedEmail && savedRemember === 'true') {
          setEmailOrUsername(savedEmail)
          setRememberMe(true)
        }
      } catch (err) {
        console.error('Error loading saved credentials:', err)
      }
    }
    loadSavedCredentials()
  }, [])

  const handleBiometricLogin = async () => {
    if (!biometricAvailable || !LocalAuthentication) return
    
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authentifizierung für Foodspot Ranker',
        cancelLabel: 'Abbrechen',
        disableDeviceFallback: false,
      })

      if (result.success) {
        // Load saved credentials and auto-login
        const savedEmail = await AsyncStorage.getItem('foodspot_saved_email')
        const savedPassword = await AsyncStorage.getItem('foodspot_saved_password')
        
        if (savedEmail && savedPassword) {
          const { data, error } = await signIn(savedEmail, savedPassword)
          if (error) {
            Alert.alert('Fehler', 'Biometrische Anmeldung fehlgeschlagen. Bitte melde dich manuell an.')
          } else if (data?.user) {
            router.replace('/(tabs)/dashboard')
          }
        } else {
          Alert.alert('Info', 'Keine gespeicherten Anmeldedaten gefunden. Bitte melde dich manuell an.')
        }
      }
    } catch (err) {
      console.log('Biometric login not available:', err.message)
      // Silent fail - user can still login manually
    }
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      let email = emailOrUsername
      
      if (!emailOrUsername.includes('@')) {
        setError('Bitte gib eine gültige E-Mail-Adresse ein')
        setLoading(false)
        return
      }
      
      const { data, error } = await signIn(email, password)
      
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (data?.user) {
        // Save password if "Remember Me" is enabled
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('foodspot_saved_email', emailOrUsername)
            await AsyncStorage.setItem('foodspot_remember_me', 'true')
            await AsyncStorage.setItem('foodspot_saved_password', password)
          } else {
            await AsyncStorage.removeItem('foodspot_saved_email')
            await AsyncStorage.removeItem('foodspot_remember_me')
            await AsyncStorage.removeItem('foodspot_saved_password')
          }
        } catch (err) {
          console.error('Error saving credentials:', err)
        }
        
        router.replace('/(tabs)/dashboard')
      }
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.background}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Back Button */}
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed === true ? styles.backButtonPressed : null,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>

          <View style={styles.formContainer}>
            <View style={styles.card}>
              {/* Icon - Einzelnes Buch */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E53', '#FF6B9D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Text style={styles.iconText}>📖</Text>
                </LinearGradient>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Melde dich an</Text>
                <Text style={styles.subtitle}>Willkommen zurück bei Foodspot Ranker</Text>
              </View>

              {/* Error Message */}
              {error !== '' ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Biometric Login Button */}
              {biometricAvailable && (
                <Pressable
                  style={({ pressed }) => [
                    styles.biometricButton,
                    pressed === true ? styles.biometricButtonPressed : null,
                  ]}
                  onPress={handleBiometricLogin}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.biometricButtonGradient}
                  >
                    <Text style={styles.biometricIcon}>🔒</Text>
                    <Text style={styles.biometricButtonText}>Mit Face ID / Touch ID anmelden</Text>
                  </LinearGradient>
                </Pressable>
              )}

              {/* Form */}
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>E-Mail oder Username</Text>
                  <TextInput
                    style={styles.input}
                    value={emailOrUsername}
                    onChangeText={setEmailOrUsername}
                    placeholder="deine@email.de oder username"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Passwort</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Remember Me */}
                <Pressable
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe === true ? styles.checkboxChecked : null]}>
                    {rememberMe === true ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={{ width: 10 }} />
                  <Text style={styles.checkboxLabel}>Passwort speichern</Text>
                </Pressable>

                {/* Submit Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    (loading === true || pressed === true) ? styles.submitButtonDisabled : null,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading === true}
                >
                  <Text style={styles.submitButtonText}>
                    {loading === true ? 'Wird angemeldet...' : 'Login'}
                  </Text>
                </Pressable>
              </View>

              {/* Register Link */}
              <View style={styles.linkContainer}>
                <Text style={styles.linkText}>
                  Noch kein Account?{' '}
                  <Text
                    style={styles.link}
                    onPress={() => router.push('/(auth)/register')}
                  >
                    Jetzt registrieren
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: '#FFF5E6',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  backButtonText: {
    fontSize: 20,
    color: '#1F2937',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  iconText: {
    fontSize: 32,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '500',
  },
  biometricButton: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  biometricButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  biometricButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  biometricIcon: {
    fontSize: 20,
  },
  biometricButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
  },
  link: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
})

export default Login
