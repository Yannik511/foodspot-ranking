// "Cache leeren" in den Einstellungen: entfernt nur zwischengespeicherte UI-Daten.
// Anmeldung (Supabase-Session sb-*), Darstellung und Login-Komfort bleiben erhalten —
// ein pauschales localStorage.clear() hätte den Nutzer beim nächsten Start ausgeloggt.

const KEEP_KEYS = new Set([
  'darkMode',
  'foodspot_remember_me',
  'foodspot_saved_email',
  'push_device_token',
  'rankify_ai_image_consent',
])

export const shouldKeepKey = (key) => key.startsWith('sb-') || KEEP_KEYS.has(key)

export function clearUiCache(local = localStorage, session = sessionStorage) {
  const localKeys = Array.from({ length: local.length }, (_, i) => local.key(i))
  for (const key of localKeys) {
    if (key && !shouldKeepKey(key)) local.removeItem(key)
  }
  session.clear()
}
