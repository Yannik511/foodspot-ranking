import { describe, it, expect } from 'vitest'
import { isEmail, normalizeIdentifier } from './authIdentifier'

describe('normalizeIdentifier', () => {
  it('trimmt führenden/abschließenden Whitespace', () => {
    expect(normalizeIdentifier('  yannik  ')).toBe('yannik')
    expect(normalizeIdentifier('\t a@b.de \n')).toBe('a@b.de')
  })

  it('verträgt null/undefined ohne Fehler', () => {
    expect(normalizeIdentifier(null)).toBe('')
    expect(normalizeIdentifier(undefined)).toBe('')
  })
})

describe('isEmail', () => {
  it('erkennt E-Mail-Eingaben (enthält @)', () => {
    expect(isEmail('yannik@mail.de')).toBe(true)
    expect(isEmail('a@b.co')).toBe(true)
  })

  it('behandelt Eingaben ohne @ als Zugangsname', () => {
    expect(isEmail('yannik')).toBe(false)
    expect(isEmail('yannik511')).toBe(false)
  })

  it('berücksichtigt getrimmten Whitespace', () => {
    expect(isEmail('   yannik@mail.de   ')).toBe(true)
    expect(isEmail('   yannik   ')).toBe(false)
  })

  it('leere Eingabe ist keine E-Mail', () => {
    expect(isEmail('')).toBe(false)
    expect(isEmail(null)).toBe(false)
    expect(isEmail(undefined)).toBe(false)
  })

  it('nacktes @ gilt als E-Mail-förmig (signIn scheitert dann generisch)', () => {
    expect(isEmail('@')).toBe(true)
  })
})
