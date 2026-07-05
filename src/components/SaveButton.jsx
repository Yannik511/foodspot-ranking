/**
 * SaveButton — runder Gradient-Speichern-Button für den Header (Häkchen oben).
 * Beim Speichern verwandelt sich das Häkchen dezent in eine Ladeanimation
 * (kein Standard-Overlay-Spinner). Wird in den geteilten Spot-/Bewertungs-Screens
 * verwendet, um dasselbe Pattern wie bei privaten Listen zu spiegeln.
 */
export default function SaveButton({
  onClick,
  saving = false,
  disabled = false,
  isDark = false,
  size = 40,
  label = 'Speichern',
}) {
  const isBusy = saving
  const inactive = disabled || saving

  return (
    <button
      type="button"
      onClick={onClick}
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
        opacity: disabled && !saving ? 0.4 : 1,
        transition: 'transform 0.15s ease, opacity 0.2s ease',
        transform: saving ? 'scale(0.96)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={(e) => { if (!inactive) e.currentTarget.style.transform = 'scale(0.9)' }}
      onPointerUp={(e) => { e.currentTarget.style.transform = saving ? 'scale(0.96)' : 'scale(1)' }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = saving ? 'scale(0.96)' : 'scale(1)' }}
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
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
