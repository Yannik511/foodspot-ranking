import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web' } }))

const { isValidFeedback, FEEDBACK_MAX_LENGTH } = await import('./feedback')

describe('isValidFeedback', () => {
  it('akzeptiert gültige Kategorie + Text', () => {
    expect(isValidFeedback('idea', 'Mehr Kategorien bitte')).toBe(true)
  })

  it('lehnt leeren oder nur Leerzeichen-Text ab', () => {
    expect(isValidFeedback('bug', '')).toBe(false)
    expect(isValidFeedback('bug', '   ')).toBe(false)
  })

  it('lehnt unbekannte Kategorie ab', () => {
    expect(isValidFeedback('spam', 'Hallo')).toBe(false)
  })

  it('lehnt zu lange Texte ab', () => {
    expect(isValidFeedback('other', 'a'.repeat(FEEDBACK_MAX_LENGTH + 1))).toBe(false)
  })
})
