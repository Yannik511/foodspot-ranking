import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'

// Wrapper um das native Biometric-Plugin (Face ID / Touch ID).
// Alle Funktionen sind auf Web/Nicht-Native sicher (no-op), damit der
// Web-Build und die Dev-Umgebung nicht brechen.
//
// Ablauf: Nach erfolgreichem Passwort-Login werden die Zugangsdaten (E-Mail +
// Passwort) im iOS-Keychain abgelegt. Beim nächsten Start / auf dem Login-Screen
// entsperrt Face ID (verifyIdentity) den Zugriff und meldet automatisch an.

const SERVER = 'com.rankify.app'

const isNative = () => Capacitor.isNativePlatform()

// Ist Face ID / Touch ID auf dem Gerät verfügbar und eingerichtet?
export async function isBiometricAvailable() {
  if (!isNative()) return false
  try {
    const { isAvailable } = await NativeBiometric.isAvailable()
    return !!isAvailable
  } catch {
    return false
  }
}

// Zugangsdaten sicher im Keychain ablegen (= Face-ID-Login aktivieren).
export async function enableBiometricLogin(email, password) {
  if (!isNative() || !email || !password) return false
  try {
    await NativeBiometric.setCredentials({ username: email, password, server: SERVER })
    return true
  } catch {
    return false
  }
}

// Sind gespeicherte Zugangsdaten vorhanden (= Face-ID-Login aktiv)?
export async function hasBiometricLogin() {
  if (!isNative()) return false
  try {
    const c = await NativeBiometric.getCredentials({ server: SERVER })
    return !!(c && c.username && c.password)
  } catch {
    return false
  }
}

// Face-ID-Prompt zeigen und bei Erfolg die gespeicherten Zugangsdaten liefern.
// Gibt { username, password } zurück oder null bei Abbruch/Fehler.
export async function loginWithBiometrics() {
  if (!isNative()) return null
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Anmeldung bei Rankify',
      title: 'Face ID',
      subtitle: '',
      description: '',
    })
    const c = await NativeBiometric.getCredentials({ server: SERVER })
    if (c && c.username && c.password) return { email: c.username, password: c.password }
    return null
  } catch {
    return null // Abbruch oder kein Match
  }
}

// Face-ID-Login deaktivieren (Zugangsdaten aus dem Keychain löschen).
export async function disableBiometricLogin() {
  if (!isNative()) return
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    /* nichts zu löschen */
  }
}
