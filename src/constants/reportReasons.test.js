import { describe, it, expect } from 'vitest'
import { REPORT_REASONS, REPORT_REASON_KEYS, isValidReportReason } from './reportReasons'

describe('reportReasons', () => {
  it('enthält Gründe mit key und label', () => {
    expect(REPORT_REASONS.length).toBeGreaterThanOrEqual(4)
    for (const r of REPORT_REASONS) {
      expect(typeof r.key).toBe('string')
      expect(r.key.length).toBeGreaterThan(0)
      expect(typeof r.label).toBe('string')
      expect(r.label.length).toBeGreaterThan(0)
    }
  })

  it('hat eindeutige keys', () => {
    expect(new Set(REPORT_REASON_KEYS).size).toBe(REPORT_REASON_KEYS.length)
  })

  it('isValidReportReason erkennt gültige und ungültige keys', () => {
    expect(isValidReportReason('spam')).toBe(true)
    expect(isValidReportReason('harassment')).toBe(true)
    expect(isValidReportReason('gibtsnicht')).toBe(false)
    expect(isValidReportReason('')).toBe(false)
    expect(isValidReportReason(undefined)).toBe(false)
  })
})
