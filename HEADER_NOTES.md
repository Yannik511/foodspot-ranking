# Header-Lösung Dokumentation

## Übersicht
Diese Dokumentation beschreibt die Implementierung der fixen Header-Lösung, die in der App verwendet wurde, bevor der Reset auf "chore: finalize ui polish and icons" durchgeführt wurde.

## Betroffene Dateien

### CSS-Dateien
- `src/index.css` - Globale CSS-Klassen für Layout-Struktur

### Page-Komponenten (alle verwenden die gleiche Struktur)
- `src/pages/Dashboard.jsx`
- `src/pages/Social.jsx`
- `src/pages/Account.jsx`
- `src/pages/Settings.jsx`
- `src/pages/TierList.jsx`
- `src/pages/CreateList.jsx`
- `src/pages/AddFoodspot.jsx`
- `src/pages/About.jsx`
- `src/pages/SelectCategory.jsx`
- `src/pages/Compare.jsx`
- `src/pages/FriendProfile.jsx`
- `src/pages/shared/SharedTierList.jsx`
- `src/pages/shared/AddSharedFoodspot.jsx`

## Layout-Struktur

### CSS-Klassen (in `src/index.css`)

```css
/* Mobile app layout: fixed header + scrollable content + fixed bottom nav */
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.app-header {
  flex-shrink: 0;
  position: relative;
  z-index: 20;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.app-bottom-nav {
  flex-shrink: 0;
  position: relative;
  z-index: 20;
}
```

### HTML-Struktur in jeder Page-Komponente

```jsx
<div className={`app-layout ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
  {/* Header */}
  <header className="app-header header-safe border-b ...">
    {/* Header-Inhalt */}
  </header>
  
  {/* Content */}
  <main className="app-content px-4 py-6">
    {/* Scrollbarer Inhalt */}
  </main>
  
  {/* Bottom Navigation (optional, nur im Dashboard) */}
  <nav className="app-bottom-nav ...">
    {/* Bottom-Navigation */}
  </nav>
</div>
```

## Konzept

### Flexbox-Layout
- **`.app-layout`**: Flex-Container mit `flex-direction: column`
  - `height: 100vh / 100dvh`: Nimmt volle Viewport-Höhe ein
  - `overflow: hidden`: Verhindert Scrollen des gesamten Containers
  
- **`.app-header`**: 
  - `flex-shrink: 0`: Header behält immer seine Höhe
  - `position: relative`: Bleibt im normalen Flow
  - `z-index: 20`: Über dem Content
  
- **`.app-content`**:
  - `flex: 1`: Nimmt verbleibenden Platz ein
  - `overflow-y: auto`: Nur dieser Bereich scrollt
  - `overscroll-behavior: contain`: Verhindert "Rubberband"-Effekt
  
- **`.app-bottom-nav`**:
  - `flex-shrink: 0`: Bottom-Nav behält immer ihre Höhe
  - `position: relative`: Bleibt im normalen Flow

### Safe Area Handling
- Header verwendet `header-safe` Klasse mit:
  ```css
  .header-safe {
    padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
    padding-bottom: 12px;
    min-height: calc(60px + env(safe-area-inset-top, 0px));
  }
  ```

### Vorteile dieser Lösung
1. **Native App-Feeling**: Header und Bottom-Nav bleiben fix, nur Content scrollt
2. **Konsistent**: Gleiche Struktur auf allen Screens
3. **Responsive**: Funktioniert mit Safe Areas (Dynamic Island, Notch)
4. **Performance**: Kein `position: fixed`, nutzt Flexbox für bessere Performance

### Wichtige Punkte für Re-Implementation
1. **Global CSS**: Die `.app-layout`, `.app-header`, `.app-content`, `.app-bottom-nav` Klassen müssen in `src/index.css` definiert sein
2. **Root-Container**: Jede Page-Komponente muss `app-layout` als Root-Container haben
3. **Header**: Muss `app-header` Klasse haben, kann zusätzlich `header-safe` für Safe-Area-Padding verwenden
4. **Content**: Muss `app-content` Klasse haben - nur dieser Bereich scrollt
5. **Bottom-Nav**: Optional, nur wo benötigt (z.B. Dashboard), verwendet `app-bottom-nav`

## Bekannte Probleme (vor Reset)
- Weißer Spalt unten in PWA nach "Zum Home-Bildschirm hinzufügen"
- Verursacht durch `env(safe-area-inset-bottom)` in `paddingBottom` der Bottom-Navigation
- Lösung: `paddingBottom` ohne Safe-Area verwenden oder komplett entfernen

## Wiederverwendbare Komponenten
- CSS-Klassen in `src/index.css` können direkt übernommen werden
- Layout-Struktur kann als Template für neue Screens verwendet werden
- `header-safe` Klasse für Safe-Area-Handling ist bereits vorhanden






