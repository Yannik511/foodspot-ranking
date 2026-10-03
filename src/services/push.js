import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

// Push-Benachrichtigungen (APNs). Backend siehe
// migrations/069_push_notifications.sql + supabase/functions/send-push.
// Alle Funktionen sind auf Web/Nicht-Native sicher (no-op), damit der
// Web-Build und die Dev-Umgebung nicht brechen.

const TOKEN_KEY = 'push_device_token'

export const NOTIFICATION_PREF_DEFAULTS = {
  new_ratings: true,
  shared_lists: true,
  friend_requests: true,
  reminders: true,
}

const isNative = () => Capacitor.isNativePlatform()

// Nur App-interne Pfade zulassen, nie eine fremde URL aus dem Payload oeffnen.
export function routeFromNotification(notification) {
  const route = notification?.data?.route
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) return null
  return route
}

// 'granted' | 'denied' | 'prompt' | 'unsupported'
export async function getPushPermission() {
  if (!isNative()) return 'unsupported'
  try {
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'prompt-with-rationale' ? 'prompt' : receive
  } catch {
    return 'unsupported'
  }
}

// Fragt (falls noch offen) die Erlaubnis ab und holt das Geraete-Token.
// Das Token selbst kommt asynchron ueber den 'registration'-Listener.
export async function registerForPush() {
  if (!isNative()) return 'unsupported'
  try {
    let { receive } = await PushNotifications.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      ;({ receive } = await PushNotifications.requestPermissions())
    }
    if (receive !== 'granted') return receive
    await PushNotifications.register()
    return 'granted'
  } catch (error) {
    console.warn('[push] register failed', error)
    return 'unsupported'
  }
}

// Haengt die Listener an: Token speichern, Tap auf eine Benachrichtigung
// an onOpen(route) weitergeben. Gibt eine Aufraeum-Funktion zurueck.
export function addPushListeners({ onOpen } = {}) {
  if (!isNative()) return () => {}

  const handles = [
    PushNotifications.addListener('registration', async ({ value }) => {
      if (!value) return
      try { localStorage.setItem(TOKEN_KEY, value) } catch { /* ignore */ }
      const { error } = await supabase.rpc('register_push_token', {
        p_token: value,
        p_platform: Capacitor.getPlatform(),
      })
      if (error) console.warn('[push] token not saved', error)
    }),
    PushNotifications.addListener('registrationError', (error) => {
      console.warn('[push] registration error', error)
    }),
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const route = routeFromNotification(notification)
      if (route) onOpen?.(route)
    }),
  ]

  return () => {
    handles.forEach((handle) => {
      Promise.resolve(handle).then((h) => h?.remove?.()).catch(() => {})
    })
  }
}

// Vor dem Abmelden aufrufen (braucht noch die Session), damit das Geraet
// keine Benachrichtigungen fuer den abgemeldeten Account mehr bekommt.
export async function unregisterPush() {
  let token = null
  try { token = localStorage.getItem(TOKEN_KEY) } catch { /* ignore */ }
  if (!token) return
  try {
    await supabase.rpc('unregister_push_token', { p_token: token })
    localStorage.removeItem(TOKEN_KEY)
  } catch (error) {
    console.warn('[push] unregister failed', error)
  }
}

// Die Schalter aus den Einstellungen. Ohne Zeile gelten die Defaults (an).
export async function getNotificationPrefs(userId) {
  if (!userId) return { ...NOTIFICATION_PREF_DEFAULTS }
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('new_ratings, shared_lists, friend_requests, reminders')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return { ...NOTIFICATION_PREF_DEFAULTS }
  return { ...NOTIFICATION_PREF_DEFAULTS, ...data }
}

export async function setNotificationPrefs(userId, prefs) {
  return supabase
    .from('notification_prefs')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}
