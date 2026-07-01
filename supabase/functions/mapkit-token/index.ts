const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlStr(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const pem = Deno.env.get('MAPKIT_PRIVATE_KEY')
    const kid = Deno.env.get('MAPKIT_KEY_ID')
    const iss = Deno.env.get('MAPKIT_TEAM_ID')

    if (!pem || !kid || !iss) throw new Error(`Missing env vars: pem=${!!pem} kid=${!!kid} iss=${!!iss}`)

    const rawB64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')

    const keyBytes = Uint8Array.from(atob(rawB64), (c) => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'pkcs8',
      keyBytes.buffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )

    const now = Math.floor(Date.now() / 1000)
    const header = b64urlStr(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
    const payload = b64urlStr(JSON.stringify({ iss, iat: now, exp: now + 1800 }))
    const msg = `${header}.${payload}`

    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(msg)
    )

    const token = `${msg}.${b64url(sig)}`

    return new Response(
      JSON.stringify({ token, exp: now + 1800 }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
