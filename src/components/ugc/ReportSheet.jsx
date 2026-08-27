import { useTheme } from '../../contexts/ThemeContext'
import { hapticFeedback } from '../../utils/haptics'
import { REPORT_REASONS } from '../../constants/reportReasons'

// Wiederverwendbares Melde-Sheet. Zeigt die Melde-Gründe; onSubmit(reasonKey)
// wird beim Antippen eines Grundes aufgerufen.
function ReportSheet({ open, title = 'Melden', onClose, onSubmit, submitting = false }) {
  const { isDark } = useTheme()
  if (!open) return null

  const pick = (key) => {
    if (submitting) return
    hapticFeedback.light()
    onSubmit(key)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '10px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: isDark ? '#1c1c1e' : '#fff',
        }}
      >
        <div style={{ width: 38, height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', margin: '6px auto 14px' }} />
        <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: isDark ? '#fff' : '#0f0f13', fontFamily: "'Poppins', sans-serif" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, textAlign: 'center', marginBottom: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', fontFamily: "'Poppins', sans-serif" }}>
          Warum möchtest du das melden?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REPORT_REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => pick(r.key)}
              disabled={submitting}
              style={{
                width: '100%', textAlign: 'left', padding: '15px 16px', borderRadius: 14, border: 'none',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: isDark ? '#fff' : '#0f0f13', fontSize: 15, fontWeight: 500,
                fontFamily: "'Poppins', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            width: '100%', marginTop: 12, padding: '15px', borderRadius: 14, border: 'none',
            background: 'transparent', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
            fontSize: 15, fontWeight: 600, fontFamily: "'Poppins', sans-serif", cursor: 'pointer',
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

export default ReportSheet
