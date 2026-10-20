import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }))

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

globalThis.FileReader = class {
  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,eA=='
    this.onload()
  }
}

const { assertImageAllowed, setImageConsentRequester, IMAGE_CONSENT_KEY } = await import('./moderation')

const file = new Blob(['x'], { type: 'image/jpeg' })

describe('Einwilligung zur KI-Bildprüfung', () => {
  beforeEach(() => {
    store.clear()
    invoke.mockReset()
    invoke.mockResolvedValue({ data: { flagged: false }, error: null })
  })

  it('fragt beim ersten Upload und merkt sich die Zustimmung', async () => {
    const ask = vi.fn().mockResolvedValue(true)
    setImageConsentRequester(ask)

    await assertImageAllowed(file)
    await assertImageAllowed(file)

    expect(ask).toHaveBeenCalledTimes(1)
    expect(store.get(IMAGE_CONSENT_KEY)).toBe('1')
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('sendet nichts an die Moderation, wenn abgelehnt wird', async () => {
    setImageConsentRequester(vi.fn().mockResolvedValue(false))

    await expect(assertImageAllowed(file)).rejects.toMatchObject({ name: 'ImageRejectedError' })
    expect(invoke).not.toHaveBeenCalled()
    expect(store.has(IMAGE_CONSENT_KEY)).toBe(false)
  })
})
