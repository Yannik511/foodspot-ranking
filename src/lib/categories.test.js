import { describe, it, expect } from 'vitest'
import {
  CATEGORIES,
  DEFAULT_SCALE,
  getCategoryScale,
  calculateOverallRating,
  calculateTier,
} from './categories'

describe('CATEGORIES – Struktur-Invarianten', () => {
  it('jede Kategorie hat genau 5 Kriterien, imageUrl und scale', () => {
    for (const [name, def] of Object.entries(CATEGORIES)) {
      expect(Array.isArray(def.criteria), `${name}.criteria`).toBe(true)
      expect(def.criteria, `${name} braucht 5 Kriterien`).toHaveLength(5)
      expect(typeof def.imageUrl, `${name}.imageUrl`).toBe('string')
      expect(typeof def.scale, `${name}.scale`).toBe('number')
    }
  })

  it('die neuen Kategorien existieren', () => {
    for (const name of ['Eis', 'Wein', 'Kaffeebohnen', 'Tee']) {
      expect(CATEGORIES[name], `${name} fehlt`).toBeDefined()
    }
  })
})

describe('getCategoryScale', () => {
  it('liefert die Skala einer bekannten Kategorie', () => {
    expect(getCategoryScale('Döner')).toBe(5)
    expect(getCategoryScale('Eis')).toBe(5)
  })

  it('fällt bei unbekannter/leerer Kategorie auf DEFAULT_SCALE zurück', () => {
    expect(getCategoryScale('Gibtsnicht')).toBe(DEFAULT_SCALE)
    expect(getCategoryScale(undefined)).toBe(DEFAULT_SCALE)
  })
})

describe('calculateOverallRating', () => {
  it('gibt 0 ohne Kategorie zurück', () => {
    expect(calculateOverallRating({ a: 5 }, null)).toBe(0)
  })

  it('gibt 0 zurück, wenn keine Bewertung gesetzt ist', () => {
    expect(calculateOverallRating({}, 'Döner')).toBe(0)
    expect(calculateOverallRating({ a: 0, b: 0 }, 'Döner')).toBe(0)
  })

  it('bester Fall (alle 5/5) ergibt 10.0', () => {
    expect(calculateOverallRating({ a: 5, b: 5, c: 5 }, 'Döner')).toBe(10)
  })

  it('ignoriert unbewertete (0) Kriterien im Durchschnitt', () => {
    // gefüllt = [5] → avg 5 → 10.0
    expect(calculateOverallRating({ a: 5, b: 0 }, 'Döner')).toBe(10)
  })

  it('rechnet Teilbewertungen korrekt (avg 3.5 → 7.0)', () => {
    expect(calculateOverallRating({ a: 3, b: 4 }, 'Döner')).toBe(7)
  })
})

describe('calculateTier', () => {
  it('mappt Score auf S/A/B/C/D an den Grenzen', () => {
    expect(calculateTier(10)).toBe('S')
    expect(calculateTier(9.0)).toBe('S')
    expect(calculateTier(8.9)).toBe('A')
    expect(calculateTier(8.0)).toBe('A')
    expect(calculateTier(7.9)).toBe('B')
    expect(calculateTier(6.5)).toBe('B')
    expect(calculateTier(6.4)).toBe('C')
    expect(calculateTier(5.0)).toBe('C')
    expect(calculateTier(4.9)).toBe('D')
    expect(calculateTier(0)).toBe('D')
  })
})
