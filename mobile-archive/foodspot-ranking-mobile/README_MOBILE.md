# Foodspot Ranking - Mobile App (Expo)

**WICHTIG: Diese mobile App ist komplett unabhängig von der Web-App (Vite)!**

## Struktur

```
foodspot-ranking-mobile/
├── app/                    # Expo Router - Routing-Struktur
│   ├── _layout.jsx        # Root Layout
│   ├── index.jsx          # Landing Page
│   ├── (auth)/            # Auth-Routes (Login, Register)
│   ├── (tabs)/            # Tab-Navigation (Dashboard, Account)
│   └── ...
├── src/                    # App-Code (komplett unabhängig von Web-App)
│   ├── components/        # React Native Komponenten
│   ├── contexts/          # React Contexts
│   ├── pages/             # Seiten-Komponenten
│   └── services/          # Services (Supabase, etc.)
├── .env                   # Umgebungsvariablen (MUSS ausgefüllt werden!)
├── app.config.js          # Expo-Konfiguration
└── package.json           # Mobile-spezifische Dependencies
```

## Setup

1. **Umgebungsvariablen einrichten:**
   ```bash
   # .env Datei im foodspot-ranking-mobile/ Verzeichnis erstellen/ausfüllen:
   EXPO_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
   EXPO_PUBLIC_MAPS_API_KEY=dein-maps-key (optional)
   ```

2. **Dependencies installieren:**
   ```bash
   npm install
   ```

3. **App starten:**
   ```bash
   npm start
   # Oder:
   expo start
   ```

## Wichtige Unterschiede zur Web-App

- **Routing:** expo-router statt react-router-dom
- **Komponenten:** React Native (View, Text, Pressable) statt HTML (div, button)
- **Storage:** AsyncStorage/SecureStore statt localStorage
- **Navigation:** useRouter von expo-router statt useNavigate
- **Images:** expo-image-picker statt HTML file input
- **Maps:** react-native-maps statt Google Maps Web API

## Status

✅ **Funktioniert:**
- Routing mit expo-router
- Auth-Flow (Login, Register)
- Dashboard
- Account-Seite

🚧 **In Arbeit:**
- TierList (vollständige Migration)
- AddFoodspot (vollständige Migration)
- CreateList & SelectCategory

## Troubleshooting

**Problem: "Missing Supabase URL"**
- Prüfe, ob `.env` Datei existiert und ausgefüllt ist
- Starte Expo-Server neu (`.env` wird nur beim Start geladen)
- Prüfe, ob Variablen mit `EXPO_PUBLIC_` beginnen

**Problem: Route-Warnungen**
- Normalerweise nur Caching-Problem
- Lösche `.expo` Ordner und starte neu: `rm -rf .expo && npm start`

