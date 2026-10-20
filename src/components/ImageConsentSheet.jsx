import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useSaveStatus } from '../contexts/SaveStatusContext'
import { hapticFeedback } from '../utils/haptics'
import { setImageConsentRequester } from '../services/moderation'

// Einmalige Einwilligung zur KI-Bildprüfung (Apple 5.1.2(i)). Erscheint beim
// ersten Foto-Upload; assertImageAllowed() wartet auf die Antwort.
function ImageConsentSheet() {
  const { isDark } = useTheme()
  const { notify } = useSaveStatus()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const resolveRef = useRef(null)

  useEffect(() => {
    setImageConsentRequester(
      () =>
        new Promise((resolve) => {
          resolveRef.current = resolve
          setOpen(true)
        }),
    )
    return () => setImageConsentRequester(null)
  }, [])

  if (!open) return null

  const answer = (granted) => {
    setOpen(false)
    resolveRef.current?.(granted)
    resolveRef.current = null
    if (granted) {
      hapticFeedback.success()
    } else {
      notify('Ohne Zustimmung können keine Fotos hochgeladen werden')
    }
  }

  const openPrivacy = () => {
    answer(false)
    navigate('/privacy')
  }

  const text = isDark ? '#fff' : '#0f0f13'
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="animate-fade-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-consent-title"
        style={{
          width: '100%', maxWidth: 440, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '10px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: isDark ? '#1c1c1e' : '#fff',
          fontFamily: "'Poppins', sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{ width: 38, height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', margin: '6px auto 18px' }} />

        <div
          style={{
            width: 56, height: 56, borderRadius: 18, margin: '0 auto 12px', fontSize: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(255,126,66,0.14)' : 'rgba(255,126,66,0.10)',
          }}
          aria-hidden="true"
        >
          🛡️
        </div>

        <div id="image-consent-title" style={{ fontSize: 19, fontWeight: 700, color: text }}>
          Kurz zur Bildprüfung
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: muted, margin: '8px 0 0', fontFamily: "'Inter', sans-serif" }}>
          Damit Rankify für alle angenehm bleibt, prüfen wir hochgeladene Fotos automatisch auf
          anstößige Inhalte. Dafür wird <strong style={{ color: text }}>nur das Bild</strong> an den
          KI-Dienst <strong style={{ color: text }}>OpenAI (USA)</strong> gesendet – ohne deinen Namen,
          deine E-Mail oder andere Kontodaten.
        </p>
        <button
          onClick={openPrivacy}
          style={{
            marginTop: 8, padding: 4, border: 'none', background: 'transparent',
            color: '#FF7E42', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Mehr in der Datenschutzerklärung
        </button>

        <button
          onClick={() => answer(true)}
          style={{
            width: '100%', marginTop: 16, padding: 15, borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #FF7E42, #FFB25A)', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Einverstanden
        </button>
        <button
          onClick={() => answer(false)}
          style={{
            width: '100%', marginTop: 8, padding: 13, borderRadius: 14, border: 'none',
            background: 'transparent', color: muted, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Nicht jetzt
        </button>
      </div>
    </div>
  )
}

export default ImageConsentSheet
