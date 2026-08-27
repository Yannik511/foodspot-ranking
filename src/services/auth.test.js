import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase-Client mocken, damit die Service-Funktionen ohne echten Backend-Call
// testbar sind.
vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { resetPasswordForEmail: vi.fn() },
  },
}))

import { supabase } from './supabase'
import { getEmailForUsername, resetPassword, RESET_REDIRECT_URL } from './auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEmailForUsername', () => {
  it('ruft die RPC mit dem Zugangsnamen als p_username auf', async () => {
    supabase.rpc.mockResolvedValue({ data: 'yannik@mail.de', error: null })
    await getEmailForUsername('yannik')
    expect(supabase.rpc).toHaveBeenCalledWith('get_email_for_username', {
      p_username: 'yannik',
    })
  })

  it('gibt die aufgelöste E-Mail zurück', async () => {
    supabase.rpc.mockResolvedValue({ data: 'yannik@mail.de', error: null })
    await expect(getEmailForUsername('yannik')).resolves.toBe('yannik@mail.de')
  })

  it('gibt null zurück, wenn kein Profil gefunden wird (data null)', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })
    await expect(getEmailForUsername('gibtsnicht')).resolves.toBeNull()
  })

  it('gibt null zurück, wenn die RPC einen Fehler liefert', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(getEmailForUsername('yannik')).resolves.toBeNull()
  })
})

describe('resetPassword', () => {
  it('schickt die Reset-Mail mit der korrekten redirectTo-URL', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    await resetPassword('yannik@mail.de')
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'yannik@mail.de',
      { redirectTo: RESET_REDIRECT_URL },
    )
  })

  it('redirectTo zeigt auf die gehostete Reset-Seite', () => {
    expect(RESET_REDIRECT_URL).toBe('https://yannik511.github.io/reset')
  })
})
