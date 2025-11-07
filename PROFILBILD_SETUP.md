# 📸 Profilbild-Upload Setup

## ✅ Was wurde implementiert

Die Profilbild-Funktion ist vollständig implementiert:

1. **Dynamischer Button-Text**: 
   - "Profilbild hinzufügen" wenn noch kein Bild vorhanden
   - "Profilbild ändern" wenn bereits ein Bild vorhanden

2. **Upload-Funktionalität**:
   - Bildauswahl über Datei-Picker
   - Automatische Komprimierung (max. 512×512px, < 200 KB)
   - Upload zu Supabase Storage
   - Update der `user_metadata.profileImageUrl`
   - Automatisches Cache-Busting für sofortige Aktualisierung

3. **Fehlerbehandlung**:
   - Toast-Benachrichtigungen für Erfolg/Fehler
   - Validierung (Dateityp, Dateigröße)
   - Fallback auf Initiale bei Fehlern

## 🔧 Datenbank-Setup (Supabase)

### Schritt 1: Storage Bucket erstellen

1. Gehe zu deinem Supabase Dashboard
2. Navigiere zu **Storage** → **Buckets**
3. Klicke auf **New Bucket**
4. Fülle aus:
   - **Name**: `profile-avatars` (wichtig: genau dieser Name!)
   - **Public bucket**: ❌ **AUS** (private Bucket)
   - **File size limit**: 2 MB (optional, aber empfohlen)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp` (optional)
5. Klicke auf **Create bucket**

### Schritt 2: Storage Policies anwenden

1. Gehe zu **Storage** → **Policies**
2. Wähle den Bucket `profile-avatars`
3. Öffne die SQL-Konsole: **SQL Editor** → **New Query**
4. Kopiere und füge den Inhalt von `AVATAR_SETUP.sql` ein
5. Führe das SQL-Script aus

**Wichtig**: Die Policies ermöglichen:
- ✅ User können nur ihre eigenen Avatare hochladen (`{userId}/avatar.jpg`)
- ✅ User können nur ihre eigenen Avatare lesen
- ✅ User können nur ihre eigenen Avatare löschen
- ✅ Öffentlicher Zugriff zum Anzeigen (wenn Bucket public wäre)

### Schritt 3: Keine Datenbank-Tabelle nötig! ✅

**Das Profilbild wird in `user.user_metadata.profileImageUrl` gespeichert.**

Supabase Auth verwaltet `user_metadata` automatisch - **keine zusätzliche Tabelle nötig!**

Die URL wird über die Supabase Auth API gespeichert:
```javascript
await supabase.auth.updateUser({
  data: {
    profileImageUrl: 'https://...supabase.co/storage/v1/object/public/profile-avatars/...'
  }
})
```

## 📁 Storage-Struktur

Die Avatare werden gespeichert als:
```
profile-avatars/
  {userId}/
    avatar.jpg
```

Beispiel:
```
profile-avatars/
  123e4567-e89b-12d3-a456-426614174000/
    avatar.jpg
```

## 🔄 Funktionsweise

1. **Upload**:
   - User wählt Bild aus
   - Bild wird komprimiert (512×512px, < 200 KB)
   - Upload zu `profile-avatars/{userId}/avatar.jpg`
   - Altes Avatar wird automatisch gelöscht (falls vorhanden)

2. **Speicherung**:
   - Public URL wird abgerufen
   - URL wird in `user.user_metadata.profileImageUrl` gespeichert
   - Page-Reload aktualisiert alle Avatare überall

3. **Anzeige**:
   - Avatar-Komponente liest `user.user_metadata.profileImageUrl`
   - Falls nicht vorhanden → Initiale + Seed-Farbe
   - Cache-Busting via Query-Parameter (`?v={timestamp}`)

## ✅ Testen

1. Gehe zu **Account & Einstellungen**
2. Klicke auf **"Profilbild hinzufügen"** (oder "ändern")
3. Wähle ein Bild aus
4. Warte auf Upload (Spinner)
5. Toast-Benachrichtigung erscheint
6. Seite lädt neu → Avatar ist überall aktualisiert

## 🐛 Troubleshooting

### "Bucket not found"
- Prüfe, ob Bucket `profile-avatars` existiert
- Prüfe, ob der Name exakt stimmt (keine Leerzeichen!)

### "new row violates row-level security policy"
- Prüfe, ob Storage Policies korrekt erstellt wurden
- Prüfe, ob User eingeloggt ist

### "Upload fehlgeschlagen"
- Prüfe Browser-Konsole für Fehler
- Prüfe Supabase Dashboard → Storage → Logs
- Prüfe Dateigröße (max. 5 MB vor Komprimierung)

### "Bild wird nicht angezeigt"
- Prüfe Browser-Konsole (CORS-Fehler?)
- Prüfe, ob Bucket public ist (oder Public-Policy aktiv)
- Prüfe, ob URL in `user_metadata.profileImageUrl` korrekt gespeichert ist

## 📝 Zusammenfassung

**Was in der Datenbank gemacht werden muss:**
1. ✅ Storage Bucket `profile-avatars` erstellen (private)
2. ✅ Storage Policies aus `AVATAR_SETUP.sql` anwenden
3. ✅ **Keine Tabelle nötig** - Auth Metadata wird automatisch verwaltet

**Das war's!** 🎉 Die Funktion ist vollständig implementiert und einsatzbereit.



