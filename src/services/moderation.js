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
