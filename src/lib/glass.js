// Zentrale „Liquid Glass"-Rezepte, damit alle transluzenten Flächen
// (Tab-Bar, Seiten-Header, Sheets) wie ein zusammenhängendes System wirken.
// Angelehnt an die Optik der BottomTabBar (blur + saturate + feiner Rand +
// inset-Highlight). Werte bewusst konservativ, damit Text lesbar bleibt.

export const GLASS_BLUR = 'blur(28px) saturate(180%)'

// Obere Seiten-Leiste: am Seitenanfang transparent, beim Scrollen Glas.
// Blur liegt immer an (wie bisher), nur Tönung/Rand/Schatten schalten mit `scrolled`.
export function glassHeaderStyle(isDark, scrolled) {
  const base = {
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
    transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
  }

  if (!scrolled) {
    return {
      ...base,
      background: 'transparent',
      borderBottom: '1px solid transparent',
      boxShadow: 'none',
    }
  }

  return isDark
    ? {
        ...base,
        background: 'rgba(20,20,24,0.62)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 1px 12px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
      }
    : {
        ...base,
        background: 'rgba(255,255,255,0.62)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
      }
}

// Persistente Glas-Leiste, die immer sichtbar über Inhalt liegt (z. B. Discover
// mit Filterleiste). Etwas kräftigere Tönung für bessere Lesbarkeit.
export function glassBarStyle(isDark) {
  const base = {
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
  }
  return isDark
    ? {
        ...base,
        background: 'rgba(20,20,24,0.72)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }
    : {
        ...base,
        background: 'rgba(255,255,255,0.72)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }
}

// Inhalts-Card mit dezentem Glas — frostet den soliden Card-Hintergrund
// leicht über dem Seitenhintergrund. Bewusst zurückhaltend (Lesbarkeit > Effekt).
export function glassCardStyle(isDark) {
  const base = {
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  }
  return isDark
    ? { ...base, background: 'rgba(28,28,30,0.72)', border: '1px solid rgba(255,255,255,0.06)' }
    : { ...base, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.7)' }
}

// Panel/Sheet-Fläche (Kopf- oder Fußleiste eines Sheets, Karten-Overlays).
export function glassPanelStyle(isDark) {
  const base = {
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
  }
  return isDark
    ? {
        ...base,
        background: 'rgba(20,20,24,0.75)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }
    : {
        ...base,
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(255,255,255,0.8)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }
}
