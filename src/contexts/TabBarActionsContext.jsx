import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { NavLayerContext } from '../hooks/useScreenFocus'

const TabBarActionsContext = createContext(null)

export function TabBarActionsProvider({ children }) {
  const actionRef = useRef(null)
  const [hasAction, setHasAction] = useState(false)
  const [tabBarHidden, setTabBarHidden] = useState(false)

  const register = useCallback((fn) => {
    actionRef.current = fn ?? null
    setHasAction(fn != null)
  }, [])

  const trigger = useCallback(() => {
    actionRef.current?.()
  }, [])

  return (
    <TabBarActionsContext.Provider value={{ register, trigger, hasAction, tabBarHidden, setTabBarHidden }}>
      {children}
    </TabBarActionsContext.Provider>
  )
}

export function usePlusAction(fn, deps) {
  const ctx = useContext(TabBarActionsContext)
  // Screens bleiben im NavStack am Leben, auch wenn ein anderer vor ihnen
  // liegt. Ohne diesen Bezug passierte Folgendes: der obere Screen raeumte
  // beim Verlassen mit register(null) auf, der Screen darunter registrierte
  // aber nie neu — sein Effekt lief ja nicht wieder. Ergebnis: nach dem
  // Zurueckwischen fehlte das Plus, bis man den Screen neu betrat.
  const { isActive } = useContext(NavLayerContext)
  const fnRef = useRef(fn)

  useEffect(() => { fnRef.current = fn })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Nur der vorderste Screen bestimmt, was das Plus tut. Das verhindert
    // nebenbei, dass ein Screen im Hintergrund die Aktion des sichtbaren
    // ueberschreibt.
    if (!isActive) return undefined
    ctx.register(fn != null ? () => fnRef.current() : null)
    return () => ctx.register(null)
  }, [...(Array.isArray(deps) ? deps : []), isActive])
}

export function useTabBarActions() {
  return useContext(TabBarActionsContext)
}
