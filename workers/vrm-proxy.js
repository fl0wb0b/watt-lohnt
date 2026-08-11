/**
 * Watt-lohnt VRM-Proxy – Cloudflare Worker
 * -----------------------------------------
 * Winziger Vermittler, der Anfragen der App an die Victron-VRM-API weiterreicht und die
 * Antwort mit offenen CORS-Headern zurückgibt. Nötig, weil Victrons API Browser-Aufrufe von
 * fremden Domains (z.B. GitHub Pages) per CORS blockiert – ein Server hat diese Sperre nicht.
 *
 * Reicht ausschließlich `/v2/...`-Pfade an https://vrmapi.victronenergy.com weiter; alles andere
 * wird abgelehnt. Es werden keine Daten gespeichert oder protokolliert.
 *
 * Deploy (kostenlos):
 *   1. Kostenloses Konto auf https://dash.cloudflare.com anlegen.
 *   2. Workers & Pages → "Create" → "Create Worker" → Namen vergeben (z.B. "vrm-proxy").
 *   3. Diesen Datei-Inhalt in den Editor einfügen, "Deploy" klicken.
 *   4. Die vergebene URL (z.B. https://vrm-proxy.DEINNAME.workers.dev) in der App im Feld
 *      "Proxy-URL" (Tab „VRM-Live") eintragen.
 *
 * Alternativ per CLI:  npx wrangler deploy workers/vrm-proxy.js --name vrm-proxy
 */

const UPSTREAM = 'https://vrmapi.victronenergy.com'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Authorization,Accept',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const url = new URL(request.url)
    if (!url.pathname.startsWith('/v2/')) {
      return new Response(JSON.stringify({ error: 'Only /v2/* paths are proxied.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const init = { method: request.method, headers: {} }
    const auth = request.headers.get('X-Authorization')
    if (auth) init.headers['X-Authorization'] = auth
    const contentType = request.headers.get('Content-Type')
    if (contentType) init.headers['Content-Type'] = contentType
    init.headers['Accept'] = 'application/json'
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.text()
    }

    let upstream
    try {
      upstream = await fetch(UPSTREAM + url.pathname + url.search, init)
    } catch {
      return new Response(JSON.stringify({ error: 'Upstream request failed.' }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    })
  },
}
