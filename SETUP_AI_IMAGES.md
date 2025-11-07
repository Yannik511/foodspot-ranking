# 🎨 AI Image Suggestions Setup

Dieses Dokument beschreibt, wie du die AI-basierten Bildvorschläge für Städte in Foodspot Ranker konfigurierst.

## Übersicht

Wenn ein User eine Stadt eingibt (z.B. "München"), wird automatisch eine Auswahl von 3 passenden Bildern für diese Stadt angezeigt. Diese können als Cover-Bild für die Liste verwendet werden.

## Option 1: Unsplash API (Empfohlen)

Unsplash bietet eine kostenlose API mit 50 Requests pro Stunde (mehr als genug für unsere Zwecke).

### Schritt 1: Unsplash API Key holen

1. Gehe zu [unsplash.com/developers](https://unsplash.com/developers)
2. Erstelle einen kostenlosen Account (falls noch nicht vorhanden)
3. Klicke auf "Register as a developer"
4. Erstelle eine neue App
5. Kopiere deinen **Access Key**

### Schritt 2: API Key zu .env hinzufügen

Füge folgende Zeile zu deiner `.env` Datei hinzu:

```env
VITE_UNSPLASH_ACCESS_KEY=dein_api_key_hier
```

### Schritt 3: CreateList.jsx aktualisieren

In `src/pages/CreateList.jsx`, finde die Zeile:

```javascript
const unsplashAccessKey = 'YOUR_UNSPLASH_ACCESS_KEY' // TODO: Add to .env
```

Ersetze sie mit:

```javascript
const unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
```

### Schritt 4: Unsplash API Integration aktivieren

Finde den kommentierten Code-Block:

```javascript
// For demo: generate placeholder images
// In production, use: const response = await fetch(`https://api.unsplash.com/search/photos?query=${formData.city}&per_page=3&client_id=${unsplashAccessKey}`)
```

Entferne die Kommentare und aktiviere die echte API:

```javascript
const response = await fetch(
  `https://api.unsplash.com/search/photos?query=${formData.city}&per_page=3&client_id=${unsplashAccessKey}`
)
const data = await response.json()

if (data.results && data.results.length > 0) {
  const images = data.results.map(result => result.urls.regular)
  setAiImages(images)
} else {
  setAiImages([])
}
```

### Schritt 5: Dev Server neu starten

**Wichtig:** Nach dem Hinzufügen der neuen Environment-Variable:

```bash
# Stoppe den Dev Server (Ctrl+C)
# Starte ihn neu
npm run dev
```

## Option 2: Mock Images (Demo)

Falls du keine Unsplash API einrichten möchtest, verwendet die App automatisch Mock-Bilder für folgende Städte:

- München
- Berlin
- Hamburg
- Frankfurt
- Köln

Für alle anderen Städte werden generische Reisebilder angezeigt.

## Option 3: OpenAI DALL-E oder Bing Images

Alternativ kannst du auch andere Bild-APIs verwenden:

### OpenAI DALL-E

```javascript
const response = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    prompt: `${formData.city} city food cuisine`,
    n: 3,
    size: '1024x1024'
  })
})
```

### Bing Image Search

```javascript
const response = await fetch(
  `https://api.bing.microsoft.com/v7.0/images/search?q=${formData.city} food&count=3`,
  {
    headers: {
      'Ocp-Apim-Subscription-Key': import.meta.env.VITE_BING_API_KEY
    }
  }
)
```

## ✅ Erfolg-Checkliste

- [ ] Unsplash Account erstellt
- [ ] API Key zu `.env` hinzugefügt
- [ ] `CreateList.jsx` aktualisiert
- [ ] Dev Server neu gestartet
- [ ] Test: Städte eingeben → Bilder erscheinen
- [ ] Test: Bild auswählen → Preview erscheint
- [ ] Test: "Neues Bild vorschlagen" funktioniert

## 🐛 Troubleshooting

### "Images not loading"

- Prüfe, ob API Key korrekt ist
- Prüfe Browser Console für Fehlermeldungen
- Prüfe, ob `.env` Datei existiert
- Prüfe, ob Dev Server neu gestartet wurde

### "Too many requests"

- Unsplash Free Tier: 50 Requests/Stunde
- Nutze Mock-Images für Testing
- Implementiere Caching für wiederholte Anfragen

### "CORS Error"

- Unsplash unterstützt CORS standardmäßig
- Prüfe, ob du die korrekte API-Endpoint verwendest
- In Produktion: nutze einen Proxy-Server

## 📚 Weitere Ressourcen

- [Unsplash API Docs](https://unsplash.com/documentation)
- [OpenAI DALL-E Docs](https://platform.openai.com/docs/guides/images)
- [Bing Image Search API](https://docs.microsoft.com/azure/cognitive-services/bing-image-search/)











