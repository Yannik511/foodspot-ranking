# 🗺️ Google Maps API Setup

## Schnellstart

Die AddFoodspot-Funktion nutzt Google Maps Places API für die Standortsuche. Um die Funktion zu aktivieren, brauchst du einen Google Maps API Key.

## Schritt 1: Google Maps API Key erstellen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes aus
3. Aktiviere die **Maps JavaScript API** und **Places API**:
   - Gehe zu "APIs & Services" → "Library"
   - Suche nach "Maps JavaScript API" und aktiviere sie
   - Suche nach "Places API" und aktiviere sie
4. Erstelle einen API Key:
   - Gehe zu "APIs & Services" → "Credentials"
   - Klicke auf "Create Credentials" → "API Key"
   - Kopiere den generierten API Key

## Schritt 2: API Key in der App eintragen

Öffne `index.html` und ersetze `YOUR_GOOGLE_MAPS_API_KEY` mit deinem echten API Key:

```html
<!-- Google Maps Places API -->
<script src="https://maps.googleapis.com/maps/api/js?key=DEIN_ECHTER_API_KEY&libraries=places" async defer></script>
```

## Schritt 3: API Key einschränken (Empfohlen)

Aus Sicherheitsgründen solltest du deinen API Key einschränken:

1. Gehe zurück zu "APIs & Services" → "Credentials"
2. Klicke auf deinen API Key
3. Unter "Application restrictions":
   - Wähle "HTTP referrers (web sites)"
   - Füge deine Domain hinzu (z.B. `localhost:5173/*` für Entwicklung und `deine-domain.com/*` für Produktion)
4. Unter "API restrictions":
   - Wähle "Restrict key"
   - Wähle nur "Maps JavaScript API" und "Places API"
5. Speichern

## Alternative: Umgebungsvariable (Fortgeschritten)

Falls du den API Key nicht direkt im Code haben möchtest, kannst du ihn als Umgebungsvariable speichern:

1. Erstelle eine `.env` Datei im Root-Verzeichnis:
```bash
VITE_GOOGLE_MAPS_API_KEY=dein_echter_api_key
```

2. Ändere in `index.html`:
```html
<script>
  window.GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&libraries=places" async defer></script>
```

## Funktionen

Nach der Einrichtung stehen folgende Funktionen zur Verfügung:

✅ **Standort-Suche**: Nutzer können nach Orten suchen (Restaurants, Adressen, etc.)  
✅ **Autocomplete**: Automatische Vorschläge während der Eingabe  
✅ **Aktuelle Position**: GPS-basierte Standortermittlung  
✅ **Geocoding**: Automatische Umwandlung von Adressen in Koordinaten

## Kosten

- Google Maps bietet $200 kostenlose Credits pro Monat
- Das reicht für ca. 28.000 Autocomplete-Anfragen
- Für die meisten privaten Projekte ist das mehr als ausreichend

## Troubleshooting

**Problem**: "Google is not defined" Fehler  
**Lösung**: Stelle sicher, dass das Script mit `async defer` geladen wird und prüfe, ob der API Key korrekt eingetragen ist.

**Problem**: "This API project is not authorized to use this API"  
**Lösung**: Aktiviere "Maps JavaScript API" und "Places API" in der Google Cloud Console.

**Problem**: Keine Autocomplete-Vorschläge  
**Lösung**: Prüfe die Browser-Konsole auf Fehler und stelle sicher, dass du mindestens 3 Zeichen eingibst.









