import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

import { supabase } from './supabase'
import { reportContent, blockUser, unblockUser, getBlockedUsers } from './ugc'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportContent', () => {
  it('ruft report_content mit allen Feldern (target_id als String) auf', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })
    await reportContent('spot', 123, 'spam', 'unangebracht')
    expect(supabase.rpc).toHaveBeenCalledWith('report_content', {
      p_target_type: 'spot',
      p_target_id: '123',
      p_reason: 'spam',
      p_note: 'unangebracht',
    })
  })

  it('note ist optional (null)', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })
    await reportContent('user', 'u-1', 'harassment')
    expect(supabase.rpc).toHaveBeenCalledWith('report_content', {
      p_target_type: 'user',
      p_target_id: 'u-1',
      p_reason: 'harassment',
      p_note: null,
    })
  })
})

describe('blockUser / unblockUser', () => {
  it('blockUser ruft block_user mit der Ziel-ID', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })
    await blockUser('u-2')
    expect(supabase.rpc).toHaveBeenCalledWith('block_user', { p_blocked: 'u-2' })
  })

  it('unblockUser ruft unblock_user mit der Ziel-ID', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null })
    await unblockUser('u-2')
    expect(supabase.rpc).toHaveBeenCalledWith('unblock_user', { p_blocked: 'u-2' })
  })
})

describe('getBlockedUsers', () => {
  it('verbindet Block-Zeilen mit Profildaten', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'blocked_users') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [{ blocked_id: 'u-2', created_at: '2026-08-03' }],
                error: null,
              }),
          }),
        }
      }
      // user_profiles
      return {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [{ id: 'u-2', username: 'Bob', profile_image_url: 'pic.png' }],
            }),
        }),
      }
    })

    const result = await getBlockedUsers()
    expect(result).toEqual([
      { id: 'u-2', created_at: '2026-08-03', username: 'Bob', profile_image_url: 'pic.png' },
    ])
  })

  it('gibt leeres Array zurück, wenn niemand blockiert ist', async () => {
    supabase.from.mockImplementation(() => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }))
    await expect(getBlockedUsers()).resolves.toEqual([])
  })

  it('gibt bei Fehler leeres Array zurück', async () => {
    supabase.from.mockImplementation(() => ({
      select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'x' } }) }),
    }))
    await expect(getBlockedUsers()).resolves.toEqual([])
  })

  it('fällt auf "Unbekannt" zurück, wenn kein Profil gefunden wird', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'blocked_users') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({ data: [{ blocked_id: 'u-9', created_at: 't' }], error: null }),
          }),
        }
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) }
    })
    const result = await getBlockedUsers()
    expect(result[0]).toMatchObject({ id: 'u-9', username: 'Unbekannt', profile_image_url: null })
  })
})
