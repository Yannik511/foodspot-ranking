import { useTheme } from '../contexts/ThemeContext'
import { useSaveStatus } from '../contexts/SaveStatusContext'

/**
 * SaveStatusOverlay — die eine, konsistente Speicher-Pille der App.
 *
 * Wird genau einmal (auf App-Ebene) gerendert und zeigt den aktuellen
 * Speicher-Status aus dem SaveStatusContext. Bleibt über Screen-Wechsel
 * sichtbar, weil sie außerhalb der Routen-Ebene sitzt.
 *
 * Zustände nutzen dieselben Motion-Tokens wie der Rest der App:
 *   saving  → Shimmer-Spinner
 *   success → Häkchen-Pop (grün)
 *   error   → X + Wackeln (rot)
 */
export default function SaveStatusOverlay() {
  const { isDark } = useTheme()
  const { op } = useSaveStatus()

  if (!op) return null

  const { state, label } = op

  const accent =
    state === 'success' ? '#22C55E' :
    state === 'error' ? '#EF4444' :
    '#FF9357'

  const bg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'
  const textColor = isDark ? '#fff' : '#111'

  return (
    // Voll-breiter Flex-Wrapper zentriert die Pille OHNE transform.
    // Wichtig: die Zentrierung darf nicht über transform laufen, sonst würde
    // die Einblend-Animation (die selbst transform nutzt) sie überschreiben
    // und die Pille säße nach rechts versetzt.
    <div
      className="fixed left-0 right-0 z-[120]"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 16px',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        // key an den Zustand koppeln → Ein-Feder-Animation bei jedem Wechsel
        key={state}
        className={`animate-fade-slide-up ${state === 'error' ? 'animate-shake' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px 10px 12px',
          borderRadius: 999,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
          maxWidth: '84vw',
        }}
      >
        {/* Icon-Slot — feste Größe, damit die Pille beim Zustandswechsel nicht springt */}
        <span style={{
          width: 22, height: 22, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {state === 'saving' && (
            <span
              style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2.5px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                borderTopColor: accent,
                animation: 'sb-spin 0.7s linear infinite',
              }}
            />
          )}
          {state === 'success' && (
            <svg className="animate-check-pop" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke={accent} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
          {state === 'error' && (
            <svg width="19" height="19" viewBox="0 0 24 24"
              fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          )}
        </span>

        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 14, fontWeight: 600,
          color: textColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {label}
        </span>
      </div>

      <style>{`@keyframes sb-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
