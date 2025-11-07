# 🍔 Foodspot Ranking

Personal food spot ranking app with tier system (S-E), friends, and shared lists.

## 📱 Features

- ✅ **Tier System** - Rank your spots from S (best) to E
- ✅ **Categories** - 5 presets (Döner, Burger, Pizza, Asian, Mexican) + custom
- ✅ **Ratings** - 5 criteria per category with auto-calculated tiers
- ✅ **Location** - GPS + Google Maps search
- ✅ **Photos** - Upload compressed images
- ✅ **Friends** - See friends' Top 10 spots
- ✅ **Shared Lists** - Collaborate on lists in real-time
- ✅ **Streaks** - Track daily activity
- ✅ **Discovery** - Find trending spots nearby

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- Supabase Account (free tier)

### Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/foodspot-ranking.git
cd foodspot-ranking

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

Your app will run on: **http://localhost:5173**

---

## ⚙️ Configuration

### 1. Supabase Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to **Settings → API**
4. Copy your credentials to `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. Setup Database: Siehe **[SCHNELLSTART_SUPABASE.md](SCHNELLSTART_SUPABASE.md)** 🚀

### 2. Google Maps API (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project
3. Enable **Places API** and **Geocoding API**
4. Create API key
5. Add to `.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 📱 iOS Simulator Setup

### Option 1: Xcode (macOS only)

```bash
# Install Xcode from Mac App Store

# Open simulator
open -a Simulator

# In Simulator: 
# 1. Open Safari
# 2. Navigate to http://localhost:5173
# 3. Safari → Develop → [Your Simulator] → Show Web Inspector
```

### Option 2: Browser DevTools

```bash
# Chrome DevTools
1. Open Chrome
2. Navigate to http://localhost:5173
3. Press F12 or Cmd+Option+I
4. Click device toggle (phone icon)
5. Select "iPhone 14 Pro" or similar

# Firefox Responsive Design Mode
1. Open Firefox
2. Navigate to http://localhost:5173
3. Press Cmd+Option+M
4. Select device size
```

---

## 🖥️ Cursor Setup

### Install Cursor

1. Download from [cursor.sh](https://cursor.sh)
2. Install and open
3. Open this project: `File → Open Folder → foodspot-ranking`

### Recommended Extensions

Install these in Cursor:
- **ES7+ React/Redux** - Snippets
- **Tailwind CSS IntelliSense** - Auto-complete
- **Prettier** - Code formatter
- **ESLint** - Code quality

### Use with PRD

```bash
# Open PRD in Cursor
# Then in chat, reference it:

"@PRD-FOODSPOT-RANKING.md Implement the login screen from section 3"
"@PRD Add the tier system as specified"
```

### Cursor AI Commands

```bash
# Generate component
"Create a FoodspotCard component with photo, name, rating"

# Fix bugs
"This button doesn't work, can you fix it?"

# Refactor
"Refactor this to use React Context instead of props drilling"

# Add features
"Add a loading spinner when fetching data"
```

---

## 📂 Project Structure

```
foodspot-ranking/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── auth/       # Login, Register
│   │   ├── lists/      # List overview, cards
│   │   ├── foodspots/  # Foodspot CRUD
│   │   ├── friends/    # Friends system
│   │   └── shared/     # Buttons, inputs, etc.
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── contexts/       # React Context (auth, etc.)
│   ├── services/       # Supabase API calls
│   ├── utils/          # Helper functions
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── supabase/
│   └── migrations/     # Database migrations
├── .env.example        # Environment template
├── package.json        # Dependencies
├── tailwind.config.js  # Tailwind configuration
└── vite.config.js      # Vite configuration
```

---

## 🛠️ Development

### Available Scripts

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Code Style

```bash
# Use Tailwind classes
<div className="flex items-center gap-4 p-6 bg-white rounded-xl">

# Component naming
- PascalCase for components (FoodspotCard.jsx)
- camelCase for functions (calculateTier)
- UPPER_CASE for constants (PRESET_CATEGORIES)

# File structure
- One component per file
- Related components in same folder
- Export default at end of file
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production
vercel --prod
```

Or use [Vercel Dashboard](https://vercel.com):
1. Import GitHub repository
2. Add environment variables
3. Deploy!

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy

# Production
netlify deploy --prod
```

---

## 🐛 Troubleshooting

### "npm install" fails
```bash
# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Tailwind not working
```bash
# Restart dev server
# Check tailwind.config.js content paths
# Verify @tailwind directives in index.css
```

### Supabase connection error
```bash
# Check .env file exists
# Verify VITE_ prefix on variables
# Restart dev server after .env changes
```

### iOS Simulator not loading
```bash
# Clear Safari cache in simulator
# Use http:// not https://
# Check firewall settings
```

---

## 📚 Resources

- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase Docs](https://supabase.com/docs)
- [Cursor Docs](https://cursor.sh/docs)

---

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt!

---

## 📄 License

MIT

---

## 🎯 Roadmap

### Phase 1 (MVP) ✅
- [x] Project setup
- [ ] Authentication
- [ ] Lists CRUD
- [ ] Foodspots CRUD
- [ ] Tier system
- [ ] Categories
- [ ] Ratings

### Phase 2
- [ ] Friends system
- [ ] Shared lists
- [ ] Top 10 views
- [ ] Real-time updates

### Phase 3
- [ ] Streaks
- [ ] Discovery feed
- [ ] Custom categories
- [ ] Advanced stats

---

Made with ❤️ for food lovers 🍔🥙🍕
