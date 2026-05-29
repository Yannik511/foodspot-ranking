import { useState, useEffect } from 'react'

export function useScrollHeader(scrollRef, threshold = 8) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > threshold)
    handler()
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [scrollRef, threshold])

  return scrolled
}
