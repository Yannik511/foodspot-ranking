import { supabase } from './supabase'

// Ziel-URL für den Passwort-Reset-Link (gehostete Reset-Seite auf GitHub Pages,
// Repo Yannik511.github.io mit eigener Domain getrankify.app). Die Seite schließt
// den Reset im Browser ab. Muss in Supabase unter Auth → URL Configuration →
// Redirect URLs freigegeben sein.
export const RESET_REDIRECT_URL = 'https://getrankify.app/reset'

// Löst einen Zugangsnamen serverseitig zur E-Mail auf (RPC 067).
// Gibt null zurück, wenn kein Profil existiert oder die RPC fehlschlägt.
export async function getEmailForUsername(username) {
  const { data, error } = await supabase.rpc('get_email_for_username', {
    p_username: username,
  })
  if (error) return null
  return data || null
}

// Schickt eine Passwort-Reset-Mail an die angegebene E-Mail-Adresse.
export async function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: RESET_REDIRECT_URL,
  })
}
