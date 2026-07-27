// Bild-Moderation via OpenAI (omni-moderation-latest, kostenlos).
// Prueft ein hochzuladendes Bild auf unangemessene Inhalte, BEVOR es im
// Storage landet. Erfuellt Apple Guideline 1.2 (Filtern anstoessiger Inhalte).
//
// Fail-open: Ist kein OPENAI_API_KEY gesetzt oder die API nicht erreichbar,
// wird NICHT blockiert (skipped=true) — so haelt nichts den Upload auf, bis
// der Key hinterlegt ist. Sobald der Key da ist, wird scharf gefiltert.
//
// Secret setzen:  supabase secrets set OPENAI_API_KEY=sk-...
// Deployen:       supabase functions deploy moderate-image

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  // Kein Key -> Moderation ueberspringen (fail-open), Upload nicht blockieren.
  if (!apiKey) return json({ flagged: false, skipped: true })

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return json({ flagged: false, error: 'no image' })
    }

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: imageBase64 } }],
      }),
    })

    // API-Fehler -> fail-open (nicht blockieren), aber signalisieren.
    if (!res.ok) return json({ flagged: false, error: `openai ${res.status}` })

    const data = await res.json()
    const result = data?.results?.[0]
    return json({
      flagged: Boolean(result?.flagged),
      categories: result?.categories ?? null,
    })
  } catch (e) {
    // Unerwarteter Fehler -> fail-open.
    return json({ flagged: false, error: String(e) })
  }
})
