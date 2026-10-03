import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false), getPlatform: vi.fn(() => 'web') },
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn(),
  },
}))

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'
import {
  NOTIFICATION_PREF_DEFAULTS,
  routeFromNotification,
  getPushPermission,
  registerForPush,
  addPushListeners,
  getNotificationPrefs,
  setNotificationPrefs,
} from './push'

beforeEach(() => {
  vi.clearAllMocks()
  Capacitor.isNativePlatform.mockReturnValue(false)
})

describe('routeFromNotification', () => {
  it('liefert den App-Pfad aus dem Payload', () => {
    expect(routeFromNotification({ data: { route: '/shared/tierlist/abc' } })).toBe('/shared/tierlist/abc')
  })

  it('lehnt fremde URLs und fehlende Routen ab', () => {
    expect(routeFromNotification({ data: { route: 'https://evil.example' } })).toBeNull()
    expect(routeFromNotification({ data: { route: '//evil.example' } })).toBeNull()
    expect(routeFromNotification({ data: {} })).toBeNull()
    expect(routeFromNotification(null)).toBeNull()
  })
})

describe('im Web (nicht nativ)', () => {
  it('fasst das Plugin nicht an', async () => {
    expect(await getPushPermission()).toBe('unsupported')
    expect(await registerForPush()).toBe('unsupported')
    addPushListeners({ onOpen: vi.fn() })()
    expect(PushNotifications.checkPermissions).not.toHaveBeenCalled()
    expect(PushNotifications.addListener).not.toHaveBeenCalled()
  })
})

describe('registerForPush (nativ)', () => {
  beforeEach(() => Capacitor.isNativePlatform.mockReturnValue(true))

  it('fragt bei offener Erlaubnis nach und registriert nach Zustimmung', async () => {
    PushNotifications.checkPermissions.mockResolvedValue({ receive: 'prompt' })
    PushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' })
    expect(await registerForPush()).toBe('granted')
    expect(PushNotifications.register).toHaveBeenCalledTimes(1)
  })

  it('registriert nicht, wenn abgelehnt wurde', async () => {
    PushNotifications.checkPermissions.mockResolvedValue({ receive: 'denied' })
    expect(await registerForPush()).toBe('denied')
    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled()
    expect(PushNotifications.register).not.toHaveBeenCalled()
  })
})

describe('addPushListeners (nativ)', () => {
  beforeEach(() => Capacitor.isNativePlatform.mockReturnValue(true))

  const listeners = () =>
    Object.fromEntries(PushNotifications.addListener.mock.calls.map(([name, fn]) => [name, fn]))

  it('speichert das Geraete-Token ueber register_push_token', async () => {
    Capacitor.getPlatform.mockReturnValue('ios')
    supabase.rpc.mockResolvedValue({ error: null })
    PushNotifications.addListener.mockResolvedValue({ remove: vi.fn() })
    addPushListeners()
    await listeners().registration({ value: 'abc123' })
    expect(supabase.rpc).toHaveBeenCalledWith('register_push_token', { p_token: 'abc123', p_platform: 'ios' })
  })

  it('gibt beim Tap die Route an onOpen weiter', () => {
    const onOpen = vi.fn()
    PushNotifications.addListener.mockResolvedValue({ remove: vi.fn() })
    addPushListeners({ onOpen })
    listeners().pushNotificationActionPerformed({ notification: { data: { route: '/social' } } })
    listeners().pushNotificationActionPerformed({ notification: { data: { route: 'https://evil.example' } } })
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('/social')
  })
})

describe('Benachrichtigungs-Einstellungen', () => {
  const selectChain = (result) => {
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn().mockResolvedValue(result) }
    return chain
  }

  it('ohne Zeile gelten die Defaults (alles an)', async () => {
    supabase.from.mockReturnValue(selectChain({ data: null, error: null }))
    expect(await getNotificationPrefs('u-1')).toEqual(NOTIFICATION_PREF_DEFAULTS)
  })

  it('liest gespeicherte Werte', async () => {
    supabase.from.mockReturnValue(selectChain({ data: { new_ratings: false, shared_lists: true, friend_requests: true }, error: null }))
    expect((await getNotificationPrefs('u-1')).new_ratings).toBe(false)
  })

  it('speichert per Upsert auf user_id', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ upsert })
    await setNotificationPrefs('u-1', { new_ratings: false, shared_lists: true, friend_requests: true })
    expect(supabase.from).toHaveBeenCalledWith('notification_prefs')
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: 'u-1', new_ratings: false })
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' })
  })
})
