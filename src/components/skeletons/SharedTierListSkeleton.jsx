// Platzhalter fuer die GETEILTE Tier-Liste (shared/SharedTierList.jsx).
//
// Bewusst ein eigenes Skeleton: die geteilte Liste sieht ganz anders aus als
// die private. Statt kompakter Reihen gibt es pro Tier eine Section mit
// Emoji-Kachel, Ueberschrift "S-Tier" und Spot-Anzahl, darunter Spot-Karten.
//
// Masse aus dem echten Screen:
//   Content   absolute, top: calc(60px + safe-area), paddingTop 24
//   Innen     max-w-5xl mx-auto px-4 py-6, space-y-12
//   Kopf      Kachel 64x64 rounded-2xl, gap-4, mb-4
//   Karten    grid 1/2/3 Spalten, gap-4, rounded-2xl p-4 mit Rahmen
//
// Nur die ersten zwei Tiers werden angedeutet — mehr passt ohnehin nicht auf
// den Schirm, und leere Platzhalter unterhalb der Falz kosten nur Layout.

const TIERS = [
  { tier: 'S', gradient: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)', emoji: '🍕' },
  { tier: 'A', gradient: 'linear-gradient(135deg, #FB8C00 0%, #E65100 100%)', emoji: '🍔' },
]

function SharedTierListSkeleton({ isDark }) {
  const pulse = isDark ? 'bg-gray-700' : 'bg-gray-200'
  const card = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'

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

      <div
        className="absolute overflow-hidden"
        style={{
          top: 'calc(60px + env(safe-area-inset-top, 0px))',
          bottom: 0,
          left: 0,
          right: 0,
          paddingTop: 24,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-12">
          {TIERS.map(({ tier, gradient, emoji }) => (
            <section key={tier}>
              {/* Kopf der Section — Kachel und Tier-Name stehen sofort fest */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl flex-shrink-0"
                  style={{ background: gradient }}
                >
                  {emoji}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {tier}-Tier
                  </h2>
                  <div className={`h-4 w-16 rounded mt-1 animate-pulse ${pulse}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[0, 1].map((i) => (
                  <div key={i} className={`rounded-2xl p-4 border shadow-sm ${card}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className={`h-5 rounded animate-pulse mb-2 ${pulse}`} style={{ maxWidth: 150 }} />
                        <div className={`h-3 rounded animate-pulse mb-2 ${pulse}`} style={{ maxWidth: 110 }} />
                        <div className={`h-3 rounded animate-pulse ${pulse}`} style={{ maxWidth: 80 }} />
                      </div>
                      <div className={`w-14 h-14 rounded-xl flex-shrink-0 animate-pulse ${pulse}`} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SharedTierListSkeleton
