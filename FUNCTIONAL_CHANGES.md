# Funktionale Änderungen - Nach Reset wieder anwenden

Diese Datei dokumentiert die funktionalen Änderungen, die nach dem Reset auf "chore: finalize ui polish and icons" wieder angewendet werden müssen.

## 1. Long-Press auf Listenkarte deaktivieren

### Problem
Aktuell wird beim Long-Press auf eine Listenkarte der Bearbeiten-Modus geöffnet. Das soll nicht mehr passieren.

### Gewünschtes Verhalten
- **Tap auf die Karte**: Öffnet die Liste (Tier-View)
- **Tap auf die drei Punkte (⋮)**: Öffnet Bearbeiten / Löschen Menü
- **Long-Press auf die Karte**: Soll gar nichts machen (kein Bearbeiten öffnen)

### Betroffene Dateien
- `src/pages/Dashboard.jsx`

### Zu entfernende Code-Stellen
1. **Long-Press State/Timer**:
   - `longPressRefs` (useRef)
   - `longPressTimer` (useRef)
   
2. **Long-Press Handler-Funktionen**:
   - `handleLongPressStart`
   - `handleLongPressEnd`

3. **Event Listener auf Listenkarten**:
   - `onMouseDown={handleLongPressStart}`
   - `onMouseUp={handleLongPressEnd}`
   - `onMouseLeave={handleLongPressEnd}`
   - `onTouchStart={handleLongPressStart}`
   - `onTouchEnd={handleLongPressEnd}`

### Implementierung
- Alle oben genannten Event Listener von den Listenkarten entfernen
- Long-Press State und Timer entfernen
- Nur `onClick` für Navigation zur Tier-List beibehalten
- Drei-Punkte-Button behält sein `onClick` für Bearbeiten/Löschen

### Gilt für
- Private Listen (Meine Listen)
- Geteilte Listen (Geteilte Listen)
- Alle Listen-Ansichten im Dashboard

---

## 2. Leerzeichen bei Foodspot-Creation/-Bearbeitung ermöglichen

### Problem
Im Standort/Adress-Feld kann man keine Leerzeichen eingeben (z.B. "Hochschule München Lothstraße").

### Gewünschtes Verhalten
- Im Standort/Adress-Feld sollen ganz normale Texte mit Leerzeichen möglich sein
- Gilt sowohl beim Erstellen als auch beim Bearbeiten eines Foodspots

### Betroffene Dateien
- `src/pages/AddFoodspot.jsx`
- `src/pages/shared/AddSharedFoodspot.jsx` (falls vorhanden)

### Problem-Stelle
Im `onChange` Handler des Adress-Feldes wird wahrscheinlich `.trim()` oder `.replace(/\s+/g, ' ')` verwendet, was Leerzeichen entfernt oder reduziert.

### Aktueller Code (vermutlich)
```jsx
onChange={(e) => setFormData(prev => ({ 
  ...prev, 
  address: e.target.value.trim().replace(/\s+/g, ' ') 
}))}
```

### Korrigierter Code
```jsx
onChange={(e) => setFormData(prev => ({ 
  ...prev, 
  address: e.target.value.replace(/[<>]/g, '') // Nur HTML-Tags entfernen
}))}
```

### Wichtige Punkte
- **NICHT** `.trim()` im `onChange` verwenden (verhindert Leerzeichen während des Tippens)
- **NICHT** `.replace(/\s+/g, ' ')` im `onChange` verwenden (reduziert mehrere Leerzeichen)
- **NUR** HTML-Tags entfernen (z.B. `<` und `>`) für Sicherheit
- `.trim()` kann beim finalen Submit verwendet werden, aber nicht während des Tippens

### Validierung
- Beim Erstellen: Prüfen, ob Leerzeichen im Adress-Feld funktionieren
- Beim Bearbeiten: Prüfen, ob bestehende Adressen mit Leerzeichen korrekt angezeigt und bearbeitet werden können
- Andere Felder (Name, Beschreibung) sollten nicht betroffen sein

---

## Checkliste nach Reset

- [ ] Long-Press Handler aus `Dashboard.jsx` entfernt
- [ ] Long-Press State/Timer aus `Dashboard.jsx` entfernt
- [ ] Event Listener von Listenkarten entfernt
- [ ] Adress-Feld `onChange` in `AddFoodspot.jsx` korrigiert
- [ ] Adress-Feld `onChange` in `AddSharedFoodspot.jsx` korrigiert (falls vorhanden)
- [ ] Test: Long-Press auf Listenkarte macht nichts
- [ ] Test: Tap auf Listenkarte öffnet Tier-List
- [ ] Test: Tap auf drei Punkte öffnet Bearbeiten/Löschen
- [ ] Test: Leerzeichen im Adress-Feld funktionieren beim Erstellen
- [ ] Test: Leerzeichen im Adress-Feld funktionieren beim Bearbeiten





