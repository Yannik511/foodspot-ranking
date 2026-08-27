import { describe, it, expect } from 'vitest'
import { dedupeByCanonicalKey } from './mySpots'

describe('dedupeByCanonicalKey', () => {
  it('führt Spots mit gleichem canonical_key zu einer Nadel zusammen', () => {
    const spots = [
      { id: 1, canonical_key: 'geo|48.1|11.5', rating: null, cover_photo_url: null },
      { id: 2, canonical_key: 'geo|48.1|11.5', rating: 4.5, cover_photo_url: null },
    ]
    const result = dedupeByCanonicalKey(spots)
    expect(result).toHaveLength(1)
    // bevorzugt den mit Bewertung
    expect(result[0].id).toBe(2)
  })

  it('bevorzugt den Repräsentanten mit Bild', () => {
    const spots = [
      { id: 1, canonical_key: 'geo|1|1', rating: 3, cover_photo_url: null },
      { id: 2, canonical_key: 'geo|1|1', rating: 3, cover_photo_url: 'x.png' },
    ]
    expect(dedupeByCanonicalKey(spots)[0].id).toBe(2)
  })

  it('behält unterschiedliche Orte getrennt', () => {
    const spots = [
      { id: 1, canonical_key: 'geo|1|1' },
      { id: 2, canonical_key: 'geo|2|2' },
    ]
    expect(dedupeByCanonicalKey(spots)).toHaveLength(2)
  })

  it('nutzt id als Fallback-Key ohne canonical_key', () => {
    const spots = [
      { id: 1, canonical_key: null },
      { id: 2, canonical_key: null },
    ]
    expect(dedupeByCanonicalKey(spots)).toHaveLength(2)
  })
})
