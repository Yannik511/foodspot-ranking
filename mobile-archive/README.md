# Mobile App Archive

Dieser Ordner enthält die unvollständige Expo-Migration der Foodspot Ranking App.

## Status

Die Migration wurde pausiert, da sie zu tiefgreifend war und nicht vollständig funktioniert hat. Die mobile App wird später komplett neu mit Expo erstellt.

## Inhalt

- `foodspot-ranking-mobile/` - Die unvollständige Expo-App
  - Expo Router Setup
  - Auth-Komponenten (Login, Register)
  - Dashboard, TierList, CreateList (teilweise migriert)
  - Supabase-Integration
  - NativeWind Konfiguration

## Was funktioniert hat

- ✅ Expo Router Struktur
- ✅ Auth-Flow (Login, Register)
- ✅ Supabase-Client Setup
- ✅ NativeWind Konfiguration
- ✅ Dashboard mit Listenübersicht (teilweise)

## Was nicht funktioniert hat

- ❌ Network Requests im iOS Simulator/Expo Go
- ❌ Vollständige Migration aller Komponenten
- ❌ Image Upload zu Supabase Storage
- ❌ Maps-Integration

## Nächste Schritte (später)

Wenn die Vite Web-App fertig ist, sollte die mobile App komplett neu erstellt werden:
1. Neues Expo-Projekt initialisieren
2. Schrittweise Features migrieren
3. Auf physischen Geräten testen (nicht nur Simulator)
4. Development Build verwenden (nicht Expo Go)

## Hinweis

Diese Dateien dienen nur als Referenz. Die neue mobile App sollte von Grund auf neu entwickelt werden.











