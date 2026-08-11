/**
 * Watt-lohnt VRM-Proxy – Cloudflare Worker
 * -----------------------------------------
 * Winziger Vermittler, der Anfragen der App an die Victron-VRM-API weiterreicht und die
 * Antwort mit passenden CORS-Headern zurückgibt. Nötig, weil Victrons API Browser-Aufrufe von
 * fremden Domains (z.B. GitHub Pages) per CORS blockiert – ein Server hat diese Sperre nicht.
 *
 * Gehärtet für den öffentlichen Einsatz:
 *  - Nur eine kleine Allowlist an Pfaden wird weitergereicht (verifyshare / overallstats / stats).
 *    Der Proxy kann also ausschließlich PV-Share-Statistiken lesen, nichts anderes.
 *  - Nur Anfragen von den erlaubten Origins (die App selbst) werden mit CORS beantwortet, damit
 *    fremde Webseiten den Worker nicht als offenen Relay für ihre eigene Quota-Nutzung missbrauchen.
 *  - Es werden keine Daten gespeichert oder protokolliert.
 *
 * Deploy (kostenlos):
 *   npx wrangler deploy workers/vrm-proxy.js --name vrm-proxy --compatibility-date 2024-01-01
 *   (oder im Cloudflare-Dashboard: Workers & Pages → Create Worker → Inhalt einfügen → Deploy)
 *
 * Eigene App-Domain? Dann unten ALLOWED_ORIGINS anpassen.
 */

const UPSTREAM = 'https://vrmapi.victronenergy.com'

const ALLOWED_ORIGINS = ['https://watt-lohnt.fl0wb0b.com', 'https://fl0wb0b.github.io']

const ALLOWED_PATHS = [
  /^\/v2\/auth\/verifyshare$/,
  /^\/v2\/installations\/\d+\/overallstats$/,
  /^\/v2\/installations\/\d+\/stats$/,
]

function originAllowed(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^http:\/\/localhost(:\d+)?$/.test(origin)
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Authorization,Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin')

    if (!originAllowed(origin)) {
      return new Response('Forbidden origin.', { status: 403 })
    }
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url = new URL(request.url)
    if (!ALLOWED_PATHS.some((re) => re.test(url.pathname))) {
      return new Response(JSON.stringify({ error: 'Path not allowed.' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const init = { method: request.method, headers: { Accept: 'application/json' } }
    const auth = request.headers.get('X-Authorization')
    if (auth) init.headers['X-Authorization'] = auth
    const contentType = request.headers.get('Content-Type')
    if (contentType) init.headers['Content-Type'] = contentType
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.text()
    }

    let upstream
    try {
      upstream = await fetch(UPSTREAM + url.pathname + url.search, init)
    } catch {
      return new Response(JSON.stringify({ error: 'Upstream request failed.' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...cors,
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    })
  },
}
