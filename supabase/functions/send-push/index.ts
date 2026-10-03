// Push-Versand an Apple (APNs, Token-Auth mit .p8-Key).
// Wird NICHT von der App aufgerufen, sondern von den Datenbank-Triggern aus
// migrations/069_push_notifications.sql (per pg_net). Die Trigger haben
// Empfaenger, Einstellungen und Blockierungen bereits gefiltert und liefern
// fertige Geraete-Tokens plus Text.
//
// Fail-open: Fehlen die APNs-Secrets, antwortet die Funktion mit skipped=true
// und verschickt nichts.
//
// Secrets setzen:
//   supabase secrets set APNS_KEY_P8="$(cat AuthKey_XXXXXXXXXX.p8)"
//   supabase secrets set APNS_KEY_ID=XXXXXXXXXX
//   supabase secrets set APNS_TEAM_ID=XGDSZCLSL9
//   supabase secrets set APNS_BUNDLE_ID=com.rankify.app
//   supabase secrets set PUSH_WEBHOOK_SECRET=<derselbe String wie im Vault>
// Deployen (ohne JWT-Pruefung, abgesichert ueber PUSH_WEBHOOK_SECRET):
//   supabase functions deploy send-push --no-verify-jwt

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const b64url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Apple akzeptiert ein Provider-Token bis zu 60 Minuten und drosselt, wenn es
// oefter als alle 20 Minuten erneuert wird. Darum pro Instanz cachen.
let cachedJwt: { token: string; issuedAt: number } | null = null

async function apnsJwt(p8: string, keyId: string, teamId: string) {
  const now = Math.floor(Date.now() / 1000)
  if (cachedJwt && now - cachedJwt.issuedAt < 40 * 60) return cachedJwt.token

  const pem = p8.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const unsigned = `${b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))}.${b64url(
    JSON.stringify({ iss: teamId, iat: now }),
  )}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  )

  const token = `${unsigned}.${b64url(signature)}`
  cachedJwt = { token, issuedAt: now }
  return token
}

const HOSTS = ['https://api.push.apple.com', 'https://api.sandbox.push.apple.com']

// Ein Token ist entweder ein Produktiv- oder ein Sandbox-Token (Xcode-Build).
// Welches, weiss die App nicht. Darum erst produktiv, bei BadDeviceToken Sandbox.
async function sendOne(token: string, jwt: string, bundleId: string, payload: unknown) {
  let reason = ''
  for (const host of HOSTS) {
    const res = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (res.ok) return { ok: true, dead: false, reason: '' }

    reason = (await res.json().catch(() => ({})))?.reason ?? `http ${res.status}`
    if (res.status === 410 || reason === 'Unregistered') return { ok: false, dead: true, reason }
    if (reason !== 'BadDeviceToken') return { ok: false, dead: false, reason }
  }
  // In beiden Umgebungen unbekannt -> Token ist tot.
  return { ok: false, dead: true, reason }
}

async function deleteTokens(tokens: string[]) {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey || tokens.length === 0) return

  const list = tokens.map((t) => `"${t}"`).join(',')
  await fetch(`${url}/rest/v1/push_tokens?token=in.(${encodeURIComponent(list)})`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  }).catch(() => {})
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-push-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401)
  }

  const p8 = Deno.env.get('APNS_KEY_P8')
  const keyId = Deno.env.get('APNS_KEY_ID')
  const teamId = Deno.env.get('APNS_TEAM_ID')
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.rankify.app'
  // Kein APNs-Key -> nichts verschicken (fail-open).
  if (!p8 || !keyId || !teamId) return json({ sent: 0, skipped: true })

  try {
    const { tokens, title, body, route, kind } = await req.json()
    if (!Array.isArray(tokens) || tokens.length === 0 || !title) {
      return json({ sent: 0, error: 'no tokens or title' })
    }

    const jwt = await apnsJwt(p8, keyId, teamId)
    const payload = {
      aps: { alert: { title, body: body ?? '' }, sound: 'default' },
      route: route ?? null,
      kind: kind ?? null,
    }

    const results = await Promise.all(
      tokens.map((token: string) => sendOne(token, jwt, bundleId, payload)),
    )

    const dead = tokens.filter((_: string, i: number) => results[i].dead)
    await deleteTokens(dead)

    return json({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.reason),
      removed: dead.length,
    })
  } catch (e) {
    return json({ sent: 0, error: String(e) })
  }
})
