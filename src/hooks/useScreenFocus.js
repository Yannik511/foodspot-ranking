import { createContext, useContext, useEffect, useRef } from 'react'

// Der NavStack haelt Screens am Leben, statt sie beim Verlassen abzubauen.
// Das ist gewollt (Zustand und Scrollposition bleiben, nichts laedt neu nach),
// hat aber eine Kehrseite: ein Screen bemerkt von sich aus nicht mehr, wenn er
// zurueck in den Vordergrund kommt. Frueher erledigte das der Neuaufbau.
//
// Native Navigations-Stapel loesen das mit einem Fokus-Ereignis — genau das
// ist das hier.

export const NavLayerContext = createContext({ isActive: true })

/**
 * Ruft `onFocus`, sobald dieser Screen wieder nach vorne kommt.
 * Beim ersten Aufbau bewusst NICHT — da laedt der Screen ohnehin selbst.
 */
export function useScreenFocus(onFocus) {
  const { isActive } = useContext(NavLayerContext)
  const wasActive = useRef(isActive)
  const callbackRef = useRef(onFocus)
  callbackRef.current = onFocus

  useEffect(() => {
    if (isActive && !wasActive.current) callbackRef.current()
    wasActive.current = isActive
  }, [isActive])
}
