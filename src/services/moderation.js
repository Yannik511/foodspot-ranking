import { supabase } from './supabase'

// Client-Anbindung an die `moderate-image` Edge Function.
// assertImageAllowed() wirft, wenn das Bild abgelehnt wird — sonst läuft der
// Upload normal weiter. Fail-open: ist die Moderation nicht erreichbar oder
// (noch) kein OpenAI-Key hinterlegt, wird NICHT blockiert.

export class ImageRejectedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImageRejectedError'
    this.code = 'IMAGE_REJECTED'
  }
}

// Apple 5.1.2(i): Bevor Bilder an eine fremde KI (OpenAI) gehen, braucht es eine
// ausdrückliche Einwilligung. Einmal pro Gerät; das Sheet (ImageConsentSheet)
// registriert sich hier und liefert true/false.
export const IMAGE_CONSENT_KEY = 'rankify_ai_image_consent'
let consentRequester = null

export const setImageConsentRequester = (fn) => {
  consentRequester = fn
}

export const hasImageConsent = () => {
  try {
    return localStorage.getItem(IMAGE_CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export const ensureImageConsent = async () => {
  if (hasImageConsent()) return
  const granted = consentRequester ? await consentRequester() : false
  if (!granted) {
    throw new ImageRejectedError(
      'Ohne deine Zustimmung zur Bildprüfung können wir keine Fotos hochladen.'
    )
  }
  try {
    localStorage.setItem(IMAGE_CONSENT_KEY, '1')
  } catch {
    // Speichern nicht möglich → beim nächsten Upload wird erneut gefragt
  }
}

// Für die Foto-Auswahl: fragt (falls nötig) direkt nach dem Auswählen, damit
// nicht erst mitten im Speichern das Einwilligungs-Sheet erscheint.
export const requestImageConsent = async () => {
  try {
    await ensureImageConsent()
    return true
  } catch {
    return false
  }
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

/**
 * Prüft eine (idealerweise bereits komprimierte) Bilddatei auf unangemessene
 * Inhalte. Wirft ImageRejectedError, wenn das Bild abgelehnt wird.
 * @param {File|Blob} file
 */
export const assertImageAllowed = async (file) => {
  await ensureImageConsent()

  let imageBase64
  try {
    imageBase64 = await fileToDataUrl(file)
  } catch {
    return // Datei nicht lesbar -> nicht blockieren
  }

  let data, error
  try {
    ;({ data, error } = await supabase.functions.invoke('moderate-image', {
      body: { imageBase64 },
    }))
  } catch {
    return // Netz-/Aufruffehler -> fail-open
  }

  if (error) return // Edge-Function-Fehler -> fail-open

  if (data?.flagged) {
    throw new ImageRejectedError(
      'Dieses Bild verstößt gegen unsere Richtlinien und kann nicht hochgeladen werden.'
    )
  }
}
