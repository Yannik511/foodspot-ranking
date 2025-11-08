# Änderungen ab 11 Uhr - Schritt-für-Schritt Wiederherstellung

**Datum:** 7. November 2025, ab 11:02 Uhr  
**Letzter Git-Commit:** 273c0b9 (docs: Add GitHub repository setup guide)

---

## Übersicht der Änderungen

### 1. Vite-Konfiguration für iOS Simulator
**Datei:** `vite.config.js`
- Server-Host für Netzwerkzugriff konfiguriert (damit iOS Simulator erreichbar ist)

### 2. Header-Komponente erstellt
**Datei:** `src/components/AppHeader.jsx` (NEU)
- Wiederverwendbare Header-Komponente
- Avatar links, Settings rechts, Titel zentriert
- Safe Area Support für iOS

### 3. HeaderSettingsButton-Komponente
**Datei:** `src/components/HeaderSettingsButton.jsx` (NEU)
- Einstellungs-Button mit Zahnrad-Icon

### 4. Landing-Seite Anpassungen
**Datei:** `src/pages/Landing.jsx`
- Titel zu "Rankify" geändert
- Burger-Hintergrundbild hinzugefügt
- Buttons nebeneinander (Login links grau, Sign Up rechts orange-pink)
- Layout: Titel oben zentriert, Buttons unten

### 5. Dashboard Header-Integration
**Datei:** `src/pages/Dashboard.jsx`
- AppHeader-Komponente verwendet
- Header immer sichtbar (auch im Loading-State)
- Titel: "{Username}'s Foodspot Ranker" bei 0 Listen, "{Username}s Foodspots" bei Listen

### 6. WelcomeCard Button-Text
**Datei:** `src/components/WelcomeCard.jsx`
- Button-Text: "Liste anlegen" → "Erstelle deine erste Liste"

### 7. Logout-Weiterleitung
**Datei:** `src/pages/Account.jsx`
- Logout verwendet jetzt `navigate('/')` statt `window.location.href`

---

## Schritt-für-Schritt Wiederherstellung

### Schritt 1: Vite-Konfiguration für iOS Simulator
**Ziel:** App im iOS Simulator erreichbar machen

**Änderung in `vite.config.js`:**
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Erlaubt Zugriff von außen (z.B. iOS Simulator)
    port: 5173,
  },
})
```

---

### Schritt 2: HeaderSettingsButton-Komponente erstellen
**Ziel:** Wiederverwendbarer Settings-Button

**Neue Datei:** `src/components/HeaderSettingsButton.jsx`
```javascript
import { useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/haptics'

function HeaderSettingsButton() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => {
        hapticFeedback.light()
        navigate('/account')
      }}
      className="flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all w-full h-full"
      style={{
        minWidth: '44px',
        minHeight: '44px',
        width: '100%',
        height: '100%',
      }}
      aria-label="Einstellungen"
    >
      <svg 
        className="text-gray-700 dark:text-gray-300" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        style={{ width: '24px', height: '24px' }}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
        />
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
        />
      </svg>
    </button>
  )
}

export default HeaderSettingsButton
```

---

### Schritt 3: AppHeader-Komponente erstellen
**Ziel:** Wiederverwendbare Header-Komponente mit Avatar und Settings

**Neue Datei:** `src/components/AppHeader.jsx`
```javascript
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import HeaderSettingsButton from './HeaderSettingsButton'
import { hapticFeedback } from '../utils/haptics'

function AppHeader({ title, showTitle = true }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Du'
  }

  const getTitle = () => {
    if (title) return title
    return `${getUsername()}'s Foodspot Ranker`
  }

  return (
    <header 
      className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between sticky top-0 z-50 relative"
      style={{
        paddingLeft: 'clamp(16px, 4vw, 24px)',
        paddingRight: 'clamp(16px, 4vw, 24px)',
        paddingTop: `calc(clamp(12px, 3vh, 16px) + env(safe-area-inset-top))`,
        paddingBottom: 'clamp(12px, 3vh, 16px)',
        minHeight: `calc(60px + env(safe-area-inset-top))`,
      }}
    >
      {/* Avatar - Links */}
      <div 
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '44px',
          height: '44px',
          minWidth: '44px',
          minHeight: '44px',
        }}
      >
        <Avatar 
          size={44}
          onClick={() => {
            hapticFeedback.light()
            navigate('/account')
          }}
          className="w-full h-full"
        />
      </div>

      {/* Titel - Zentriert */}
      {showTitle && (
        <h1 
          className="text-gray-900 dark:text-white flex-1 text-center px-2" 
          style={{ 
            fontFamily: "'Poppins', sans-serif", 
            fontWeight: 700,
            fontSize: 'clamp(16px, 4vw, 18px)',
            lineHeight: '1.2',
          }}
        >
          {getTitle()}
        </h1>
      )}

      {/* Settings Button - Rechts */}
      <div 
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '44px',
          height: '44px',
          minWidth: '44px',
          minHeight: '44px',
        }}
      >
        <HeaderSettingsButton />
      </div>
    </header>
  )
}

export default AppHeader
```

---

### Schritt 4: Landing-Seite - Rankify mit Burger-Hintergrund
**Ziel:** Landing-Screen mit "Rankify" Titel und Burger-Bild

**Änderungen in `src/pages/Landing.jsx`:**
- Titel zu "Rankify" ändern
- Burger-Hintergrundbild hinzufügen (Vollbild)
- Dunkler Overlay für Textkontrast
- Buttons nebeneinander: Login (grau) links, Sign Up (orange-pink) rechts
- Layout: Titel oben zentriert, Buttons unten

**Wichtig:** Landing-Seite zeigt Login/Sign-Up nur für nicht-eingeloggte User. Eingeloggte User werden zu `/dashboard` weitergeleitet.

---

### Schritt 5: Dashboard - Header integrieren
**Ziel:** Header mit Avatar und Settings auf Dashboard

**Änderungen in `src/pages/Dashboard.jsx`:**
- Import: `import AppHeader from '../components/AppHeader'`
- Header im Loading-State hinzufügen
- Header im normalen Render: `<AppHeader title={isEmpty ? undefined : `${getUsername()}s Foodspots`} />`
- Alten duplizierten Header-Code entfernen

**Header-Titel-Logik:**
- Wenn `isEmpty === true`: Kein title prop → zeigt "{Username}'s Foodspot Ranker"
- Wenn Listen vorhanden: `title="{Username}s Foodspots"`

---

### Schritt 6: WelcomeCard Button-Text
**Ziel:** Button-Text anpassen

**Änderung in `src/components/WelcomeCard.jsx`:**
- Zeile ~166: "Liste anlegen" → "Erstelle deine erste Liste"

---

### Schritt 7: Logout-Weiterleitung
**Ziel:** Logout verwendet React Router navigate

**Änderung in `src/pages/Account.jsx`:**
- In `handleSignOut`: `window.location.href = '/'` → `navigate('/', { replace: true })`
- `navigate` ist bereits importiert

---

## Wichtige Anforderungen

### App-Logik (wie spezifiziert):
1. **Landing (`/`)**: Rankify mit Burger-Bild, Login/Sign-Up Buttons
2. **Nach Login**: Prüfe ob Listen vorhanden
   - **Keine Listen** → Welcome-Screen mit Header (Avatar + Settings), "{Username}'s Foodspot Ranker", "Erstelle deine erste Liste" Button, Onboarding-Tutorial
   - **Listen vorhanden** → Dashboard mit Header, "{Username}s Foodspots", Listen-Übersicht
3. **Header immer sichtbar** auf geschützten Seiten (Avatar links, Settings rechts)
4. **Logout** → Zurück zu Landing

### Mobile-First & Responsive:
- Safe Area Support (iOS Notch)
- Gleiche Logik Web + Mobile
- Header konsistent auf allen Seiten

---

## Reihenfolge der Implementierung

1. ✅ Vite Config (iOS Simulator)
2. ✅ HeaderSettingsButton erstellen
3. ✅ AppHeader erstellen
4. ✅ Dashboard Header integrieren
5. ✅ Landing-Seite (Rankify + Burger)
6. ✅ WelcomeCard Button-Text
7. ✅ Logout-Weiterleitung

---

## Notizen

- Alle Änderungen sollten Schritt für Schritt getestet werden
- Header muss auf Web UND iOS Simulator sichtbar sein
- Landing-Seite nur für nicht-eingeloggte User
- Dashboard zeigt Welcome-Screen bei 0 Listen, Listen-Übersicht bei vorhandenen Listen



