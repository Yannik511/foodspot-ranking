import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { isSwipeBackDisabled } from '../hooks/useDisableSwipeBack'

/**
 * Zurueck-Geste wie in iOS: vom linken Rand nach rechts ziehen.
 *
 * Damit der vorherige Screen dabei WIRKLICH dasteht (und nicht erst neu laedt),
 * bleibt er gemountet, nur ausgeblendet — wie ein nativer Navigations-Stack.
 * Nebeneffekt, den wir gerne mitnehmen: die Scrollposition bleibt erhalten.
 *
 * Wichtig zu `transform`: sobald ein Element eines hat, werden `position:fixed`
 * Kinder relativ zu IHM statt zum Viewport positioniert. Waehrend der Geste ist
 * genau das richtig (der ganze Screen wandert samt Header mit), danach muss der
 * transform aber wieder restlos WEG — nicht auf 0 gesetzt, sondern geleert.
 * Sonst haetten 17 Screens mit fixierten Headern hinterher kaputte Layouts.
 */

// Wie weit vom linken Rand die Geste beginnen darf (iOS nimmt rund 20px).
const EDGE_PX = 24
// Ab wie viel Bildschirmbreite der Wisch als durchgezogen gilt.
const COMMIT_RATIO = 0.35
// … oder wie schnell geschnippt werden muss (Pixel pro Millisekunde).
const COMMIT_VELOCITY = 0.45
// Wie weit der darunterliegende Screen zurueckliegt (Parallax wie in iOS).
const PARALLAX = 0.3
// Ab dieser Bewegung entscheiden wir, ob es ein Wisch oder ein Scroll ist.
const SLOP_PX = 8
const DURATION_MS = 280
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
// Tiefer muss der Stack nicht sein — jeder gehaltene Screen kostet Speicher
// und laesst seine Realtime-Abos weiterlaufen.
const MAX_DEPTH = 2

// Jeder Eintrag traegt zwei Kennungen:
//   id     — der React-key des Layers. Bleibt ueber ein REPLACE hinweg gleich,
//            sonst wuerde React den Screen abreissen und neu aufbauen.
//   locKey — der location.key von React Router, an dem wir erkennen, ob der
//            Stack noch zur aktuellen Adresse passt.
function nextStack(prev, location, navType) {
  if (navType === 'POP') {
    // Zurueck: bis zu dem Eintrag abschneiden, den wir schon kennen.
    const idx = prev.findIndex((e) => e.locKey === location.key)
    if (idx >= 0) {
      const kept = prev.slice(0, idx + 1)
      const last = kept[kept.length - 1]
      return [...kept.slice(0, -1), { ...last, locKey: location.key, location }]
    }
    // Unbekannt (z. B. vorwaerts im Verlauf) → neu anfangen.
    return [{ id: location.key, locKey: location.key, location }]
  }

  if (navType === 'REPLACE') {
    // Nur die Adresse tauschen, den Layer stehen lassen. Screens schreiben
    // ihre Ansicht teils per replace in die URL (Dashboard etwa den Tab) —
    // wuerden wir hier neu mounten, liefe das in eine Endlosschleife.
    const last = prev[prev.length - 1]
    const id = last?.id ?? location.key
    return [...prev.slice(0, -1), { id, locKey: location.key, location }]
  }

  const next = [...prev, { id: location.key, locKey: location.key, location }]
  return next.length > MAX_DEPTH ? next.slice(next.length - MAX_DEPTH) : next
}

function NavStack({ children }) {
  const location = useLocation()
  const navType = useNavigationType()
  const navigate = useNavigate()

  const [stack, setStack] = useState(() => [{ id: location.key, locKey: location.key, location }])
  const containerRef = useRef(null)
  const layerRefs = useRef(new Map())
  const dimRefs = useRef(new Map())
  const stackRef = useRef(stack)

  // Stack waehrend des Renders nachziehen — so gibt es keinen Frame, in dem
  // der Screen zur neuen Route noch fehlt.
  const top = stack[stack.length - 1]
  if (!top || top.locKey !== location.key) {
    setStack((prev) => nextStack(prev, location, navType))
  }
  stackRef.current = stack

  const setLayerRef = useCallback((key, node) => {
    if (node) layerRefs.current.set(key, node)
    else layerRefs.current.delete(key)
  }, [])

  const setDimRef = useCallback((key, node) => {
    if (node) dimRefs.current.set(key, node)
    else dimRefs.current.delete(key)
  }, [])

  // Nach jeder Stackaenderung alles in den Ruhezustand: transform LEEREN,
  // damit fixierte Header wieder am Viewport haengen.
  useLayoutEffect(() => {
    layerRefs.current.forEach((node) => {
      node.style.transition = ''
      node.style.transform = ''
      node.style.boxShadow = ''
      // will-change dauerhaft stehen zu lassen kostet Speicher und kann
      // Schrift unscharf zeichnen — nur waehrend der Geste.
      node.style.willChange = ''
    })
    dimRefs.current.forEach((node) => {
      node.style.transition = ''
      node.style.opacity = '0'
      node.style.display = 'none'
      node.style.willChange = ''
    })
    // Nur der oberste Screen ist sichtbar und bedienbar.
    const keys = stack.map((e) => e.id)
    layerRefs.current.forEach((node, key) => {
      node.style.display = key === keys[keys.length - 1] ? 'flex' : 'none'
    })
  }, [stack])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    let startX = 0
    let startY = 0
    let startT = 0
    let dx = 0
    let tracking = false
    let dragging = false
    let width = 0
    let rafId = null
    let pendingX = 0

    const topNode = () => {
      const s = stackRef.current
      return layerRefs.current.get(s[s.length - 1]?.id)
    }
    const belowNode = () => {
      const s = stackRef.current
      return layerRefs.current.get(s[s.length - 2]?.id)
    }
    const belowDim = () => {
      const s = stackRef.current
      return dimRefs.current.get(s[s.length - 2]?.id)
    }

    const paint = (x) => {
      const p = width ? Math.min(1, Math.max(0, x / width)) : 0
      const t = topNode()
      const b = belowNode()
      const d = belowDim()
      if (t) t.style.transform = `translate3d(${x}px,0,0)`
      if (b) b.style.transform = `translate3d(${-PARALLAX * width * (1 - p)}px,0,0)`
      if (d) d.style.opacity = String(0.18 * (1 - p))
    }

    // touchmove feuert auf iOS oefter als der Bildschirm zeichnet. Ungedrosselt
    // schreiben wir mehrfach pro Frame in den Stil — einmal pro Frame genuegt.
    const schedulePaint = (x) => {
      pendingX = x
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => { rafId = null; paint(pendingX) })
    }

    // Beide Ebenen auf eine eigene Compositor-Schicht heben. Ohne das muss der
    // Browser bei jedem Frame neu rastern — und weil die Header der App mit
    // backdrop-filter arbeiten, hiesse das: Weichzeichner pro Frame neu rechnen.
    const lift = () => {
      const t = topNode()
      const b = belowNode()
      const d = belowDim()
      if (t) { t.style.willChange = 'transform'; t.style.transition = '' }
      if (b) {
        b.style.display = 'flex'
        b.style.transition = ''
        b.style.willChange = 'transform'
        b.style.transform = `translate3d(${-PARALLAX * (el.clientWidth || 0)}px,0,0)`
      }
      if (d) { d.style.display = 'block'; d.style.transition = ''; d.style.willChange = 'opacity'; d.style.opacity = '0.18' }
    }

    const drop = () => {
      const t = topNode()
      const b = belowNode()
      const d = belowDim()
      ;[t, b].forEach((n) => {
        if (!n) return
        n.style.transition = ''
        n.style.transform = ''
        n.style.boxShadow = ''
        n.style.willChange = ''
      })
      if (d) { d.style.transition = ''; d.style.opacity = '0'; d.style.display = 'none'; d.style.willChange = '' }
      if (b) b.style.display = 'none'
    }

    const finish = (commit) => {
      const t = topNode()
      const b = belowNode()
      const d = belowDim()
      const targetX = commit ? width : 0
      const p = commit ? 1 : 0

      // Dauer an die Reststrecke koppeln. Eine feste Dauer fuehlt sich zaeh an,
      // wenn nur noch ein Fingerbreit fehlt, und gehetzt, wenn der ganze Screen
      // zurueckfedern muss.
      const remaining = Math.abs(targetX - dx)
      const duration = Math.round(
        Math.max(140, Math.min(DURATION_MS, (remaining / (width || 1)) * DURATION_MS * 1.7))
      )

      ;[t, b].forEach((n) => { if (n) n.style.transition = `transform ${duration}ms ${EASE}` })
      if (d) d.style.transition = `opacity ${duration}ms ${EASE}`

      // Erzwingt, dass der Startwert steht, bevor die Transition greift.
      if (t) void t.offsetWidth

      if (t) t.style.transform = `translate3d(${targetX}px,0,0)`
      if (b) b.style.transform = `translate3d(${-PARALLAX * width * (1 - p)}px,0,0)`
      if (d) d.style.opacity = String(0.18 * (1 - p))

      window.setTimeout(() => {
        // Beim Durchziehen raeumt der useLayoutEffect nach dem POP auf,
        // beim Zurueckfedern muessen wir es selbst tun.
        if (commit) navigate(-1)
        else drop()
        dragging = false
      }, duration)
    }

    const onStart = (e) => {
      tracking = false
      dragging = false
      if (isSwipeBackDisabled()) return
      if (stackRef.current.length < 2) return
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      if (t.clientX > EDGE_PX) return
      startX = t.clientX
      startY = t.clientY
      startT = performance.now()
      dx = 0
      width = el.clientWidth
      tracking = true
      // Schon jetzt vorbereiten, nicht erst bei der ersten Bewegung: den
      // darunterliegenden Screen von display:none sichtbar zu schalten kostet
      // ein volles Layout — mitten in der Geste waere das der erste Ruckler.
      lift()
    }

    const onMove = (e) => {
      if (!tracking) return
      const t = e.touches[0]
      const ddx = t.clientX - startX
      const ddy = t.clientY - startY

      if (!dragging) {
        if (Math.abs(ddx) < SLOP_PX && Math.abs(ddy) < SLOP_PX) return
        // Ueberwiegend senkrecht → das ist ein Scroll, Finger weg davon.
        if (Math.abs(ddy) > Math.abs(ddx) || ddx <= 0) { tracking = false; drop(); return }
        dragging = true
        const topEl = topNode()
        if (topEl) topEl.style.boxShadow = '-10px 0 30px rgba(0,0,0,0.30)'
      }

      dx = Math.max(0, ddx)
      // Verhindert, dass die Webview nebenher scrollt oder zurueckswipet.
      e.preventDefault()
      schedulePaint(dx)
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
      // Nur den Rand beruehrt, nie gezogen → Vorbereitung zuruecknehmen.
      if (!dragging) { drop(); return }
      const dt = Math.max(1, performance.now() - startT)
      const velocity = dx / dt
      finish(dx / width > COMMIT_RATIO || velocity > COMMIT_VELOCITY)
    }

    // passive:false, weil onMove scrollen unterbinden muss.
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [navigate])

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, height: '100%', position: 'relative' }}
    >
      {stack.map((entry, i) => {
        const isTop = i === stack.length - 1
        return (
          <div
            key={entry.id}
            ref={(node) => setLayerRef(entry.id, node)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: i,
              display: isTop ? 'flex' : 'none',
              flexDirection: 'column',
              // Nur der oberste Screen nimmt Eingaben an.
              pointerEvents: isTop ? 'auto' : 'none',
            }}
          >
            {/* Die Einblendung gehoert an den Layer, nicht an "ist gerade oben":
                haengt man sie an isTop, kommt die Klasse beim Zurueckwischen neu
                dazu und CSS spielt die Animation erneut ab — der Screen, auf dem
                man landet, blendet sich dann sichtbar noch einmal ein. So laeuft
                sie genau einmal, beim Aufbau des Layers. */}
            <div
              className="animate-fade-in"
              style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              {cloneElement(children, { location: entry.location })}
            </div>
            {/* Dunkelt den zurueckliegenden Screen ab, wie in iOS. */}
            <div
              ref={(node) => setDimRef(entry.id, node)}
              style={{
                position: 'absolute',
                inset: 0,
                background: '#000',
                opacity: 0,
                display: 'none',
                pointerEvents: 'none',
                zIndex: 9999,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

export default NavStack
