import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import 'react-native-url-polyfill/auto'

// Expo lädt Umgebungsvariablen automatisch aus .env
// Verwende process.env oder Constants.expoConfig.extra
// Wichtig: process.env.EXPO_PUBLIC_* Variablen werden automatisch von Expo geladen
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey
const mapsApiKey = process.env.EXPO_PUBLIC_MAPS_API_KEY || Constants.expoConfig?.extra?.mapsApiKey

// Export für Maps
export { mapsApiKey }

// Validiere URL-Format
const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  // Prüfe auf leere Strings oder nur Whitespace
  if (url.trim() === '') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// Debug: Zeige alle verfügbaren Umgebungsvariablen
console.log('=== Supabase Config Debug ===')
console.log('process.env.EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING')
console.log('Constants.expoConfig?.extra?.supabaseUrl:', Constants.expoConfig?.extra?.supabaseUrl ? 'SET' : 'MISSING')
console.log('Final supabaseUrl:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING')

if (!supabaseUrl || !isValidUrl(supabaseUrl)) {
  console.error('❌ Missing or invalid Supabase URL!')
  console.error('Please ensure:')
  console.error('1. .env file exists in foodspot-ranking-mobile/ directory')
  console.error('2. EXPO_PUBLIC_SUPABASE_URL is set in .env file')
  console.error('3. Restart Expo server after adding .env file')
  console.error('4. URL must start with http:// or https://')
  throw new Error('Missing or invalid EXPO_PUBLIC_SUPABASE_URL. Please check .env file and restart Expo server.')
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  console.error('❌ Missing Supabase Anon Key!')
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_ANON_KEY is set in .env file')
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Please check .env file and restart Expo server.')
}

// React Native optimierte Konfiguration
// Wichtig: Expo Go hat manchmal Probleme mit fetch - verwende native fetch wenn möglich
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Explizite fetch-Funktion für React Native Kompatibilität
  global: {
    fetch: fetch,
  },
})

// Network-Test entfernt - verursacht Probleme im iOS Simulator
// Expo Go im iOS Simulator hat bekannte Network-Limitations
// Lösung: Development Build erstellen (npx expo run:ios) oder physisches Gerät verwenden

// Log Supabase configuration (for debugging) - FULL VALUES for comparison
console.log('=== Supabase Config (Mobile) ===')
console.log('Full Supabase URL:', supabaseUrl)
console.log('Full Supabase Anon Key:', supabaseAnonKey)
console.log('URL matches Web App:', supabaseUrl === 'https://cvkyvhkwsylmzlrdlbxz.supabase.co')
console.log('Key starts with:', supabaseAnonKey?.substring(0, 30))

