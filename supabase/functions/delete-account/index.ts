import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Buckets die Dateien unter dem Prefix `${user.id}/` ablegen
const USER_BUCKETS = ['profile-avatars', 'list-covers', 'foodspots']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    // User aus dem JWT ermitteln — NIE aus dem Request-Body vertrauen
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Ungültige Sitzung' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // 1. Storage-Dateien des Users löschen (kaskadiert NICHT über die DB)
    for (const bucket of USER_BUCKETS) {
      const { data: files, error: listError } = await admin.storage
        .from(bucket)
        .list(userId, { limit: 1000 })
      if (listError || !files?.length) continue
      const paths = files.map((f) => `${userId}/${f.name}`)
      await admin.storage.from(bucket).remove(paths)
    }

    // 2. Auth-User löschen → alle DB-Tabellen kaskadieren via ON DELETE CASCADE
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
