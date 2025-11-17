import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook zur dynamischen Messung der Header-Höhe
 * 
 * Misst die tatsächliche Höhe eines fixen Headers und berücksichtigt:
 * - Safe Area (Notch/Dynamic Island)
 * - Mehrzeilige Header (z.B. bei langen Listen-Namen)
 * - Automatische Updates bei Größenänderungen
 * 
 * @returns {Object} { headerRef, headerHeight }
 *   - headerRef: Ref für das Header-Element
 *   - headerHeight: Gemessene Höhe in Pixeln (inkl. Safe Area)
 */
export function useHeaderHeight() {
  const headerRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  const measureHeader = useCallback(() => {
    if (!headerRef.current) return

    const header = headerRef.current
    // Verwende getBoundingClientRect() für präzisere Messung
    // Dies berücksichtigt auch Padding, Border und alle Layout-Eigenschaften
    const rect = header.getBoundingClientRect()
    const height = rect.height

    // Setze auch bei height === 0, um sicherzustellen, dass der State aktualisiert wird
    // (wichtig für initiales Rendering)
    if (height >= 0) {
      setHeaderHeight(height)
    }
  }, [])

  useEffect(() => {
    if (!headerRef.current) return

    // Mehrfache Messungen für verschiedene Render-Phasen
    // 1. Sofortige Messung (falls Header bereits gerendert)
    measureHeader()

    // 2. Nach Layout-Phase (wichtig für initiales Rendering)
    let rafId1 = requestAnimationFrame(() => {
      const rafId2 = requestAnimationFrame(() => {
        measureHeader()
      })
      // Speichere die zweite RAF-ID für Cleanup (falls nötig)
      // In diesem Fall können wir sie nicht mehr abbrechen, da sie bereits läuft
    })

    // 3. Nach kurzer Verzögerung (für dynamische Inhalte wie Listen-Namen)
    const delayedTimeout = setTimeout(() => {
      measureHeader()
    }, 100)

    // ResizeObserver für automatische Updates bei Größenänderungen
    // (z.B. wenn Text umbricht, Schriftgröße ändert, etc.)
    const resizeObserver = new ResizeObserver((entries) => {
      // Messung nach Layout-Update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          measureHeader()
        })
      })
    })

    resizeObserver.observe(headerRef.current)

    // Fallback: Auch auf Window-Resize reagieren
    const handleResize = () => {
      requestAnimationFrame(() => {
        measureHeader()
      })
    }
    window.addEventListener('resize', handleResize)

    // MutationObserver für Änderungen am DOM-Inhalt (z.B. wenn Text nachgeladen wird)
    const mutationObserver = new MutationObserver(() => {
      // Doppeltes requestAnimationFrame für sicherere Messung nach DOM-Änderungen
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          measureHeader()
        })
      })
    })

    mutationObserver.observe(headerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style'] // Beobachte auch Style-Änderungen
    })

    return () => {
      if (rafId1) cancelAnimationFrame(rafId1)
      clearTimeout(delayedTimeout)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [measureHeader])

  return { headerRef, headerHeight }
}

/**
 * Hilfsfunktion: Berechnet paddingTop für Content unter fixem Header
 * 
 * @param {number} headerHeight - Gemessene Header-Höhe (von useHeaderHeight)
 * @param {number} spacing - Abstand zwischen Header und Content (Standard: 24px)
 * @returns {string} CSS calc() String für paddingTop
 */
export function getContentPaddingTop(headerHeight, spacing = 24) {
  if (headerHeight === 0) {
    // Fallback während Header noch nicht gemessen wurde
    // Verwende einen großzügigen Fallback-Wert, um sicherzustellen, dass nichts abgeschnitten wird
    // Dieser Wert sollte für die meisten Header ausreichen (inkl. mehrzeilige Titel)
    return `calc(100px + env(safe-area-inset-top, 0px) + ${spacing}px)`
  }
  // Verwende die gemessene Höhe + zusätzlichen Abstand
  // Der spacing wird zusätzlich zur Header-Höhe hinzugefügt
  return `${headerHeight + spacing}px`
}

