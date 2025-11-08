# 📋 Kategorie-Auswahl für Listen

## ✅ Was wurde implementiert

### 1. Neue SelectCategory-Seite
- Route: `/select-category`
- Zeigt alle verfügbaren Kategorien als Cards
- "Alle Kategorien" Option oben
- Navigiert zu `/create-list?category=...` mit ausgewählter Kategorie

### 2. CreateList erweitert
- Liest Kategorie aus URL-Parameter (`?category=...`)
- Speichert Kategorie in `lists.category` Feld
- `category = null` bedeutet "Alle Kategorien"
- Redirect zu SelectCategory wenn keine Kategorie vorhanden

### 3. AddFoodspot angepasst
- Lädt Liste und prüft `list.category`
- Wenn Liste eine Kategorie hat → Kategorie-Auswahl wird übersprungen
- Nur passende Kategorie kann verwendet werden
- Automatische Kategorie-Zuweisung basierend auf Liste

### 4. WelcomeCard Button
- Navigiert jetzt zu `/select-category` statt direkt zu `/create-list`

## 🗄️ Datenbank

### ✅ Keine Änderungen nötig!

Das `category` Feld existiert bereits in der `lists` Tabelle:

```sql
category VARCHAR(50)
```

**Werte:**
- `null` = Alle Kategorien (flexibel)
- `'Döner'` = Nur Döner-Foodspots
- `'Burger'` = Nur Burger-Foodspots
- `'Pizza'` = Nur Pizza-Foodspots
- etc.

## 📊 Verfügbare Kategorien

- 🥙 Döner
- 🍔 Burger
- 🍕 Pizza
- 🍜 Asiatisch
- 🌮 Mexikanisch
- 🍷 Glühwein
- 🍣 Sushi (neu)
- 🍦 Dessert (neu)
- 🥗 Vegan/Healthy (neu)

## 🔄 Funktionsweise

### Szenario 1: "Alle Kategorien"
1. User wählt "Alle Kategorien" → `category = null`
2. In TierList kann User alle Kategorien hinzufügen
3. AddFoodspot zeigt alle Kategorien zur Auswahl

### Szenario 2: Spezifische Kategorie (z.B. "Glühwein")
1. User wählt "Glühwein" → `category = 'Glühwein'`
2. In TierList kann User nur Glühwein-Foodspots hinzufügen
3. AddFoodspot zeigt direkt Glühwein-Kriterien (keine Kategorie-Auswahl)
4. Foodspots werden automatisch mit `category = 'Glühwein'` gespeichert

## 🎯 Kriterien pro Kategorie

Die Kriterien werden automatisch angezeigt basierend auf der Kategorie:

- **Döner**: Brot, Fleisch, Soße, Frische, Location
- **Burger**: Bun, Patty, Toppings/Cheese, Geschmack, Location
- **Pizza**: Teig, Belag, Soße, Backen, Location
- **Asiatisch**: Nudeln/Reis, Protein, Soße, Gemüse, Location
- **Mexikanisch**: Tortilla, Füllung, Soße/Schärfe, Frische, Location
- **Glühwein**: Geschmack, Temperatur, Gewürze, Alkoholgehalt, Preis-Leistung

## 🧪 Testen

1. **Neue Liste erstellen**:
   - Klicke auf "Erstelle deine erste Foodspot-Liste"
   - Wähle eine Kategorie (z.B. "Glühwein")
   - Erstelle Liste "Frankfurt Glühweine"

2. **Foodspot hinzufügen**:
   - Gehe zur TierList
   - Klicke auf "+" Button
   - → Kategorie-Auswahl wird übersprungen!
   - → Direkt Glühwein-Kriterien werden angezeigt

3. **Alle Kategorien testen**:
   - Erstelle neue Liste mit "Alle Kategorien"
   - → Kategorie-Auswahl erscheint beim Foodspot hinzufügen

## ✅ Fertig!

Die Funktion ist vollständig implementiert. Keine Datenbank-Änderungen nötig - das `category` Feld existiert bereits!



