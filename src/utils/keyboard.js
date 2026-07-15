export const scrollFieldIntoView = (element) => {
  if (!element || typeof element.scrollIntoView !== 'function') return

  // Kleine Verzögerung, damit iOS-Keyboards zuerst einblenden können
  setTimeout(() => {
    try {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    } catch (_error) {
      // Fallback ohne smooth falls nicht unterstützt
      element.scrollIntoView()
    }
  }, 120)
}

