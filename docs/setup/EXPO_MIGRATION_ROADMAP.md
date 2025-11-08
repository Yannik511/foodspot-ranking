# 🚀 Roadmap: Migration zu Expo/React Native Mobile App

## 📋 Übersicht

Diese Roadmap beschreibt die vollständige Migration der aktuellen **React + Vite Web-App** zu einer **Expo/React Native Mobile App** für iOS und Android.

**Geschätzter Gesamtaufwand:** 6-8 Stunden  
**Komplexität:** Mittel bis Hoch

---

## 🎯 Ziele

- ✅ Native iOS & Android App
- ✅ App Store Deployment (Apple App Store, Google Play)
- ✅ Native Performance & UX
- ✅ Zugriff auf Geräte-Features (Kamera, GPS, Push-Notifications)
- ✅ Expo Go für schnelles Testing

---

## 📦 Phase 1: Setup & Vorbereitung (30-45 Min)

### 1.1 Expo CLI Installation
```bash
npm install -g expo-cli
# oder
npx create-expo-app@latest
```

### 1.2 Neues Expo-Projekt erstellen
```bash
# In neuem Verzeichnis oder als neues Projekt
npx create-expo-app foodspot-ranking-mobile --template blank
cd foodspot-ranking-mobile
```

### 1.3 Dependencies installieren
```bash
# Core Dependencies
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install @supabase/supabase-js
npm install expo-image-picker expo-location
npm install @react-native-async-storage/async-storage

# Optional: NativeWind für Tailwind-ähnliches Styling
npm install nativewind
npm install --save-dev tailwindcss
```

### 1.4 Projekt-Struktur vorbereiten
```
foodspot-ranking-mobile/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   └── ...
│   ├── pages/
│   ├── contexts/
│   ├── services/
│   └── utils/
├── assets/
└── app.json
```

---

## 🔄 Phase 2: Projekt-Migration (1-2 Stunden)

### 2.1 Supabase-Service migrieren
**Datei:** `src/services/supabase.js`
- ✅ Funktioniert 1:1 mit Expo
- ✅ Keine Änderungen nötig
- ✅ Eventuell AsyncStorage für Session-Persistenz hinzufügen

### 2.2 AuthContext migrieren
**Datei:** `src/contexts/AuthContext.jsx`
- ✅ Supabase Auth funktioniert identisch
- ✅ Eventuell Session-Persistenz mit AsyncStorage
- ✅ Keine größeren Änderungen

### 2.3 ProtectedRoute anpassen
**Datei:** `src/components/ProtectedRoute.jsx`
- ⚠️ Browser-Navigation entfernen
- ✅ React Navigation verwenden
- ✅ `useNavigation()` Hook statt `navigate()`

---

## 🧭 Phase 3: Navigation-Migration (1-1.5 Stunden)

### 3.1 React Router → React Navigation
**Datei:** `src/App.jsx` → `App.js` (Expo Entry Point)

**Vorher (React Router):**
```jsx
<BrowserRouter>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
  </Routes>
</BrowserRouter>
```

**Nachher (React Navigation):**
```jsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Landing" component={Landing} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        {/* ... */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 3.2 Navigation in Komponenten anpassen
**Alle Pages:** `useNavigate()` → `useNavigation()`

**Vorher:**
```jsx
const navigate = useNavigate();
navigate('/dashboard');
```

**Nachher:**
```jsx
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('Dashboard');
```

### 3.3 Route-Parameter anpassen
**Vorher:** `useParams()` von react-router-dom  
**Nachher:** `route.params` von React Navigation

```jsx
// Vorher
const { id } = useParams();

// Nachher
function TierList({ route }) {
  const { id } = route.params;
}
```

---

## 🎨 Phase 4: Styling-Migration (1.5-2 Stunden)

### 4.1 Option A: NativeWind (Tailwind-ähnlich) ⭐ EMPFOHLEN
**Vorteil:** Minimale Änderungen, ähnliche Syntax

**Setup:**
```bash
npm install nativewind
npm install --save-dev tailwindcss
npx tailwindcss init
```

**tailwind.config.js:**
```js
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Verwendung:**
```jsx
import { View, Text } from 'react-native';
// className funktioniert ähnlich wie im Web
<View className="flex-1 bg-white">
  <Text className="text-2xl font-bold">Hello</Text>
</View>
```

### 4.2 Option B: StyleSheet (Native React Native)
**Vorteil:** Vollständig native, beste Performance

**Vorher (Tailwind):**
```jsx
<div className="flex items-center justify-center bg-white">
  <h1 className="text-2xl font-bold">Title</h1>
</div>
```

**Nachher (StyleSheet):**
```jsx
import { View, Text, StyleSheet } from 'react-native';

<View style={styles.container}>
  <Text style={styles.title}>Title</Text>
</View>

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
```

### 4.3 Farben & Gradients
- ✅ Gradient: `expo-linear-gradient` statt CSS gradients
- ✅ Farben: Direkt in Styles oder Theme-Datei
- ✅ Aktuelle Farben (#FF7E42 → #FFB25A) übernehmen

---

## 🧩 Phase 5: Komponenten-Migration (2-3 Stunden)

### 5.1 HTML → React Native Components Mapping

| Web (HTML) | React Native |
|------------|--------------|
| `<div>` | `<View>` |
| `<span>`, `<p>`, `<h1>` | `<Text>` |
| `<button>` | `<Pressable>` oder `<TouchableOpacity>` |
| `<input>` | `<TextInput>` |
| `<img>` | `<Image>` (expo-image) |
| `<a>` | `<Pressable>` + `navigation.navigate()` |
| `<form>` | `<View>` (kein native form) |

### 5.2 Pages zu migrieren (in dieser Reihenfolge):

#### 5.2.1 Landing.jsx
- ✅ Einfachste Seite
- ✅ Nur Text & Buttons
- ✅ Gradient mit `expo-linear-gradient`

#### 5.2.2 Login.jsx & Register.jsx
- ✅ Form-Elemente → TextInput
- ✅ Buttons → Pressable
- ✅ Validation bleibt gleich

#### 5.2.3 Dashboard.jsx
- ⚠️ Komplex: Liste von Cards
- ✅ `FlatList` für Listen-Rendering
- ✅ Card-Komponenten als `<View>`
- ✅ Pull-to-Refresh mit `RefreshControl`

#### 5.2.4 CreateList.jsx
- ⚠️ Komplex: Form mit Image Upload
- ✅ `expo-image-picker` für Bilder
- ✅ Form-Inputs → TextInput
- ✅ Category-Select → Picker oder Modal

#### 5.2.5 SelectCategory.jsx
- ✅ Grid von Category-Cards
- ✅ `FlatList` mit `numColumns={2}`

#### 5.2.6 TierList.jsx
- ⚠️ Sehr komplex: Drag & Drop, Swipe-Gesten
- ✅ `react-native-draggable-flatlist` für Drag & Drop
- ✅ `react-native-gesture-handler` für Swipes
- ✅ Tier-Sections als Sections

#### 5.2.7 AddFoodspot.jsx
- ⚠️ Komplex: Form, Image Upload, Location
- ✅ `expo-image-picker` für Bilder
- ✅ `expo-location` für GPS
- ✅ Rating-System als Slider oder Buttons

#### 5.2.8 Account.jsx
- ✅ Profil-Bild Upload
- ✅ Settings-Liste
- ✅ `expo-image-picker` für Avatar

### 5.3 Komponenten zu migrieren:

#### 5.3.1 Avatar.jsx
- ✅ `expo-image` für Bilder
- ✅ Circular mit `borderRadius`

#### 5.3.2 WelcomeCard.jsx
- ✅ Gradient mit `expo-linear-gradient`
- ✅ Buttons → Pressable

#### 5.3.3 FeaturesSection.jsx
- ✅ Horizontal ScrollView
- ✅ Cards als Views

---

## 🔧 Phase 6: Features & Anpassungen (1-2 Stunden)

### 6.1 Image Upload
**Vorher:** File Input (Web)  
**Nachher:** `expo-image-picker`

```jsx
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  });
  
  if (!result.canceled) {
    setImageUri(result.assets[0].uri);
  }
};
```

### 6.2 Location/GPS
**Vorher:** Browser Geolocation API  
**Nachher:** `expo-location`

```jsx
import * as Location from 'expo-location';

const getLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  
  const location = await Location.getCurrentPositionAsync({});
  setLatitude(location.coords.latitude);
  setLongitude(location.coords.longitude);
};
```

### 6.3 Storage (SessionStorage/LocalStorage)
**Vorher:** `sessionStorage`, `localStorage`  
**Nachher:** `@react-native-async-storage/async-storage`

```jsx
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set
await AsyncStorage.setItem('key', JSON.stringify(value));

// Get
const value = JSON.parse(await AsyncStorage.getItem('key'));
```

### 6.4 Optimistic Updates
- ✅ Funktioniert identisch
- ✅ Nur Storage-API ändern (AsyncStorage statt sessionStorage)

### 6.5 Real-time Subscriptions
- ✅ Supabase Realtime funktioniert 1:1
- ✅ Keine Änderungen nötig

### 6.6 Drag & Drop (TierList)
**Package:** `react-native-draggable-flatlist`

```jsx
import DraggableFlatList from 'react-native-draggable-flatlist';

<DraggableFlatList
  data={foodspots}
  onDragEnd={({ data }) => setFoodspots(data)}
  keyExtractor={(item) => item.id}
  renderItem={({ item, drag, isActive }) => (
    <Pressable onLongPress={drag}>
      {/* Foodspot Card */}
    </Pressable>
  )}
/>
```

---

## 🧪 Phase 7: Testing (1 Stunde)

### 7.1 Expo Go Testing
```bash
# Start Development Server
npx expo start

# Scan QR Code mit:
# - iOS: Camera App
# - Android: Expo Go App
```

### 7.2 Test-Checkliste:
- [ ] Login/Register funktioniert
- [ ] Navigation zwischen Screens
- [ ] Liste erstellen/bearbeiten/löschen
- [ ] Foodspot hinzufügen/bearbeiten/löschen
- [ ] Image Upload funktioniert
- [ ] Location/GPS funktioniert
- [ ] Real-time Updates funktionieren
- [ ] Optimistic Updates funktionieren
- [ ] Drag & Drop in TierList
- [ ] Avatar Upload
- [ ] Alle Buttons/Interactions

### 7.3 Device Testing
- [ ] iOS Simulator (Xcode)
- [ ] Android Emulator (Android Studio)
- [ ] Physisches Gerät (iOS & Android)

---

## 📱 Phase 8: Build & Deployment (1-2 Stunden)

### 8.1 Expo Build Setup
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure
```

### 8.2 App Configuration
**app.json:**
```json
{
  "expo": {
    "name": "Foodspot Ranker",
    "slug": "foodspot-ranking",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FF7E42"
    },
    "ios": {
      "bundleIdentifier": "com.yourname.foodspotranking",
      "supportsTablet": true
    },
    "android": {
      "package": "com.yourname.foodspotranking",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FF7E42"
      }
    }
  }
}
```

### 8.3 Build Commands
```bash
# Development Build
eas build --profile development --platform ios
eas build --profile development --platform android

# Production Build
eas build --profile production --platform ios
eas build --profile production --platform android
```

### 8.4 App Store Deployment
**iOS (Apple App Store):**
1. Build mit EAS erstellen
2. App Store Connect Account erstellen
3. App hochladen via Transporter oder EAS Submit
4. App Store Listing erstellen
5. Review-Prozess

**Android (Google Play):**
1. Build mit EAS erstellen
2. Google Play Console Account erstellen
3. App Bundle hochladen
4. Store Listing erstellen
5. Review-Prozess

---

## ⚠️ Bekannte Herausforderungen & Lösungen

### Challenge 1: Web-spezifische APIs
**Problem:** `window`, `document`, Browser-APIs existieren nicht  
**Lösung:** Native Alternativen verwenden (siehe Phase 6)

### Challenge 2: CSS-spezifische Features
**Problem:** CSS Grid, Flexbox-Limits, z-index-Verhalten  
**Lösung:** React Native Layout-System nutzen, `zIndex` für Overlays

### Challenge 3: Performance bei großen Listen
**Problem:** Viele Items in Liste  
**Lösung:** `FlatList` mit `getItemLayout`, `initialNumToRender`

### Challenge 4: Keyboard Handling
**Problem:** Keyboard überdeckt Inputs  
**Lösung:** `KeyboardAvoidingView`, `react-native-keyboard-aware-scroll-view`

### Challenge 5: Gesten & Interaktionen
**Problem:** Web-Gesten vs. Native Gesten  
**Lösung:** `react-native-gesture-handler` für komplexe Gesten

---

## 📚 Wichtige Ressourcen

### Dokumentation
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Docs](https://reactnative.dev/)
- [NativeWind](https://www.nativewind.dev/)
- [Supabase React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)

### Packages
- `@react-navigation/native` - Navigation
- `expo-image-picker` - Image Upload
- `expo-location` - GPS
- `@react-native-async-storage/async-storage` - Storage
- `react-native-draggable-flatlist` - Drag & Drop
- `expo-linear-gradient` - Gradients
- `react-native-gesture-handler` - Gesten

---

## ✅ Checkliste vor Start

- [ ] Expo CLI installiert
- [ ] Node.js & npm aktuell
- [ ] Xcode (für iOS) installiert (macOS)
- [ ] Android Studio (für Android) installiert
- [ ] Expo Go App auf Test-Gerät installiert
- [ ] Supabase-Projekt läuft (keine Änderungen nötig)
- [ ] Backup des aktuellen Web-Projekts erstellt

---

## 🎯 Nächste Schritte

1. **Entscheidung:** NativeWind oder StyleSheet?
2. **Neues Projekt:** Expo-Projekt erstellen
3. **Schrittweise Migration:** Eine Komponente nach der anderen
4. **Testing:** Regelmäßig in Expo Go testen
5. **Iteration:** Feedback einarbeiten

---

## 💡 Tipps

- ⭐ **Starte klein:** Beginne mit Landing/Login, dann komplexere Seiten
- ⭐ **Teste früh:** Nutze Expo Go für sofortiges Feedback
- ⭐ **NativeWind empfohlen:** Minimiert Styling-Änderungen
- ⭐ **Inkrementell:** Migriere Seite für Seite, nicht alles auf einmal
- ⭐ **Backup:** Behalte Web-Version als Referenz

---

**Viel Erfolg bei der Migration! 🚀**


