# Session Protokoll — 29. April 2026

## Heute erledigt

### Capacitor Native iOS App — Komplette Migration

#### PWA → Capacitor
- **`vite-plugin-pwa` entfernt** — kein Service Worker, kein Manifest mehr
- **`vite.config.js` bereinigt** — nur noch React-Plugin, kein PWA-Plugin
- **`main.jsx` bereinigt** — `registerSW`-Import entfernt
- **`index.html` bereinigt** — alle PWA-Meta-Tags, Manifest-Link und Google Maps Placeholder entfernt
- **`viewport-fit=cover` beibehalten** — kritisch für iOS Safe Area

#### Capacitor Setup
- **`@capacitor/core`, `@capacitor/cli`** installiert
- **`@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`, `@capacitor/haptics`** installiert
- **`capacitor.config.json`** erstellt mit App-ID `com.rankify.app`
- **`src/lib/native.js`** erstellt — initialisiert StatusBar, SplashScreen, Keyboard einmalig beim App-Start
- **`App.jsx`** — `initNative()` per `useEffect` beim Mount aufgerufen
- **`npx cap add ios`** — iOS-Projekt generiert
- App läuft im iOS Simulator und auf echtem iPhone

#### iOS Safe Area Fix (kritischer Bug behoben)
- **Root Cause**: `"overlaysWebView": false` in `capacitor.config.json` → WebView startete unterhalb der Statusleiste, `env(safe-area-inset-top)` war immer 0
- **Fix**: `"overlaysWebView": true` → WebView füllt den gesamten Bildschirm inkl. hinter der Statusleiste
- **`setBackgroundColor`** aus `native.js` entfernt (nur relevant bei `overlaysWebView: false`)
- **Ergebnis**: Header-Hintergrund zieht sich nahtlos hinter die Statusleiste / Dynamic Island — exakt wie native iOS Apps

---

## Aktueller Stand

| Branch | Status |
|--------|--------|
| `main` | Stabil, läuft auf Vercel live |
| `feat/service-worker` | Service Worker + Online-Presence, wartet auf Merge |
| `feat/capacitor` | Capacitor iOS App, Safe Area behoben, läuft auf echtem iPhone ✓ |

---

## Architektur-Entscheidungen (neu)

- **Kein PWA mehr** — direkt Capacitor für iOS. PWA "Add to Homescreen" war nie das Ziel
- **`overlaysWebView: true`** ist Standard für alle iOS Apps die Safe Area korrekt handhaben wollen
- **`header-safe` CSS-Klasse** (`@layer components`) funktioniert korrekt auf dem outer `fixed top-0` Element — `position: fixed; top: 0` positioniert immer am physischen Bildschirm-Top unabhängig von Padding

---

## Offene Punkte / Bekannte Bugs

- Memory Leak bei Bild-Vorschau (`CreateList.jsx:142`) — `URL.createObjectURL` wird nie freigegeben
- "Passwort speichern" Label irreführend (`Login.jsx`) — speichert nur E-Mail
- Toast ohne Schließen-Button (`CreateList.jsx`)
- Duplicate Emoji bei "Fast Food" Kategorie (`SelectCategory.jsx`)

---

## Plan für nächste Session

### Priorität 1 — feat/capacitor fertigstellen & testen
- Alle Pages auf echtem iPhone durchklicken
- Bottom Safe Area prüfen (`env(safe-area-inset-bottom)`) bei Pages mit FABs/Tab-Bars
- Haptic Feedback an sinnvollen Stellen einbauen (`@capacitor/haptics`)

### Priorität 2 — App Store Vorbereitung
- App Icons für alle Größen generieren
- Splash Screen Assets erstellen
- Bundle ID & Signing in Xcode konfigurieren
- TestFlight Build

### Priorität 3 — Entdecken Tab
- Supabase RPC Funktion schreiben
- `Discover.jsx` Page mit: "In deiner Nähe", "Beste Spots", "Neu hinzugefügt"
- Filter: Kategorie, Tier
- Tab im Dashboard einbinden

### Später
- feat/service-worker nach main mergen
- Apple Maps via Capacitor MapKit

---

# Session Protokoll — 26. April 2026

## Heute erledigt

### Bugfixes
- **TierList Header Safe Area** — `paddingTop: 0` inline-style entfernt, Header zeigt jetzt korrekt unterhalb der iOS Statusleiste
- **S-Tier wird nicht abgeschnitten** — Scroll-Container Fallback von 60px auf 88px erhöht
- **useHeaderHeight** — zusätzliche Retry-Timeouts (300ms, 500ms) für Production

### Features
- **Service Worker** — `vite-plugin-pwa` eingerichtet, App Shell wird gecacht, Supabase NetworkFirst, offline-fähig
- **Online-Presence** — Grüner Punkt im Social Tab erscheint jetzt nur wenn Freund wirklich online ist (Supabase Realtime Presence), `PresenceContext` erstellt
- **SharedTierList** — 5 Spots pro Tier angezeigt (war 3), "Alle ansehen" erscheint ab dem 6. Spot

### Setup & Infrastruktur
- **Supabase CLI** installiert und mit Projekt `cvkyvhkwsylmzlrdlbxz` verknüpft
- **Schema gedumpt** — `supabase/schema.sql` (2924 Zeilen) im Repo
- **Branch-Strategie** eingeführt — main bleibt stabil, Features auf eigenen Branches
- **feat/service-worker** Branch auf GitHub mit allem oben genannten

---

## Aktueller Stand

| Branch | Status |
|--------|--------|
| `main` | Stabil, läuft auf Vercel live |
| `feat/service-worker` | Alle heutigen Änderungen, wartet auf Test & Merge |

---

## Offene Punkte / Bekannte Bugs

- Memory Leak bei Bild-Vorschau (`CreateList.jsx:142`) — `URL.createObjectURL` wird nie freigegeben
- "Passwort speichern" Label irreführend (`Login.jsx`) — speichert nur E-Mail
- Toast ohne Schließen-Button (`CreateList.jsx`)
- Duplicate Emoji bei "Fast Food" Kategorie (`SelectCategory.jsx`)

---

## Plan für nächste Session

### Priorität 1 — Entdecken Tab
- Supabase RPC Funktion schreiben (Yannik führt SQL aus)
- `Discover.jsx` Page bauen mit 3 Bereichen:
  - "In deiner Nähe" (nach Distanz, braucht Geolocation)
  - "Beste Spots aller Zeiten" (nach avg_score)
  - "Neu hinzugefügt" (nach created_at)
- Filter: Kategorie, Tier
- Sichtbarkeit: nur Spots von Nutzern mit `profile_visibility = 'friends'`
- Tab im Dashboard einbinden

### Priorität 2 — feat/service-worker nach main mergen
- Auf Vercel Preview testen
- Pull Request erstellen und mergen

### Später — Capacitor
- Capacitor einrichten → Apple Maps + echte Push Notifications + App Store
- Kein Mapbox nötig, direkt mit Apple Maps

---

## Architektur-Entscheidungen (festgehalten)

- **Kein Mapbox** — Standort/Karte kommt erst mit Capacitor (Apple Maps)
- **Keine Web Push Notifications** — direkt mit Capacitor (echte APNs)
- **Ein Branch für alle heutigen Features** — solo macht Micro-Branches mehr Overhead als Nutzen
- **Supabase Presence** für Online-Status — kein DB-Feld nötig, läuft im Memory
