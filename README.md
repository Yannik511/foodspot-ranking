# 🍔 Foodspot Ranking

Eine moderne Web-App zum Bewerten und Teilen von Food Spots mit Freunden.

## ✅ Implementierte Features

### Core Features
- ✅ **Authentifizierung** - Email/Password Login & Registrierung
- ✅ **Tier System** - Automatische Kategorisierung (S bis D) basierend auf Bewertungen
- ✅ **Private Listen** - Eigene Foodspot-Sammlungen erstellen
- ✅ **Geteilte Listen** - Gemeinsam mit Freunden bewerten
- ✅ **Kategorien** - 12 vordefinierte Kategorien (Döner, Burger, Pizza, Sushi, etc.)
- ✅ **Ratings** - 5 Kriterien pro Kategorie mit 1-5 Punkteskala
- ✅ **Fotos** - Multi-Photo Upload mit Cover-Foto Auswahl
- ✅ **Social Features** - Freunde hinzufügen, Profile ansehen

### Erweiterte Features
- ✅ **Real-time Updates** - Automatische Synchronisation bei geteilten Listen
- ✅ **Rollen-System** - Owner/Editor/Viewer Berechtigungen
- ✅ **Einladungen** - Freunde zu Listen einladen
- ✅ **Kommentare** - Bewertungen kommentieren
- ✅ **Gemeinsame Beschreibungen** - Spot-Infos für alle Mitglieder
- ✅ **Dark Mode** - Automatische Theme-Umschaltung
- ✅ **Progressive Rating Display** - Visuelle Bewertungsanzeige
- ✅ **Avatar-System** - Profilbilder mit Fallback

### UI/UX
- ✅ **Responsive Design** - Optimiert für Mobile & Desktop
- ✅ **Touch Gestures** - Swipe-to-delete, Pull-to-refresh
- ✅ **Loading States** - Skeleton Screens & Spinner
- ✅ **Toast Notifications** - Feedback für Benutzeraktionen
- ✅ **Smooth Animations** - Spring-Animationen mit Framer Motion

## 🚧 Geplante Features

- ⏳ **Standort-Features** - GPS, Maps Integration
- ⏳ **Entdecken** - Trending Spots, Empfehlungen

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Supabase Account** ([Anmelden](https://supabase.com))

### Installation

```bash
# Repository klonen
git clone https://github.com/YOUR_USERNAME/foodspot-ranking.git
cd foodspot-ranking

# Dependencies installieren
npm install

# Environment Variables kopieren
cp .env.example .env
# Supabase Credentials in .env eintragen

# Development Server starten
npm run dev
```

**App läuft auf:** http://localhost:5173

---

## ⚙️ Setup

### 1. Supabase Konfiguration

1. Projekt erstellen auf [supabase.com](https://supabase.com)
2. **Settings → API** → Credentials kopieren
3. In `.env` eintragen:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Datenbank Setup

**Schnellstart:** Siehe **[SCHNELLSTART_SUPABASE.md](SCHNELLSTART_SUPABASE.md)** 🚀

**Oder manuell:**
1. Supabase Dashboard → **SQL Editor**
2. Migrations in `migrations/` Ordner der Reihe nach ausführen
3. Siehe `migrations/README.md` für Details

**Wichtigste Migration:**
- `043_fix_merge_foodspot_null_score.sql` - Neueste Version (Description & Rating Fix)

---

## 📂 Projekt-Struktur

```
foodspot-ranking/
├── src/
│   ├── components/           # React Komponenten
│   │   ├── auth/            # Login, Register
│   │   ├── social/          # Social Features
│   │   └── shared/          # Shared Lists Komponenten
│   ├── pages/               # Seiten (Dashboard, TierList, etc.)
│   ├── contexts/            # React Context (Auth, Theme, Profiles)
│   ├── services/            # Supabase Services
│   └── utils/               # Helper Functions
├── migrations/              # SQL Datenbank-Migrationen
├── docs/                    # Dokumentation
├── archive/                 # Archivierte Dateien
├── scripts/                 # Hilfs-Skripte (iOS Simulator, etc.)
└── public/                  # Static Assets
```

---

## 🛠️ Development

### Scripts

```bash
npm run dev      # Development Server starten
npm run build    # Production Build erstellen
npm run preview  # Production Build testen
npm run lint     # Code Linting
```

### iOS Simulator (macOS)

```bash
# 3 Simulatoren starten
./scripts/start-ios-simulators.sh

# Oder manuell:
open -a Simulator
# Im Simulator Safari öffnen → http://localhost:5173
```

---

## 📚 Dokumentation

### Setup Guides
- [`SCHNELLSTART_SUPABASE.md`](SCHNELLSTART_SUPABASE.md) - Schnellstart Supabase Setup
- [`SETUP_DATABASE.md`](SETUP_DATABASE.md) - Detailliertes DB-Setup
- [`SETUP_AUTH.md`](SETUP_AUTH.md) - Authentifizierung

### Feature Dokumentation
- [`TIER_SYSTEM_DOKUMENTATION.md`](TIER_SYSTEM_DOKUMENTATION.md) - Tier-System Erklärung
- [`DATABASE_SCHEMA_REFERENCE.md`](DATABASE_SCHEMA_REFERENCE.md) - Datenbank-Schema
- [`migrations/README.md`](migrations/README.md) - Migrations-Übersicht

### Aktuelle Fixes
- [`APPLY_MIGRATION_043.md`](APPLY_MIGRATION_043.md) - Description & Rating Fix
- [`FIX_SHARED_LIST_AVATAR_LOADING.md`](FIX_SHARED_LIST_AVATAR_LOADING.md) - Avatar Loading Fix

### Weitere Docs
- [`docs/README.md`](docs/README.md) - Feature & Setup Dokumentation
- [`archive/README.md`](archive/README.md) - Archiv-Übersicht

---

## 🐛 Troubleshooting

### Supabase Connection Error
```bash
# .env Datei prüfen
# VITE_ Prefix bei allen Variablen?
# Dev Server nach .env Änderungen neu starten
```

### Build Error
```bash
# Cache löschen und neu installieren
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### iOS Simulator lädt nicht
```bash
# Safari Cache löschen im Simulator
# http:// verwenden (nicht https://)
# Firewall-Einstellungen prüfen
```

---

## 🚢 Deployment

### Vercel (Empfohlen)
1. Repository auf GitHub pushen
2. [vercel.com](https://vercel.com) → New Project
3. Environment Variables hinzufügen
4. Deploy!

### Netlify
1. [netlify.com](https://netlify.com) → New Site
2. GitHub Repository verbinden
3. Build Command: `npm run build`
4. Publish Directory: `dist`
5. Environment Variables hinzufügen

---

## 🔧 Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Real-time:** Supabase Realtime
- **Routing:** React Router v6
- **State:** React Context + Zustand

---

## 📦 Aktuelle Version

**Status:** Production Ready (außer Standort & Entdecken)  
**Latest Migration:** `045_rollback_profile_visibility.sql`  
**Letzte Updates:**
- ✅ Shared-List Member RPC (`get_shared_list_members`) für zuverlässige Avatare
- ✅ Neue Kategorie „Leberkässemmel“ + aktualisierte Fast-Food-Kriterien
- ✅ Dark-Mode Styling für Erstellen/Bearbeiten von Listen vereinheitlicht

---

## 🤝 Contributing

Persönliches Projekt - Fork & Anpassen erlaubt!

---

## 📄 License

MIT

---

Made with ❤️ for food lovers 🍔🥙🍕
