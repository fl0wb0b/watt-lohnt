import { WEEKDAYS, type PresenceProfile, type VrmPvData } from './types'

export interface ParsedVrmLink {
  installationId: string
  shareToken: string | null
}

/**
 * Erkennt eine VRM-Installations- oder Share-URL bzw. eine reine Installations-ID.
 * Beispiel: https://vrm.victronenergy.com/installation/238127/share/020f6f7d
 */
export function parseVrmLink(input: string): ParsedVrmLink | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const shareMatch = trimmed.match(/installation\/(\d+)(?:\/share\/([a-zA-Z0-9]+))?/)
  if (shareMatch) {
    return { installationId: shareMatch[1], shareToken: shareMatch[2] ?? null }
  }

  if (/^\d+$/.test(trimmed)) {
    return { installationId: trimmed, shareToken: null }
  }

  return null
}

export class VrmFetchError extends Error {}

/** Offizieller API-Host laut VRM-API-Doku (nicht vrm.victronenergy.com selbst). */
const VRM_API_BASE = 'https://vrmapi.victronenergy.com/v2'

async function requestOverallStats(
  installationId: string,
  authHeader: string,
): Promise<VrmPvData | null> {
  let response: Response
  try {
    response = await fetch(`${VRM_API_BASE}/installations/${installationId}/overallstats`, {
      headers: { 'X-Authorization': authHeader, Accept: 'application/json' },
    })
  } catch {
    return null // Netzwerk/CORS
  }
  if (!response.ok) return null

  const data = await response.json().catch(() => null)
  const records = data?.records?.this_year ?? data?.records?.total ?? data?.records
  if (!records || typeof records !== 'object') return null

  const annualYieldKwh = pickFirstNumber(records, ['solar_yield', 'total_solar_yield', 'Pdc'])
  const consumption = pickFirstNumber(records, ['consumption', 'total_consumption'])
  const toGrid = pickFirstNumber(records, ['grid_history_to_grid', 'to_grid']) ?? 0
  if (annualYieldKwh == null || consumption == null) return null

  const selfConsumedKwh = Math.max(0, annualYieldKwh - toGrid)
  const selfConsumptionShare = annualYieldKwh > 0 ? selfConsumedKwh / annualYieldKwh : 0

  return {
    annualYieldKwh,
    selfConsumptionShare,
    annualHouseholdConsumptionKwh: consumption,
    source: 'live',
  }
}

/**
 * Ruft Jahres-PV-Ertrag und Verbrauch live über die VRM API v2 ab – mit persönlichem Access
 * Token (VRM → Preferences → Integrations → "Access tokens").
 */
export async function fetchVrmAnnualStats(
  installationId: string,
  accessToken: string,
): Promise<VrmPvData> {
  const result =
    (await requestOverallStats(installationId, `Token ${accessToken}`)) ??
    (await requestOverallStats(installationId, `Bearer ${accessToken}`))
  if (!result) {
    throw new VrmFetchError(
      'Live-Abruf mit Access Token fehlgeschlagen (Token ungültig, keine Berechtigung für diese Installation oder Netzwerk/CORS). Alternativ Schnellschätzung oder manuelle Eingabe nutzen.',
    )
  }
  return result
}

/**
 * Tauscht den Share-Hash eines öffentlichen VRM-Links gegen ein zeitlich befristetes Bearer-JWT –
 * derselbe Mechanismus, den Victrons eigenes Dashboard beim Öffnen eines Share-Links nutzt
 * (POST /v2/auth/verifyshare, per Netzwerk-Analyse ermittelt; offiziell undokumentiert).
 * Da das exakte Body-Format nicht dokumentiert ist, werden mehrere plausible Varianten probiert.
 */
async function exchangeShareHashForToken(shareHash: string): Promise<string | null> {
  const url = `${VRM_API_BASE}/auth/verifyshare`
  const jsonPost = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const attempts: Array<{ url: string; init: RequestInit }> = [
    { url, init: jsonPost({ hash: shareHash }) },
    { url, init: jsonPost({ share_token: shareHash }) },
    { url, init: jsonPost({ shareToken: shareHash }) },
    { url, init: jsonPost({ site_hash: shareHash }) },
    { url: `${url}?hash=${encodeURIComponent(shareHash)}`, init: { method: 'GET' } },
    { url: `${url}?share=${encodeURIComponent(shareHash)}`, init: { method: 'GET' } },
    { url, init: { method: 'GET', headers: { 'X-Share-Token': shareHash } } },
  ]

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.init)
      if (!response.ok) continue
      // Victron liefert erneuerte Tokens auch über den freigegebenen Response-Header x-token.
      const xToken = response.headers.get('x-token')
      const data: unknown = await response.json().catch(() => null)
      const body = data as Record<string, unknown> | null
      const candidate =
        (typeof body?.token === 'string' && body.token) ||
        (typeof (body?.records as Record<string, unknown> | undefined)?.token === 'string' &&
          ((body!.records as Record<string, unknown>).token as string)) ||
        (typeof body?.access_token === 'string' && body.access_token) ||
        xToken
      if (typeof candidate === 'string' && candidate.length > 20) return candidate
    } catch {
      // Netzwerk-/CORS-Fehler → nächste Variante probieren
    }
  }
  return null
}

const YIELD_KEYS = ['solar_yield', 'total_solar_yield', 'Pdc']
const CONSUMPTION_KEYS = ['consumption', 'total_consumption', 'Pc']
const TO_GRID_KEYS = ['grid_history_to_grid', 'to_grid', 'Pg']

function sumSeries(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) {
    let sum = 0
    let found = false
    for (const entry of value) {
      if (Array.isArray(entry) && typeof entry[1] === 'number' && Number.isFinite(entry[1])) {
        sum += entry[1]
        found = true
      }
    }
    return found ? sum : null
  }
  return null
}

function pickTotal(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!obj) return null
  for (const key of keys) {
    const total = sumSeries(obj[key])
    if (total != null) return total
  }
  return null
}

/** Werte > 100.000 sind bei Heim-PV praktisch sicher Wh statt kWh (z.B. Pdc-Totals der stats-API). */
function toKwh(value: number): number {
  return value > 100_000 ? value / 1000 : value
}

/**
 * Fallback, falls overallstats für Share-Tokens gesperrt ist: Jahres-Statistik über den
 * stats-Endpunkt aggregieren (monatsweise, letzte 365 Tage) – derselbe Endpunkt, den das
 * Share-Dashboard selbst benutzt (type=kwh, Zeitstempel in Sekunden).
 */
async function requestAnnualKwhStats(
  installationId: string,
  authHeader: string,
): Promise<VrmPvData | null> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - 365 * 24 * 3600
  const url = `${VRM_API_BASE}/installations/${installationId}/stats?type=kwh&interval=months&start=${start}&end=${end}`
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'X-Authorization': authHeader, Accept: 'application/json' },
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const data = await response.json().catch(() => null)
  const totals = data?.totals as Record<string, unknown> | undefined
  const records = data?.records as Record<string, unknown> | undefined

  const rawYield = pickTotal(totals, YIELD_KEYS) ?? pickTotal(records, YIELD_KEYS)
  const rawConsumption = pickTotal(totals, CONSUMPTION_KEYS) ?? pickTotal(records, CONSUMPTION_KEYS)
  const rawToGrid = pickTotal(totals, TO_GRID_KEYS) ?? pickTotal(records, TO_GRID_KEYS) ?? 0
  if (rawYield == null || rawConsumption == null) return null

  const annualYieldKwh = toKwh(rawYield)
  const toGrid = toKwh(rawToGrid)
  const selfConsumedKwh = Math.max(0, annualYieldKwh - toGrid)

  return {
    annualYieldKwh,
    selfConsumptionShare: annualYieldKwh > 0 ? selfConsumedKwh / annualYieldKwh : 0,
    annualHouseholdConsumptionKwh: toKwh(rawConsumption),
    source: 'live',
  }
}

/**
 * Direktabruf über einen öffentlichen VRM-Share-Link, ohne Access Token: Share-Hash gegen
 * Bearer-JWT tauschen (verifyshare), dann Jahresstatistik abrufen. Nutzt denselben – offiziell
 * undokumentierten – Mechanismus wie Victrons eigenes Share-Dashboard und kann daher brechen,
 * wenn Victron ihn ändert. Fallbacks: Schnellschätzung oder manuelle Eingabe.
 */
export async function fetchVrmViaShareLink(parsed: ParsedVrmLink): Promise<VrmPvData> {
  if (!parsed.shareToken) {
    throw new VrmFetchError(
      'Der Link enthält keinen Share-Teil (…/share/…). Bitte den vollständigen Share-Link aus VRM kopieren.',
    )
  }

  const jwt = await exchangeShareHashForToken(parsed.shareToken)
  if (!jwt) {
    throw new VrmFetchError(
      'Der Share-Hash konnte nicht gegen ein Zugriffstoken getauscht werden (verifyshare abgelehnt oder vom Browser wegen CORS blockiert). Bitte Schnellschätzung nutzen oder Werte manuell eintragen.',
    )
  }

  const result =
    (await requestOverallStats(parsed.installationId, `Bearer ${jwt}`)) ??
    (await requestAnnualKwhStats(parsed.installationId, `Bearer ${jwt}`))
  if (!result) {
    throw new VrmFetchError(
      'Token-Tausch hat geklappt, aber der Statistik-Abruf schlug fehl. Bitte Schnellschätzung nutzen oder Werte manuell eintragen.',
    )
  }
  return result
}

function pickFirstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (Array.isArray(value) && typeof value[1] === 'number') return value[1]
  }
  return null
}

/**
 * Anteil der Woche (0..1, gleichgewichtet je Tag, da PV-Ertrag über die Wochentage ähnlich
 * verteilt ist), an dem laut Anwesenheitsprofil tagsüber jemand zuhause ist und laden könnte.
 */
export function presenceFactor(profile: PresenceProfile): number {
  const homeDays = WEEKDAYS.filter((d) => profile[d]).length
  return homeDays / WEEKDAYS.length
}

/**
 * Schätzt, welcher Anteil des jährlichen Auto-Ladebedarfs aus PV-Überschuss gedeckt werden
 * könnte: PV-Ertrag, der aktuell nicht vom Haushalt selbst verbraucht wird (= tagsüber ins Netz
 * eingespeister Überschuss), steht potenziell fürs Laden zur Verfügung – allerdings nur an den
 * Tagen, an denen laut Anwesenheitsprofil tagsüber überhaupt jemand zuhause ist, um den Wagen
 * anzuschließen. Ohne Heimspeicher/Auto als Puffer ist Überschuss an Abwesenheitstagen faktisch
 * nicht nutzbar für das Laden.
 */
export function estimatePvShareForEv(
  pv: VrmPvData,
  evAnnualNeedKwh: number,
  profile: PresenceProfile,
): number {
  if (evAnnualNeedKwh <= 0) return 0
  const currentlyFedIn = Math.max(0, pv.annualYieldKwh * (1 - pv.selfConsumptionShare))
  const reachableSurplus = currentlyFedIn * presenceFactor(profile)
  return Math.max(0, Math.min(1, reachableSurplus / evAnnualNeedKwh))
}

/**
 * Schnellschätzung der PV-Kennzahlen aus der Anlagengröße – für alle, die ihre VRM-Werte nicht
 * zur Hand haben. Jahresertrag = kWp × spezifischer Ertrag (Deutschland typischerweise
 * ~950–1050 kWh/kWp je nach Lage/Ausrichtung). Der Eigenverbrauchsanteil ohne Speicher folgt
 * einer einfachen Faustkurve über das Verhältnis Haushaltsverbrauch/Erzeugung (kleine Anlage →
 * hoher Eigenverbrauch, große Anlage → viel Einspeisung); ein Heimspeicher hebt den Anteil
 * deutlich an. Genauer sind immer die echten Werte aus dem VRM-Dashboard (manueller Modus).
 */
export function estimatePvFromSize(
  kwp: number,
  specificYieldKwhPerKwp: number,
  annualHouseholdConsumptionKwh: number,
  hasBatteryStorage: boolean,
): VrmPvData {
  const annualYieldKwh = Math.max(0, kwp * specificYieldKwhPerKwp)
  let share =
    annualYieldKwh > 0 ? 0.3 * Math.sqrt(annualHouseholdConsumptionKwh / annualYieldKwh) : 0
  if (hasBatteryStorage) share += 0.3
  share = Math.min(0.85, Math.max(0.1, share))
  return {
    annualYieldKwh: Math.round(annualYieldKwh),
    selfConsumptionShare: share,
    annualHouseholdConsumptionKwh,
    source: 'manual',
  }
}
