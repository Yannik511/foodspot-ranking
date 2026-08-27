// Hilfsfunktionen für das Login-Feld, das E-Mail ODER Zugangsname akzeptiert.

// Schneidet Whitespace ab und verträgt null/undefined.
export function normalizeIdentifier(input) {
  return (input ?? '').trim()
}

// Behandelt die Eingabe als E-Mail, sobald ein "@" enthalten ist.
// Ohne "@" → Zugangsname, der serverseitig zur E-Mail aufgelöst wird.
export function isEmail(input) {
  return normalizeIdentifier(input).includes('@')
}
