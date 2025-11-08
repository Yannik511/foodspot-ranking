# 📸 Kategorie-Bilder Anleitung

## ✅ Was wurde implementiert:

1. **Glühwein-Kategorie hinzugefügt** mit realistischen Kriterien:
   - Geschmack
   - Temperatur
   - Gewürze
   - Alkoholgehalt
   - Preis-Leistung

2. **Bilder statt Emojis** für alle Kategorien:
   - Alle Kategorien verwenden jetzt `imageUrl` statt `emoji`
   - Fallback auf Emoji, falls Bild nicht geladen werden kann

## 📁 Ordnerstruktur:

```
public/
  images/
    categories/
      doener.jpg      ← Döner-Bild (du hast das bereitgestellt)
      burger.jpg      ← Burger-Bild
      pizza.jpg       ← Pizza-Bild
      asiatisch.jpg   ← Asiatisches Essen Bild
      mexikanisch.jpg ← Mexikanisches Essen Bild
      gluehwein.jpg   ← Glühwein-Bild
```

## 🖼️ Bild-Anforderungen:

- **Format:** JPG oder PNG
- **Größe:** 64x64px bis 128x128px (quadratisch empfohlen)
- **Seitenverhältnis:** 1:1 (quadratisch)
- **Qualität:** Gut komprimiert, aber hochauflösend genug

## 📤 Bilder hochladen:

1. **Döner-Bild:**
   - Speichere dein Döner-Bild als `doener.jpg`
   - Lege es in `public/images/categories/doener.jpg`

2. **Weitere Bilder:**
   - Lade die Bilder für die anderen Kategorien hoch
   - Oder verwende Platzhalter-Bilder vorerst

3. **Glühwein-Bild:**
   - Suche oder erstelle ein Glühwein-Bild
   - Speichere als `gluehwein.jpg` in `public/images/categories/`

## 🔄 Nach dem Hochladen:

Der Development-Server lädt die Bilder automatisch aus dem `public` Ordner. Kein Neustart nötig!

## 🎨 Verwendung im Code:

Die Bilder werden in folgenden Stellen angezeigt:
- **Category Selection Screen:** Große Karten mit Bild
- **Form Header:** Kleines Bild neben dem Titel

## 🐛 Troubleshooting:

Falls ein Bild nicht geladen wird:
- Automatischer Fallback auf Emoji 🍔
- Prüfe, ob Dateiname exakt übereinstimmt (Groß-/Kleinschreibung!)
- Prüfe, ob Datei im richtigen Ordner liegt










