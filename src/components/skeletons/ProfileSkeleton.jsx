// Platzhalter fuer den Profil-Screen waehrend die Statistiken laden.
// Bildet bewusst die FINALE Layoutform nach (Hero-Card, Umschalter, KPI-Grid,
// Podium, Top-10-Liste), damit beim Eintreffen der Daten nichts springt.
// Muster (animate-pulse + graue Flaechen) wie in FriendProfile/FriendsTab.

function Bar({ isDark, className = '', style }) {
  return (
    <div
      className={`rounded animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'} ${className}`}
      style={style}
    />
  )
}

function ProfileSkeleton({ isDark }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6" aria-hidden="true">
      {/* Hero-Card: Avatar + Name + Meta + Button */}
      <div className={`rounded-[24px] shadow-lg border p-8 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div
            className={`rounded-full flex-shrink-0 animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
            style={{ width: 100, height: 100 }}
          />
          <div className="flex-1 w-full flex flex-col items-center sm:items-start">
            <Bar isDark={isDark} className="h-7 w-44 mb-2" />
            <Bar isDark={isDark} className="h-4 w-28 mb-2" />
            <Bar isDark={isDark} className="h-4 w-36" />
            <Bar isDark={isDark} className="h-9 w-36 mt-4 rounded-[14px]" />
          </div>
        </div>
      </div>

      {/* Kontext-Umschalter */}
      <div className="flex justify-center sm:justify-start">
        <Bar isDark={isDark} className="h-11 w-72 rounded-full" />
      </div>

      {/* KPI-Grid — gleiche Spaltenaufteilung wie im echten Screen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-[20px] border p-4 ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
            }`}
          >
            <Bar isDark={isDark} className="h-8 w-16 mb-3" />
            <Bar isDark={isDark} className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Podium: mittlere Saeule hoeher, wie beim echten Treppchen */}
      <div className={`rounded-[24px] border p-6 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <Bar isDark={isDark} className="h-5 w-32 mb-6" />
        <div className="flex items-end justify-center gap-3">
          <Bar isDark={isDark} className="flex-1 rounded-2xl" style={{ height: 148, maxWidth: 120 }} />
          <Bar isDark={isDark} className="flex-1 rounded-2xl" style={{ height: 172, maxWidth: 120 }} />
          <Bar isDark={isDark} className="flex-1 rounded-2xl" style={{ height: 148, maxWidth: 120 }} />
        </div>
      </div>

      {/* Top-10-Liste */}
      <div className={`rounded-[24px] border p-4 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <Bar isDark={isDark} className="h-5 w-28 mb-4 ml-2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Bar isDark={isDark} className="h-8 w-8 rounded-lg flex-shrink-0" />
            <Bar isDark={isDark} className="h-4 flex-1" style={{ maxWidth: 200 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProfileSkeleton
