import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * SaveButton — der einheitliche runde Gradient-Speichern-Button (Häkchen oben rechts).
 *
 * Zeigt beim Antippen sofort einen dezenten Lade-Spinner. Die eigentliche
 * Erfolgs-/Fehler-Rückmeldung übernimmt die globale Save-Pille (SaveStatusOverlay),
 * damit es app-weit genau EINE konsistente Erfolgsanimation gibt.
 *
 * Zwei Nutzungsarten:
 *   1) Self-managed: <SaveButton onSave={async () => { await doSave() }} />
 *      onSave wird awaited; der Spinner läuft, bis das Promise auflöst/wirft.
 *   2) Controlled (Alt-API): <SaveButton onClick={...} saving={bool} />
 */
export default function SaveButton({
  onSave,
  onClick,
  saving = false,
  disabled = false,
  isDark = false,
  size = 40,
  label = 'Speichern',
}) {
  const [busy, setBusy] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  const runManaged = useCallback(async () => {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onSave()
    } catch {
      // Fehler-Rückmeldung erfolgt über die globale Save-Pille.
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [busy, disabled, onSave])

  const managed = typeof onSave === 'function'
  const isBusy = managed ? busy : saving
  const inactive = disabled || isBusy
  const handleClick = managed ? runManaged : onClick

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={inactive}
      aria-label={label}
      aria-busy={isBusy}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: 'none',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: inactive ? 'default' : 'pointer',
        background: isDark
          ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
          : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
        boxShadow: '0 2px 10px rgba(255,126,66,0.35)',
        opacity: disabled && !isBusy ? 0.4 : 1,
        transition: 'transform var(--dur-fast) var(--ease-spring), opacity 0.2s ease',
        transform: isBusy ? 'scale(0.96)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <style>{`@keyframes sb-spin { to { transform: rotate(360deg); } }`}</style>
      {isBusy ? (
        <span
          style={{
            width: Math.round(size * 0.46),
            height: Math.round(size * 0.46),
            borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            animation: 'sb-spin 0.7s linear infinite',
            display: 'block',
          }}
        />
      ) : (
        <svg
          width={Math.round(size * 0.6)} height={Math.round(size * 0.6)}
          viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
