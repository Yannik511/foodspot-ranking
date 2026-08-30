// Platzhalter fuer die private Tier-Liste (TierList.jsx), solange sie laedt.
//
// Die Masse sind aus dem echten Screen uebernommen, damit beim Eintreffen der
// Daten nichts springt:
//   Header    fixed, header-safe, px-4 py-3, Knoepfe 40x40
//   Content   absolute, top: calc(88px + safe-area), px-4, paddingTop 24
//   Innen     max-w-5xl mx-auto, flex-col, gap-4
//   Reihe     rounded-[20px], Hoehe 120, Tier-Balken 80 breit
//
// Die geteilte Liste sieht voellig anders aus (Sections mit Ueberschrift statt
// kompakter Reihen) und hat ein eigenes Skeleton — hier NICHT wiederverwenden.
//
// Die Farbwerte stehen absichtlich hier: TierList.jsx und SharedTierList.jsx
// halten je eine eigene, zeichengleiche TIER_COLORS-Kopie. Zusammenlegen waere
// ein Umbau an beiden Screens.

const TIERS = [
  { tier: 'S', gradient: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)' },
  { tier: 'A', gradient: 'linear-gradient(135deg, #FB8C00 0%, #E65100 100%)' },
  { tier: 'B', gradient: 'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)' },
  { tier: 'C', gradient: 'linear-gradient(135deg, #7CB342 0%, #558B2F 100%)' },
  { tier: 'D', gradient: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)' },
]

function TierListSkeleton({ isDark }) {
  const pulse = isDark ? 'bg-gray-700' : 'bg-gray-200'

  return (
    <div aria-hidden="true">
      {/* Kopfzeile an derselben Stelle wie der echte Header */}
      <div className="header-safe fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className={`w-10 h-10 rounded-full animate-pulse ${pulse}`} />
          <div className={`h-5 rounded animate-pulse mx-2 flex-1 ${pulse}`} style={{ maxWidth: 180 }} />
          <div className={`w-10 h-10 rounded-full animate-pulse ${pulse}`} />
        </div>
      </div>

      {/* Inhalt exakt dort, wo ihn der echte Screen platziert */}
      <div
        className="absolute px-4 overflow-hidden"
        style={{
          top: 'calc(88px + env(safe-area-inset-top, 0px))',
          bottom: 0,
          left: 0,
          right: 0,
          paddingTop: 24,
          background: isDark ? '#111827' : '#F9FAFB',
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col gap-4 pt-0 pb-4">
          {TIERS.map(({ tier, gradient }, i) => (
            <div
              key={tier}
              className="flex rounded-[20px] overflow-hidden"
              style={{ height: 120, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }}
            >
              {/* Der Tier-Balken haengt an keinen Daten und steht sofort fest —
                  ihn gleich richtig zu zeigen laesst den Screen fertig wirken. */}
              <div
                className="w-20 flex items-center justify-center flex-shrink-0 h-full"
                style={{ background: gradient }}
              >
                <span className="text-5xl font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {tier}
                </span>
              </div>

              <div className={`flex-1 flex items-center gap-3 px-3 h-full ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    className={`rounded-xl animate-pulse ${pulse}`}
                    style={{ width: 84, height: 92, animationDelay: `${(i * 3 + j) * 60}ms` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TierListSkeleton
