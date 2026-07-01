const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { query } = await req.json()
    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify([]), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      limit: '6',
      'accept-language': 'de',
      addressdetails: '1',
    })

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'Rankify/1.0 (y.fuchs2004@gmail.com)' },
    })

    if (!res.ok) throw new Error(`Nominatim ${res.status}`)

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
