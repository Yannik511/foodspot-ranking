# 🔧 Mobile App Fix - Anleitung

## Problem

Die Web App funktioniert perfekt, aber die Mobile App hat Network/Auth Probleme.

## Ursache

Die Mobile App hatte zu viele zusätzliche Konfigurationen:
- ❌ `customFetch` mit expliziten Headers (überschreibt Supabase's interne Header)
- ❌ `flowType: 'pkce'` (nicht nötig für Email/Password)
- ❌ Zusätzliche `global.headers` (können Konflikte verursachen)

## Lösung

Die Mobile App Konfiguration wurde **vereinfacht** und der Web App angepasst:

### Vorher (kompliziert):
```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce', // ← Nicht nötig
  },
  global: {
    fetch: customFetch, // ← Problem!
    headers: {
      'x-client-info': 'foodspot-ranking-mobile',
    },
  },
})
```

### Nachher (einfach, wie Web App):
```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // Nur das Minimum für React Native
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

## Was wurde geändert

1. ✅ **Custom Fetch entfernt** - Supabase verwaltet Headers selbst
2. ✅ **flowType entfernt** - Nicht nötig für Email/Password Auth
3. ✅ **storageKey entfernt** - Supabase verwendet Standard
4. ✅ **global.headers entfernt** - Nicht nötig
5. ✅ **Nur das Minimum** - AsyncStorage für Session Storage

## Nächste Schritte

1. **Mobile App neu starten**:
   ```bash
   cd foodspot-ranking-mobile
   npm start
   ```

2. **User neu einloggen** (um Session zu aktualisieren)

3. **Testen**:
   - Login sollte funktionieren
   - Liste erstellen sollte funktionieren
   - Bild-Upload sollte funktionieren

## Falls immer noch Probleme

### iOS Simulator Network Issues

Wenn "Network request failed" weiterhin auftritt:

1. **Prüfe Internet-Verbindung** im Simulator
2. **Reset Simulator**: Device → Erase All Content and Settings
3. **Teste auf echtem Gerät** statt Simulator

### Auth Session Issues

Wenn Auth weiterhin nicht funktioniert:

1. **AsyncStorage leeren**:
   ```javascript
   import AsyncStorage from '@react-native-async-storage/async-storage'
   await AsyncStorage.clear()
   ```

2. **User neu einloggen**

3. **Prüfe Supabase Dashboard** → Auth → Users (ob User existiert)

## Vergleich: Web vs. Mobile

| Aspekt | Web App | Mobile App (vorher) | Mobile App (nachher) |
|--------|---------|---------------------|----------------------|
| **Konfiguration** | Minimal | Komplex | Minimal ✅ |
| **Storage** | localStorage (auto) | AsyncStorage | AsyncStorage ✅ |
| **Custom Fetch** | Nein | Ja (Problem!) | Nein ✅ |
| **flowType** | Standard | pkce | Standard ✅ |
| **Funktioniert** | ✅ Ja | ❌ Nein | ✅ Sollte jetzt |






