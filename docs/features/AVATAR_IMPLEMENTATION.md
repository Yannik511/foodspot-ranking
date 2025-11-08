# Avatar-Implementierung

## Übersicht

Die Avatar-Komponente wurde implementiert und ist im Header und auf der Welcome-Card integriert.

## Implementierte Features

### 1. Avatar-Komponente (`src/components/Avatar.jsx`)
- ✅ Kreisförmiges Avatar (36-40px im Header)
- ✅ Quadratisches Avatar auf Welcome-Card (96-120px)
- ✅ Fallback: Initiale + deterministische Seed-Farbe
- ✅ Profilbild-Anzeige (wenn vorhanden)
- ✅ Cache-Busting Support
- ✅ Accessibility: aria-label, Hit-Area ≥ 44×44pt
- ✅ Border und Shadow für bessere Sichtbarkeit

### 2. Dashboard Header
- ✅ "G"-Badge ersetzt durch Avatar-Komponente
- ✅ Tap auf Avatar navigiert zu `/account`
- ✅ Hit-Area: 44×44pt

### 3. Welcome-Card
- ✅ Burger-Icon ersetzt durch Avatar
- ✅ Quadratisches Layout (160px, 20px Radius)
- ✅ Gleicher Fallback wie Header
- ✅ Synchrones Update bei Profilbild-Änderung

### 4. Account-Seite (`src/pages/Account.jsx`)
- ✅ Route: `/account`
- ✅ Avatar-Anzeige
- ✅ Platzhalter für "Profilbild ändern" Button
- ✅ Vorbereitet für Upload-Funktionalität

## Noch zu implementieren (später)

### Profilbild-Upload
1. **Image Picker**: Galerie/Kamera öffnen
2. **Crop**: Quadratischer Crop (512×512px)
3. **Komprimierung**: JPEG/WebP, < 200 KB
4. **Upload**: Nach `profile-avatars/{userId}/avatar.jpg`
5. **Update**: `user.user_metadata.profileImageUrl` aktualisieren
6. **Cache-Busting**: `?v={timestamp}` Query-Param

### Storage Setup
1. Bucket `profile-avatars` erstellen (private)
2. Storage Policies anwenden (siehe `AVATAR_SETUP.sql`)
3. Upload-Funktion implementieren

### Fehlerbehandlung
- Upload-Fehler: Fallback auf Initiale + Toast
- Fehlende Berechtigungen: System-Prompt
- Invalidierung: Automatisches Cache-Busting

## Verwendung

```jsx
// Im Header
<Avatar size={40} onClick={() => navigate('/account')} />

// Auf Welcome-Card
<Avatar size={160} shape="square" showBorder={false} />

// Mit Cache-Busting
<Avatar size={40} cacheBust={Date.now()} />
```

## Seed-Farben

Die Farben werden deterministisch aus der `user.id` generiert:
- Orange, Blue, Green, Yellow, Purple, Pink Töne
- Pastell-Farben mit gutem Kontrast zu Weiß
- Konsistent für jeden User

## Nächste Schritte

1. Storage-Bucket in Supabase erstellen
2. Storage Policies anwenden (`AVATAR_SETUP.sql`)
3. Upload-Funktion in Account-Seite implementieren
4. Image-Komprimierung hinzufügen
5. Fehlerbehandlung verbessern



