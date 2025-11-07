# ✅ Glühwein & Döner-Bild - Anleitung

## 🍷 Glühwein-Kategorie

**Gute Nachricht:** Glühwein ist bereits im Code hinzugefügt! ✅

**Kein SQL nötig!** Die Kategorien sind im Frontend-Code definiert (`src/pages/AddFoodspot.jsx`), nicht in der Datenbank.

### Glühwein-Kriterien:
- ✅ Geschmack
- ✅ Temperatur
- ✅ Gewürze
- ✅ Alkoholgehalt
- ✅ Preis-Leistung

**Du kannst jetzt sofort Glühwein-Foodspots erstellen!** 🎉

---

## 📸 Döner-Bild hinzufügen

### Problem:
Ich kann Bilder nicht direkt aus dem Chat speichern. Aber es gibt eine einfache Lösung!

### Lösung - Schritt für Schritt:

#### 1. Bild herunterladen
- Rechtsklick auf das Döner-Bild (im Chat oder Browser)
- "Bild speichern unter..." wählen
- Als `doener.jpg` speichern

#### 2. Bild in den Ordner kopieren

**Mac (Finder):**
```
1. Öffne Finder
2. Drücke Cmd + Shift + G
3. Gib ein: /Users/yannikfuchs/Downloads/foodspot-ranking/public/images/categories/
4. Ziehe doener.jpg in diesen Ordner
```

**Terminal:**
```bash
# Kopiere das Bild (ersetze /Pfad/zum/Bild mit dem tatsächlichen Pfad)
cp /Pfad/zum/Bild/doener.jpg /Users/yannikfuchs/Downloads/foodspot-ranking/public/images/categories/doener.jpg
```

#### 3. Prüfen
```bash
ls -la public/images/categories/doener.jpg
```

#### 4. App neu laden
- Hard Reload: `Cmd + Shift + R`

---

## 📋 SQL (Optional)

Falls du eine `categories`-Tabelle in der Datenbank haben möchtest, habe ich ein SQL-Script erstellt:
- `add_gluehwein_category.sql`

**Aber:** Das ist NICHT nötig, da die Kategorien im Code definiert sind!

---

## ✅ Zusammenfassung

1. ✅ Glühwein ist bereits im Code → **Fertig!**
2. 📸 Döner-Bild: Speichere es manuell in `public/images/categories/doener.jpg`
3. 🎉 Fertig!








