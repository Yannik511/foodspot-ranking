import { useEffect } from 'react'

// Screens und Sheets, die die Zurueck-Geste voruebergehend nicht wollen,
// melden sich hier an. Bewusst ein Zaehler auf Modulebene statt eines
// Contexts: die Geste laeuft ausserhalb des React-Renderzyklus und braucht
// die Antwort sofort, nicht erst beim naechsten Render.
let disabledCount = 0

/** Solange `active` gilt, ist die Zurueck-Geste abgeschaltet. */
export function useDisableSwipeBack(active) {
  useEffect(() => {
    if (!active) return undefined
    disabledCount += 1
    return () => { disabledCount = Math.max(0, disabledCount - 1) }
  }, [active])
}

export function isSwipeBackDisabled() {
  return disabledCount > 0
}
