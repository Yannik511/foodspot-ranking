# Rankify — Komplette App-Beschreibung

## Was ist Rankify?

Rankify ist eine native iOS App (Capacitor + React/Vite), mit der Nutzer ihre Lieblings-Foodspots in Tier-Listen bewerten und organisieren können. Jeder Nutzer kann eigene Ranking-Listen für verschiedene Kategorien (Döner, Burger, Pizza, etc.) erstellen, Spots mit einem detaillierten Bewertungssystem eintragen und diese Listen mit Freunden teilen — ähnlich wie ein persönliches Restauranttagebuch mit Tier-System.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | React 19 + Vite |
| Styling | TailwindCSS |
| Backend / Datenbank | Supabase (PostgreSQL) |
| Auth | Supabase Auth (E-Mail + Passwort) |
| Real-time | Supabase Realtime (WebSockets) |
| Storage | Supabase Storage |
| Native iOS | Capacitor 7 |
| Native Plugins | StatusBar, SplashScreen, Keyboard, Haptics |
| Schriftart | Poppins (Google Fonts) |
| Deployment | Vercel (Web), Xcode (iOS) |
| App-ID | `com.rankify.app` |
| Supabase Projekt | `cvkyvhkwsylmzlrdlbxz` |

---

## Features im Überblick

### Eigene Listen
- Listen mit Kategorie, Stadtname und optionalem Coverbild erstellen
- 13 vordefinierte Kategorien: Döner, Burger, Pizza, Asiatisch, Bratwurst, Glühwein, Sushi, Deutsche Küche, Bier, Steak, Fast Food, Streetfood, Leberkässemmel
- Kategorieabhängige Begriffe (z.B. "Bier"-Liste heißt nicht "Foodspot" sondern "Bier")

### Tier-System
- Jeder Spot wird einem Tier zugeordnet: **S / A / B / C / D**
- Farbcodierung: S = Rot, A = Orange, B = Gelb, C = Grün, D = Blau
- Tier wird automatisch aus dem Durchschnittsscore berechnet

### Bewertungssystem
- Kategoriespezifische Bewertungskriterien (z.B. Burger: Patty, Bun, Sauce, Preis-Leistung)
- Mehrere Kriterien werden zu einem Gesamt-Score gemittelt (0–10)
- Score → Tier-Zuordnung automatisch

### Geteilte Listen
- Listen können mit Freunden geteilt werden
- Alle Mitglieder können Spots hinzufügen und bewerten
- Jeder Mitglieder-Score fließt in einen gemeinsamen Durchschnitt ein
- Mitgliederverwaltung direkt in der geteilten Liste

### Social / Freunde
- Freundschaftsanfragen senden und annehmen
- Online-Presence (grüner Punkt wenn Freund gerade aktiv ist, via Supabase Realtime Presence)
- Profil eines Freundes ansehen
- Ranking-Listen vergleichen

### Account & Profil
- Profilbild hochladen
- Statistiken: Anzahl Spots, Städte, Listen, Durchschnittsscore
- Tier-Verteilung (wie viele S-, A-, B-Spots)
- Top 10 Foodspots
- Top Städte und Kategorien
- Zuletzt bewertete Spots
- Badges / Achievements
- Kontext-Filter: Meine Listen / Geteilte Listen / Overall

### Einstellungen
- Dark Mode (Light / System / Dark)
- Akzentfarbe
- Profil-Sichtbarkeit (für Freunde sichtbar)
- Passwort ändern
- Benachrichtigungs-Einstellungen

### Native iOS Features
- Nahtlose Safe Area (Dynamic Island / Notch) — Header-Hintergrund zieht sich hinter die Statusleiste
- Haptic Feedback (Taptic Engine) bei wichtigen Aktionen
- Natives Keyboard-Handling
- Native Splash Screen
- Dunkle Statusleiste

---

## Routing-Struktur

```
/                          → Landing Page (öffentlich)
/login                     → Login (öffentlich)
/register                  → Registrierung (öffentlich)

/dashboard                 → Alle Listen des Nutzers
/select-category           → Kategorie für neue Liste auswählen
/create-list               → Neue Liste erstellen
/tierlist/:id              → Eigene Tier-Liste anzeigen & verwalten
/add-foodspot/:id          → Spot hinzufügen oder bearbeiten
/account                   → Profil & Statistiken
/settings                  → Einstellungen
/about                     → Über Rankify
/social                    → Freunde & Social

/shared/tierlist/:id       → Geteilte Liste anzeigen
/shared/add-foodspot/:id   → Spot zu geteilter Liste hinzufügen
/create-shared-list        → Neue geteilte Liste erstellen
/friend/:id                → Profil eines anderen Nutzers
/compare/:id               → Listen vergleichen
```

Alle Routes außer `/`, `/login`, `/register` sind durch `ProtectedRoute` gesichert — nicht eingeloggte Nutzer werden zur Landing Page weitergeleitet.

---

## Ordnerstruktur

```
src/
├── pages/                 # Alle Seiten (eine Komponente pro Route)
│   ├── Landing.jsx
│   ├── Dashboard.jsx
│   ├── CreateList.jsx
│   ├── SelectCategory.jsx
│   ├── TierList.jsx
│   ├── AddFoodspot.jsx
│   ├── Account.jsx
│   ├── Settings.jsx
│   ├── Social.jsx
│   ├── About.jsx
│   ├── Compare.jsx
│   ├── FriendProfile.jsx
│   ├── CreateSharedListPage.jsx
│   └── shared/
│       ├── SharedTierList.jsx
│       └── AddSharedFoodspot.jsx
│
├── components/            # Wiederverwendbare Komponenten
│   ├── ProtectedRoute.jsx
│   ├── Avatar.jsx
│   ├── CategoryGrid.jsx
│   ├── FeaturesSection.jsx
│   ├── WelcomeCard.jsx
│   ├── OnboardingSlider.jsx
│   ├── auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── shared/
│   │   └── MemberAvatars.jsx
│   └── social/
│       ├── CreateSharedList.jsx
│       ├── FriendsTab.jsx
│       └── UserAvatar.jsx
│
├── contexts/              # Globaler State via React Context
│   ├── AuthContext.jsx    # Eingeloggter Nutzer, Session
│   ├── ThemeContext.jsx   # Dark/Light Mode
│   ├── ProfileContext.jsx # User-Profile Cache
│   └── PresenceContext.jsx # Online-Status (Realtime)
│
├── hooks/
│   └── useHeaderHeight.js # Misst Header-Höhe inkl. Safe Area
│
├── services/
│   ├── supabase.js        # Supabase Client (Singleton)
│   └── sharedPhotos.js    # Foto-Upload für geteilte Listen
│
├── lib/
│   └── native.js          # Capacitor Native Init (StatusBar, Splash, Keyboard)
│
├── utils/
│   ├── haptics.js         # Haptic Feedback (light/medium/heavy/success/error)
│   ├── categoryTerms.js   # Kategorieabhängige Begriffe
│   ├── animations.js      # CSS Animation Utilities
│   ├── keyboard.js        # Keyboard Scroll-Handling
│   ├── gestures.js        # Touch-Gesten (Pull-to-Refresh, Swipe)
│   └── sharedLists.js     # Utilities für geteilte Listen
│
├── App.jsx                # Router + Provider-Baum
├── main.jsx               # React Root
└── index.css              # Globale Styles + Tailwind + header-safe Klasse
```

---

## Datenbank (Supabase / PostgreSQL)

### Tabellen

#### `lists`
Persönliche und geteilte Ranking-Listen.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | Primärschlüssel |
| user_id | uuid | Ersteller (→ auth.users) |
| list_name | text | Name der Liste |
| city | text | Stadt |
| description | text | Optionale Beschreibung |
| category | text | Kategorie (Döner, Burger, …) |
| cover_image_url | text | URL zum Coverbild |
| is_public | bool | Öffentlich sichtbar |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `foodspots`
Einzelne Spots in einer Liste.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | Primärschlüssel |
| list_id | uuid | Zugehörige Liste |
| user_id | uuid | Ersteller |
| name | text | Name des Spots |
| address | text | Adresse / Stadtteil |
| category | text | Kategorie des Spots |
| tier | text | S / A / B / C / D |
| rating | float | Gesamtbewertung (0–10) |
| avg_score | float | Durchschnitt aller Kriterien |
| notes | text | Notizen / Kommentar |
| cover_photo_url | text | URL zum Foto |
| ratings | jsonb | Einzelne Kriterien-Bewertungen |
| normalized_name | text | Normalisierter Name (für Duplikat-Erkennung) |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `list_members`
Mitglieder einer geteilten Liste.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | |
| list_id | uuid | Zugehörige Liste |
| user_id | uuid | Mitglied |
| created_at | timestamp | |

#### `foodspot_ratings`
Individuelle Bewertungen pro Nutzer für Spots in geteilten Listen.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | |
| list_id | uuid | |
| foodspot_id | uuid | |
| user_id | uuid | Bewerter |
| rating | float | Bewertung (0–10) |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `spot_photos`
Zusätzliche Fotos für Spots in geteilten Listen.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | |
| foodspot_id | uuid | |
| user_id | uuid | Hochgeladen von |
| photo_url | text | URL |
| created_at | timestamp | |

#### `friendships`
Freundschafts-Beziehungen zwischen Nutzern.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | |
| requester_id | uuid | Anfragesteller |
| addressee_id | uuid | Empfänger |
| status | text | `pending` / `accepted` |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `list_invitations`
Einladungen zu geteilten Listen.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | |
| list_id | uuid | |
| inviter_id | uuid | Einladender |
| invitee_id | uuid | Eingeladener |
| status | text | Status der Einladung |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `user_profiles`
Öffentliche Nutzerprofile.
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | |
| user_id | uuid | → auth.users |
| username | text | Anzeigename |
| profile_image_url | text | Profilbild-URL |
| profile_visibility | text | Sichtbarkeit (`friends` / `public`) |
| created_at | timestamp | |
| updated_at | timestamp | |

### Storage Buckets
| Bucket | Inhalt |
|---|---|
| `list-covers` | Coverbilder für Listen |
| `profile-avatars` | Profilbilder der Nutzer |
| `shared-foodspot-photos` | Fotos für Spots in geteilten Listen |

---

## Provider-Hierarchie (React Context)

```
ThemeProvider          → Dark/Light Mode global verfügbar
  AuthProvider         → Eingeloggter Nutzer, signIn/signOut
    PresenceProvider   → Online-Status der Freunde (Supabase Realtime)
      ProfileProvider  → User-Profile Cache
        BrowserRouter  → Routing
          Routes       → Alle Seiten
```

---

## Wichtige Patterns im Code

### Optimistische Updates
Fast alle Schreib-Operationen (Spot hinzufügen, Liste bearbeiten, etc.) aktualisieren das UI **sofort** und speichern dann im Hintergrund in Supabase. Bei Fehler wird der alte Zustand wiederhergestellt. Ergebnis: Die App fühlt sich instant an.

### Real-time Synchronisation
TierList und SharedTierList abonnieren per `supabase.channel()` auf Datenbankänderungen. Neue Spots erscheinen sofort bei allen Mitgliedern ohne Reload.

### `header-safe` CSS-Klasse
```css
.header-safe {
  padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
  padding-bottom: 12px;
  min-height: calc(60px + env(safe-area-inset-top, 0px));
}
```
Sorgt dafür, dass Header-Inhalte nicht hinter Dynamic Island / Notch verschwinden. Muss auf dem äußeren `fixed top-0` Element sitzen (nicht auf einem inneren Element, da Tailwind Utility-Layer > Component-Layer).

### `useHeaderHeight` Hook
Misst die tatsächliche Pixel-Höhe des Headers via `getBoundingClientRect()` (inkl. Safe Area). Gibt `getContentPaddingTop()` zurück — wird als `paddingTop` auf den Scroll-Container gesetzt, damit Content genau unterhalb des Headers startet.

---

## Native iOS (Capacitor)

### Konfiguration (`capacitor.config.json`)
```json
{
  "appId": "com.rankify.app",
  "appName": "Rankify",
  "webDir": "dist",
  "plugins": {
    "StatusBar": {
      "style": "DARK",
      "overlaysWebView": true
    },
    "SplashScreen": {
      "launchShowDuration": 1500,
      "backgroundColor": "#1a1a1a"
    },
    "Keyboard": {
      "resize": "body",
      "style": "DARK"
    }
  }
}
```

`overlaysWebView: true` ist kritisch — ohne es startet der WebView unterhalb der Statusleiste und `env(safe-area-inset-top)` gibt immer 0 zurück.

### Installierte Capacitor Plugins
| Plugin | Zweck |
|---|---|
| `@capacitor/status-bar` | Statusleisten-Style steuern |
| `@capacitor/splash-screen` | Nativer Splash Screen |
| `@capacitor/keyboard` | Keyboard-Verhalten auf iOS |
| `@capacitor/haptics` | Taptic Engine Feedback |

### Build-Workflow
```bash
npm run build          # Vite Production Build → dist/
npx cap sync ios       # dist/ in ios/App/App/public/ kopieren
npx cap open ios       # Xcode öffnen
# In Xcode: Cmd+R → auf Device/Simulator deployen
```

---

## Branches

| Branch | Status | Beschreibung |
|---|---|---|
| `main` | Stabil, live auf Vercel | Aktueller Produktionsstand |
| `feat/service-worker` | Wartet auf Merge | Service Worker, Online-Presence |
| `feat/capacitor` | Aktiv | Native iOS App, Safe Area Fix |

---

## Geplante Features (nächste Schritte)

- **Echte Karte in AddFoodspot** — Google Maps + Places API, Spot per Kartensuche auswählen, Koordinaten (lat/lng) in DB speichern
- **Entdecken Tab** — "In deiner Nähe", "Beste Spots", "Neu hinzugefügt", Geolocation
- **Push Notifications** — via Capacitor + APNs (braucht Apple Developer Account)
- **App Store Release** — Icons, Splash Assets, TestFlight
