# Analyse: Editor-Einladungen & Avatar-Lade-Problem

## 1. Problem: Editor kann keine Personen zu geteilten Listen einladen

### Aktuelle Situation

**Frontend (Dashboard.jsx):**
- Die `handleInviteFriends` Funktion (Zeile 2966) versucht, Einladungen zu erstellen
- Es wird keine Rolle-Prüfung im Frontend durchgeführt - jeder kann theoretisch versuchen einzuladen
- Der Fehler kommt vom Backend (Supabase RLS Policy)

**Backend (RLS Policies):**

In `migrations/021_fix_invitation_visibility.sql` (Zeile 58-63):
```sql
CREATE POLICY "List owners can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  is_list_owner(list_id, auth.uid())
  AND inviter_id = auth.uid()
);
```

**Problem:** Diese Policy erlaubt nur dem **Owner** (`lists.user_id = auth.uid()`), Einladungen zu erstellen. Editoren haben keine Berechtigung.

### Lösung: RLS Policy erweitern

**Option 1: Neue Policy für Editoren hinzufügen (Empfohlen)**

Erstelle eine neue Migration-Datei (z.B. `migrations/041_allow_editors_to_invite.sql`):

```sql
-- =============================================
-- MIGRATION 041: ALLOW EDITORS TO INVITE
-- =============================================
-- Erlaubt Editoren, Personen zu geteilten Listen einzuladen
-- =============================================

-- Policy: Editoren können Einladungen erstellen
CREATE POLICY "List editors can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  -- User ist Editor der Liste (nicht Owner, da Owner bereits durch andere Policy abgedeckt)
  EXISTS (
    SELECT 1 FROM list_members
    WHERE list_members.list_id = list_invitations.list_id
    AND list_members.user_id = auth.uid()
    AND list_members.role = 'editor'
  )
  AND inviter_id = auth.uid()
);
```

**Option 2: Bestehende Policy erweitern**

Alternativ könnte die bestehende Policy erweitert werden:

```sql
DROP POLICY IF EXISTS "List owners can create invitations" ON list_invitations;

CREATE POLICY "List owners and editors can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  (
    -- Owner
    is_list_owner(list_id, auth.uid())
    OR
    -- Editor
    EXISTS (
      SELECT 1 FROM list_members
      WHERE list_members.list_id = list_invitations.list_id
      AND list_members.user_id = auth.uid()
      AND list_members.role = 'editor'
    )
  )
  AND inviter_id = auth.uid()
);
```

**Empfehlung:** Option 1 ist sauberer, da sie die bestehende Policy nicht ändert und klar zwischen Owner und Editor unterscheidet.

### Frontend-Anpassungen

**Keine Änderungen nötig!** Das Frontend prüft bereits nicht die Rolle vor dem Einladen, was korrekt ist - die Sicherheit liegt im Backend.

### Sicherheitsüberlegungen

✅ **Sicher:** Editoren können nur Personen zu Listen einladen, bei denen sie selbst Editor sind (durch RLS Policy abgesichert)
✅ **Sicher:** Die `inviter_id` muss mit `auth.uid()` übereinstimmen (verhindert Spoofing)
✅ **Sicher:** Editoren können keine Rollen ändern (nur Owner kann Rollen ändern, siehe `handleRoleChange` Zeile 3020)

---

## 2. Problem: Avatarbilder in Tierlisten-Übersicht laden manchmal nicht

### Aktuelle Situation

**Datenfluss:**

1. **Initiales Laden** (`fetchTierData`, Zeile 167):
   - Lädt Foodspots, Ratings, Photos
   - Sammelt alle `user_id`s in `userIdSet` (Zeile 227-270)
   - Ruft `fetchProfilesForIds(Array.from(userIdSet))` auf (Zeile 284)

2. **Profile-Laden** (`fetchProfilesForIds`, Zeile 119):
   - Verwendet `ensureProfiles(uniqueIds)` aus dem Profile-Store
   - Hat Retry-Logik (max 2 Retries)
   - 500ms Delay beim ersten Laden (Zeile 127)

3. **Avatar-Anzeige** (`renderSpotAvatars`, Zeile 388):
   - Verwendet `getProfileForUser(userId)` (Zeile 436)
   - Prüft `profile?.profile_visibility === 'private'` (Zeile 440)
   - Falls `avatarUrl` null/undefined → zeigt Initialen (Zeile 458)

### Mögliche Ursachen

**1. Race Condition beim Initialen Laden:**
- `fetchProfilesForIds` wird mit 500ms Delay aufgerufen (Zeile 127)
- Wenn die UI bereits rendert, bevor Profile geladen sind, werden Initialen angezeigt
- Die Retry-Logik hilft, aber nur wenn der Render-Zyklus erneut ausgelöst wird

**2. Profile-Store Cache:**
- `ensureProfiles` könnte Profile im Cache haben, aber ohne `avatar_url`
- Wenn Profile ohne Avatar-URL gecacht sind, werden sie nicht neu geladen

**3. Profile Visibility:**
- Wenn `profile_visibility === 'private'`, wird `avatarUrl` auf `null` gesetzt (Zeile 440)
- Das ist korrekt, aber könnte mit fehlenden Daten verwechselt werden

**4. Timing-Problem:**
- `renderSpotAvatars` wird während des Renders aufgerufen
- Wenn Profile noch nicht geladen sind, gibt `getProfile(userId)` `undefined` zurück
- Kein Re-Render wird ausgelöst, wenn Profile später geladen werden

### Unterschied zur Detailansicht

In der Detailansicht (Zeile 1391, 1404):
- Profile werden wahrscheinlich bereits geladen sein (weil Detailansicht später geöffnet wird)
- Oder es gibt einen expliziten Re-Fetch beim Öffnen der Detailansicht

### Lösungsvorschläge

**Option 1: Loading-State für Avatare (Empfohlen)**

```jsx
// In renderSpotAvatars, Zeile 451:
{avatarUrl ? (
  <img
    src={avatarUrl}
    alt={profile?.username || 'Avatar'}
    className="w-full h-full object-cover"
    onError={() => {
      // Fallback zu Initialen wenn Bild nicht lädt
      setAvatarError(`${spot.id}-${userId}`)
    }}
  />
) : profile ? (
  // Profile geladen, aber kein Avatar (privat oder kein Bild)
  <span className="text-xs">{displayInitial}</span>
) : (
  // Profile noch nicht geladen - zeige Loading-Indikator
  <div className="w-full h-full animate-pulse bg-gray-300" />
)}
```

**Option 2: Re-Fetch Profile wenn fehlend**

```jsx
// In renderSpotAvatars, nach Zeile 436:
const profile = getProfileForUser(userId)

// Wenn Profile fehlt, trigger Re-Fetch
useEffect(() => {
  if (!profile && userId) {
    fetchProfilesForIds([userId])
  }
}, [profile, userId, fetchProfilesForIds])
```

**Option 3: Profile-Laden optimieren (Beste Lösung)**

```jsx
// In fetchTierData, Zeile 283-285:
// Statt einmalig am Ende, Profile sofort laden wenn userIdSet bekannt ist
if (userIdSet.size > 0) {
  // Sofort laden, kein Delay
  await fetchProfilesForIds(Array.from(userIdSet))
  
  // Dann nochmal prüfen ob alle geladen sind
  const missingIds = Array.from(userIdSet).filter(id => !getProfile(id))
  if (missingIds.length > 0) {
    // Retry für fehlende Profile
    await fetchProfilesForIds(missingIds, 1)
  }
}
```

**Option 4: State für geladene Profile**

```jsx
// Neuer State
const [profilesLoaded, setProfilesLoaded] = useState(false)

// In fetchTierData, nach fetchProfilesForIds:
setProfilesLoaded(true)

// In renderSpotAvatars:
// Nur rendern wenn Profile geladen sind ODER nach Timeout
if (!profilesLoaded && !hasTimeout) {
  // Zeige Skeleton
  return <AvatarSkeleton />
}
```

### Empfohlene Lösung (Kombination)

1. **Sofortiges Laden ohne Delay** (Option 3):
   - Entferne das 500ms Delay in `fetchProfilesForIds` für das initiale Laden
   - Oder reduziere es auf 100ms

2. **Loading-State für Avatare** (Option 1):
   - Zeige einen kleinen Skeleton/Loading-Indikator wenn Profile noch nicht geladen sind
   - Verhindert "flackernde" Initialen

3. **Re-Fetch wenn fehlend** (Option 2):
   - Wenn `renderSpotAvatars` aufgerufen wird und Profile fehlen, trigger einen Re-Fetch
   - Verwendet `useEffect` oder `useMemo` mit Dependency auf Profile-State

4. **Profile-Store prüfen**:
   - Stelle sicher, dass `ensureProfiles` auch Profile ohne Avatar-URL korrekt cached
   - Prüfe, ob der Profile-Store einen Re-Validation-Mechanismus hat

### Konkrete Code-Änderungen

**Datei: `src/pages/shared/SharedTierList.jsx`**

1. **Zeile 127**: Delay reduzieren oder entfernen:
```jsx
// Vorher:
if (retryCount === 0) {
  await new Promise(resolve => setTimeout(resolve, 500))
}

// Nachher:
if (retryCount === 0) {
  await new Promise(resolve => setTimeout(resolve, 100)) // Reduziert
}
```

2. **Zeile 283-285**: Sofortiges Laden + Retry:
```jsx
// Vorher:
if (userIdSet.size > 0) {
  await fetchProfilesForIds(Array.from(userIdSet))
}

// Nachher:
if (userIdSet.size > 0) {
  const userIds = Array.from(userIdSet)
  await fetchProfilesForIds(userIds)
  
  // Prüfe ob alle Profile geladen sind
  const missingIds = userIds.filter(id => !getProfile(id))
  if (missingIds.length > 0) {
    console.log('[SharedTierList] Retrying missing profiles:', missingIds.length)
    await new Promise(resolve => setTimeout(resolve, 300))
    await fetchProfilesForIds(missingIds, 1)
  }
}
```

3. **Zeile 436-461**: Loading-State hinzufügen:
```jsx
// In renderSpotAvatars, Zeile 436:
const profile = getProfileForUser(userId)
const size = index === 0 ? 26 : 20
const isOwner = ownerId ? userId === ownerId && index === 0 : index === 0
const displayInitial = profile?.username?.charAt(0)?.toUpperCase() || '🍽️'
const avatarUrl = profile?.profile_visibility === 'private' ? null : profile?.avatar_url
const isProfileLoading = !profile && userId // Profile noch nicht geladen

return (
  <div
    key={`${spot.id}-${userId}-${index}`}
    className={`flex items-center justify-center rounded-full overflow-hidden ${
      isOwner ? 'ring-2 ring-offset-2 ring-[#FF7E42]' : ''
    } ${isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100 border border-gray-300'}`}
    style={{ width: size, height: size }}
    title={profile?.username || 'Mitglied'}
  >
    {isProfileLoading ? (
      // Loading-State
      <div className="w-full h-full animate-pulse bg-gray-400" />
    ) : avatarUrl ? (
      <img
        src={avatarUrl}
        alt={profile?.username || 'Avatar'}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback wenn Bild nicht lädt
          e.target.style.display = 'none'
          e.target.nextSibling?.style.display = 'flex'
        }}
      />
    ) : (
      <span className="text-xs">
        {displayInitial}
      </span>
    )}
  </div>
)
```

4. **Neuer useEffect für Re-Fetch** (nach Zeile 374):
```jsx
// Re-Fetch Profile wenn sie in renderSpotAvatars fehlen
useEffect(() => {
  if (!list || !foodspots.length) return
  
  // Sammle alle benötigten User-IDs
  const neededUserIds = new Set()
  foodspots.forEach(spot => {
    if (spot.first_uploader_id) neededUserIds.add(spot.first_uploader_id)
    const ratings = spotRatings[spot.id] || []
    ratings.forEach(r => r.user_id && neededUserIds.add(r.user_id))
    const photos = spotPhotos[spot.id] || []
    photos.forEach(p => p.uploader_user_id && neededUserIds.add(p.uploader_user_id))
    if (list.user_id) neededUserIds.add(list.user_id)
  })
  
  // Prüfe welche Profile fehlen
  const missingIds = Array.from(neededUserIds).filter(id => !getProfile(id))
  
  if (missingIds.length > 0) {
    console.log('[SharedTierList] Re-fetching missing profiles:', missingIds.length)
    fetchProfilesForIds(missingIds)
  }
}, [foodspots, spotRatings, spotPhotos, list, getProfile, fetchProfilesForIds])
```

---

## Zusammenfassung

### Problem 1: Editor-Einladungen
- **Ursache:** RLS Policy erlaubt nur Owner, Einladungen zu erstellen
- **Lösung:** Neue Policy für Editoren hinzufügen (Migration 041)
- **Aufwand:** Niedrig (1 Migration-Datei)
- **Risiko:** Niedrig (Backend-Sicherheit bleibt gewährleistet)

### Problem 2: Avatar-Laden
- **Ursache:** Race Condition + Timing-Problem beim Profile-Laden
- **Lösung:** Kombination aus optimiertem Laden + Loading-State + Re-Fetch
- **Aufwand:** Mittel (mehrere kleine Änderungen)
- **Risiko:** Niedrig (nur UI-Verbesserungen)

### Nächste Schritte

1. **Editor-Einladungen:**
   - Migration 041 erstellen und testen
   - Im Supabase SQL Editor ausführen
   - Im Frontend testen (Editor sollte jetzt einladen können)

2. **Avatar-Laden:**
   - Schrittweise umsetzen (zuerst Option 3, dann Option 1, dann Option 4)
   - Jeden Schritt testen
   - Falls Problem bleibt, Option 2 hinzufügen

