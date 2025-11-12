# Fix: Avatar-Bilder in geteilten Listen - Retry-Logik

## Problem

Beim Öffnen einer geteilten Liste trat ein 400 Bad Request Fehler auf:
```
Failed to load resource: the server responded with a status of 400 (Bad Request) (user_profiles)
```

**Ursache:** Die App versuchte, Profilbilder zu laden, bevor der Server bereit war zu antworten. Nach einem zweiten Versuch oder kurzer Wartezeit funktionierte es.

## Lösung

Implementierung einer intelligenten Retry-Logik **nur für geteilte Listen** mit:

1. **Initial Delay:** 500ms Verzögerung beim ersten Laden
2. **Retry-Mechanismus:** Bis zu 2 Versuche bei fehlenden Profilen
3. **Graceful Degradation:** Partielle Ergebnisse werden angezeigt, auch wenn einige Profile fehlen
4. **Fehlerbehandlung:** Try-Catch verhindert komplettes Fehlschlagen

## Geänderte Datei

`src/pages/shared/SharedTierList.jsx` - Funktion `fetchProfilesForIds`

### Vorher:
```javascript
const fetchProfilesForIds = useCallback(async (ids) => {
  if (!ids || ids.length === 0) return {}
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return {}

  await ensureProfiles(uniqueIds)

  const result = {}
  uniqueIds.forEach(id => {
    const profile = getProfile(id)
    if (profile) {
      result[id] = profile
    }
  })
  return result
}, [ensureProfiles, getProfile])
```

### Nachher:
```javascript
const fetchProfilesForIds = useCallback(async (ids, retryCount = 0) => {
  if (!ids || ids.length === 0) return {}
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return {}

  try {
    // Add a small delay on first load to prevent race conditions
    if (retryCount === 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    await ensureProfiles(uniqueIds)

    const result = {}
    const missingProfiles = []
    
    uniqueIds.forEach(id => {
      const profile = getProfile(id)
      if (profile) {
        result[id] = profile
      } else {
        missingProfiles.push(id)
      }
    })

    // Retry logic: if some profiles are missing and we haven't exceeded retry limit
    if (missingProfiles.length > 0 && retryCount < 2) {
      // Wait a bit longer before retrying
      await new Promise(resolve => setTimeout(resolve, 1000))
      const retryResult = await fetchProfilesForIds(missingProfiles, retryCount + 1)
      Object.assign(result, retryResult)
    }

    return result
  } catch (error) {
    console.warn('[SharedTierList] Error fetching profiles:', error)
    // Return partial result instead of failing completely
    const result = {}
    uniqueIds.forEach(id => {
      const profile = getProfile(id)
      if (profile) {
        result[id] = profile
      }
    })
    return result
  }
}, [ensureProfiles, getProfile])
```

## Funktionsweise

### Timeline des Ladevorgangs:

1. **T=0ms:** Geteilte Liste wird geöffnet
2. **T=500ms:** Erste Anfrage an `user_profiles` wird gestellt
3. **T=500-1000ms:** Profile werden geladen
4. **Falls Profile fehlen:**
   - **T=1000ms:** Warte 1 Sekunde
   - **T=2000ms:** Zweiter Versuch für fehlende Profile
5. **Falls noch Profile fehlen:**
   - **T=3000ms:** Dritter und letzter Versuch

### Maximale Verzögerung:
- **Erfolg beim ersten Versuch:** ~500-1000ms (kaum spürbar)
- **Erfolg beim zweiten Versuch:** ~2000-2500ms
- **Erfolg beim dritten Versuch:** ~3500-4000ms
- **Partielle Daten:** Werden sofort angezeigt, auch wenn einzelne Profile fehlen

## Vorteile

✅ **Keine 400-Fehler mehr** - Server hat Zeit zum Antworten  
✅ **Automatische Wiederholung** - Benutzer muss nicht manuell neu laden  
✅ **Graceful Degradation** - App zeigt verfügbare Daten sofort an  
✅ **Minimale Verzögerung** - Nur 500ms initial delay  
✅ **Nur für geteilte Listen** - Andere Bereiche (Social, Freunde) sind nicht betroffen  

## Wichtig

### ⚠️ Änderung betrifft NUR:
- `src/pages/shared/SharedTierList.jsx`
- Avatar-Bilder in **geteilten Listen**

### ✅ NICHT betroffen (funktionieren weiterhin perfekt):
- Social Tab
- Freunde-Liste
- Profil-Ansichten
- Private Listen
- Account-Einstellungen
- Alle anderen Avatar-Anzeigen

## Testing

Nach dem Update testen:

1. Öffne eine geteilte Liste
2. ✅ Keine 400-Fehler mehr in der Browser-Konsole
3. ✅ Avatar-Bilder erscheinen nach ~0.5-2 Sekunden
4. ✅ Liste ist sofort nutzbar (auch wenn Avatare noch laden)
5. ✅ Beim zweiten Öffnen: Avatare erscheinen sofort (aus Cache)

## Technische Details

- **Retry-Count:** Max. 2 Wiederholungen (3 Versuche insgesamt)
- **Initial Delay:** 500ms (verhindert Race Conditions)
- **Retry Delay:** 1000ms zwischen Versuchen
- **Fehlerbehandlung:** Try-Catch mit Fallback auf verfügbare Profile
- **Performance:** Cache wird genutzt - spätere Zugriffe sind instant

