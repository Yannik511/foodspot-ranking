import { useEffect, useState } from 'react'

/**
 * Meldet erst dann "es laedt", wenn das Laden laenger dauert als die
 * Verzoegerung.
 *
 * Hintergrund: eine Ladeanzeige, die nur kurz aufblitzt, laesst eine App
 * LANGSAMER wirken, nicht schneller — das Auge nimmt den Wechsel als Ruckeln
 * wahr. Ist der Screen in unter ~250ms fertig, zeigt man deshalb besser gar
 * nichts und laesst ihn einfach erscheinen.
 *
 * @param {boolean} active  Laeuft gerade ein Ladevorgang?
 * @param {number} delayMs  Ab wann die Anzeige erscheinen darf.
 */
export function useDelayedLoading(active, delayMs = 250) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return undefined
    }
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [active, delayMs])

  return visible
}
