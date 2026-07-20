import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { hapticFeedback } from '../utils/haptics'

/**
 * SaveStatusContext — EIN zentrales, app-weites Speicher-Feedback.
 *
 * Jeder Speichervorgang (Spot anlegen, bewerten, bearbeiten, Liste erstellen …)
 * läuft hier durch und wird von einer einzigen, konsistenten Pille (SaveStatusOverlay)
 * angezeigt. Weil der Provider ganz oben in der App sitzt, bleibt die Animation
 * über Screen-Wechsel hinweg sichtbar — sie läuft so lange, bis der Vorgang wirklich
 * abgeschlossen ist (z. B. bis der Spot als echter DB-Eintrag in der Liste sitzt),
 * und quittiert dann mit Häkchen bzw. Fehler.
 *
 * API:
 *   beginSave(id, label)      → Zustand 'saving', Pille erscheint
 *   resolveSave(id, label?)   → Zustand 'success', Häkchen-Pop + Erfolgs-Haptik, auto-Ausblenden
 *   failSave(id, message)     → Zustand 'error', Wackeln + Fehler-Haptik, auto-Ausblenden
 *
 * Die id koppelt Start/Ende: resolve/fail wirken nur, wenn sie zur aktuell laufenden
 * Operation gehören (verhindert, dass ein alter Vorgang eine neue Pille überschreibt).
 */

const SaveStatusContext = createContext(null)

const SUCCESS_HOLD_MS = 1500
const ERROR_HOLD_MS = 2800

export function SaveStatusProvider({ children }) {
  const [op, setOp] = useState(null) // { id, label, state: 'saving' | 'success' | 'error' }
  const opRef = useRef(null)
  const timerRef = useRef(null)

  const setOpBoth = useCallback((next) => {
    opRef.current = next
    setOp(next)
  }, [])

  const beginSave = useCallback((id, label) => {
    clearTimeout(timerRef.current)
    setOpBoth({ id, label: label || 'Wird gespeichert…', state: 'saving' })
  }, [setOpBoth])

  const resolveSave = useCallback((id, label) => {
    // Nur quittieren, wenn diese Operation gerade läuft (sonst veraltet).
    if (!opRef.current || opRef.current.id !== id) return
    setOpBoth({ id, label: label || 'Gespeichert', state: 'success' })
    hapticFeedback.success()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (opRef.current?.id === id) setOpBoth(null)
    }, SUCCESS_HOLD_MS)
  }, [setOpBoth])

  const failSave = useCallback((id, message) => {
    if (!opRef.current || opRef.current.id !== id) return
    setOpBoth({ id, label: message || 'Speichern fehlgeschlagen', state: 'error' })
    hapticFeedback.error()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (opRef.current?.id === id) setOpBoth(null)
    }, ERROR_HOLD_MS)
  }, [setOpBoth])

  return (
    <SaveStatusContext.Provider value={{ op, beginSave, resolveSave, failSave }}>
      {children}
    </SaveStatusContext.Provider>
  )
}

export function useSaveStatus() {
  const ctx = useContext(SaveStatusContext)
  if (!ctx) {
    // Fallback, falls (versehentlich) ohne Provider genutzt — no-ops statt Crash.
    return { op: null, beginSave: () => {}, resolveSave: () => {}, failSave: () => {} }
  }
  return ctx
}
