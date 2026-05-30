import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

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
  const fnRef = useRef(fn)

  useEffect(() => { fnRef.current = fn })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    ctx.register(fn != null ? () => fnRef.current() : null)
    return () => ctx.register(null)
  }, deps)
}

export function useTabBarActions() {
  return useContext(TabBarActionsContext)
}
