# Foodspot Ranking Mobile App

Native Mobile App für iOS und Android, erstellt mit Expo und React Native.

## 🚀 Setup

### 1. Umgebungsvariablen einrichten

Erstelle eine `.env` Datei im Root-Verzeichnis:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. App starten

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Expo Go (QR Code scannen)
npm start
```

## 📱 Features

- ✅ Landing Page
- ✅ Login & Register
- ✅ Supabase Integration
- ✅ Navigation (React Navigation)
- ✅ NativeWind Styling

## 🔄 Migration Status

### ✅ Abgeschlossen
- Phase 1: Expo Setup & Dependencies
- Phase 2: Supabase Service & AuthContext
- Phase 3: Navigation Setup
- Phase 5: Landing, Login, Register Pages

### 🚧 In Arbeit
- Dashboard
- CreateList
- SelectCategory
- TierList
- AddFoodspot
- Account

## 📚 Technologie-Stack

- **Expo** - React Native Framework
- **React Navigation** - Navigation
- **Supabase** - Backend & Auth
- **NativeWind** - Tailwind CSS für React Native
- **AsyncStorage** - Lokale Datenspeicherung

## 🔧 Entwicklung

Die App befindet sich im Ordner `foodspot-ranking-mobile/` und läuft parallel zur Web-App im Root-Verzeichnis.

