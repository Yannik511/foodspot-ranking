import { describe, it, expect } from 'vitest'
import { clearUiCache } from './cache'

const fakeStorage = (entries) => {
  const map = new Map(Object.entries(entries))
  return {
    get length() { return map.size },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    keys: () => [...map.keys()].sort(),
  }
}

describe('clearUiCache', () => {
  it('behält Anmeldung und Einstellungen, löscht UI-Cache', () => {
    const local = fakeStorage({
      'sb-abc-auth-token': '{}',
      darkMode: 'true',
      foodspot_remember_me: 'true',
      foodspot_saved_email: 'a@b.de',
      push_device_token: 'tok',
      'rankify:profile-stats:v1:u1': '{}',
      createListDraft: '{}',
      rankify_last_location: '{}',
    })
    const session = fakeStorage({ newList: '1' })

    clearUiCache(local, session)

    expect(local.keys()).toEqual(
      ['darkMode', 'foodspot_remember_me', 'foodspot_saved_email', 'push_device_token', 'sb-abc-auth-token'],
    )
    expect(session.keys()).toEqual([])
  })
})
