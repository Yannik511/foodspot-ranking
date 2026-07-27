import { describe, it, expect } from 'vitest'
import { getCategoryTerms } from './categoryTerms'

describe('getCategoryTerms', () => {
  it('liefert Standard-Begriffe ohne Kategorie', () => {
    const t = getCategoryTerms(null)
    expect(t.plural).toBe('Foodspots')
    expect(t.singular).toBe('Foodspot')
  })

  it('liefert Produkt-Begriffe für bekannte Kategorien', () => {
    expect(getCategoryTerms('Bier').plural).toBe('Biere')
    expect(getCategoryTerms('Glühwein').plural).toBe('Glühweine')
  })

  it('liefert Begriffe für die neuen Kategorien', () => {
    expect(getCategoryTerms('Wein').plural).toBe('Weine')
    expect(getCategoryTerms('Tee').plural).toBe('Tees')
    expect(getCategoryTerms('Eis').singular).toBe('Eis')
    expect(getCategoryTerms('Kaffeebohnen').singular).toBe('Kaffeebohne')
  })

  it('trimmt Whitespace der Kategorie', () => {
    expect(getCategoryTerms('  Wein  ').plural).toBe('Weine')
  })

  it('fällt bei unbekannter Kategorie auf Standard zurück', () => {
    expect(getCategoryTerms('Gibtsnicht').plural).toBe('Foodspots')
  })
})
