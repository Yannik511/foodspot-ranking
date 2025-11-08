# 🔍 Mobile vs. Web App - Analyse

## Problem

**Web App funktioniert perfekt** ✅
**Mobile App hat Network/Auth Probleme** ❌

## Unterschiede

### Web App (`src/services/supabase.js`)
```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
- **Einfach**: Keine speziellen Konfigurationen
- **Funktioniert**: Supabase setzt alles automatisch
- **Storage**: Browser localStorage (automatisch)

### Mobile App (`foodspot-ranking-mobile/src/services/supabase.js`)
```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
  },
  global: {
    fetch: customFetch, // ← PROBLEM!
    headers: {
      'x-client-info': 'foodspot-ranking-mobile',
    },
  },
})
```

## Probleme

### 1. Custom Fetch überschreibt Headers
Der `customFetch` setzt explizit `apikey` und `Authorization` Header, was Supabase's interne Header-Verwaltung stören kann.

### 2. flowType: 'pkce'
PKCE ist für OAuth-Flows, nicht für Email/Password. Kann Probleme verursachen.

### 3. iOS Simulator Network Issues
"Network request failed" ist ein bekanntes Problem im iOS Simulator.

## Lösung

Vereinfache die Mobile App Konfiguration und nähere sie der Web App an.






