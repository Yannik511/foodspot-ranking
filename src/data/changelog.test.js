import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { CHANGELOG, APP_VERSION } from './changelog'

describe('changelog', () => {
  it('hat Einträge mit Version, Datum und Punkten', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
    for (const entry of CHANGELOG) {
      expect(entry.version).toMatch(/^\d+\.\d+(\.\d+)?$/)
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.items.length).toBeGreaterThan(0)
    }
  })

  it('neueste Version steht oben', () => {
    const dates = CHANGELOG.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('passt zur MARKETING_VERSION im Xcode-Projekt', () => {
    const pbx = readFileSync(new URL('../../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8')
    const versions = new Set([...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]))
    expect([...versions]).toEqual([APP_VERSION])
  })
})
