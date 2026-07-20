/**
 * Skeleton-Primitive — eine gemeinsame Basis für alle Ladezustände der App.
 *
 * Alle Skeletons nutzen denselben Shimmer-Sweep (.skeleton-shimmer aus index.css),
 * damit sich jeder Ladezustand identisch anfühlt. Maße sollten exakt dem finalen
 * Inhalt entsprechen, damit beim Erscheinen der echten Daten kein Layout-Sprung entsteht.
 */

// Basis-Baustein: rechteckige Shimmer-Fläche mit frei wählbaren Maßen/Radius.
export function SkeletonBox({ className = '', style = {}, rounded = '12px' }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ borderRadius: rounded, ...style }}
    />
  )
}

// Textzeile — Höhe entspricht typischer Zeilenhöhe.
export function SkeletonLine({ width = '100%', height = 14, className = '', style = {} }) {
  return (
    <SkeletonBox
      className={className}
      rounded="999px"
      style={{ width, height, ...style }}
    />
  )
}

// Kreis (Avatare, Icon-Buttons).
export function SkeletonCircle({ size = 40, className = '', style = {} }) {
  return (
    <SkeletonBox
      className={className}
      rounded="50%"
      style={{ width: size, height: size, flexShrink: 0, ...style }}
    />
  )
}

export default SkeletonBox
