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

/** Offizieller VRM-API-Host (Direktabruf; aus dem Browser fremder Domains per CORS gesperrt). */
const VRM_API_DIRECT = 'https://vrmapi.victronenergy.com/v2'

/**
 * Liefert die Basis-URL für API-Aufrufe. Ohne Proxy → Victron direkt (funktioniert nur ohne
 * CORS-Beschränkung, z.B. serverseitig). Mit Proxy → über einen eigenen CORS-offenen Vermittler
 * (siehe workers/vrm-proxy.js), der Pfad `/v2/...` unverändert an Victron weiterreicht.
 */
function apiBase(proxyBase?: string): string {
  const trimmed = proxyBase?.trim().replace(/\/+$/, '')
  return trimmed ? `${trimmed}/v2` : VRM_API_DIRECT
}

/**
 * Liest die Jahreskennzahlen aus der overallstats-Antwort. Struktur (per Netzwerk-Analyse des
 * echten Share-Dashboards): records.year.totals mit total_solar_yield / total_consumption /
 * grid_history_to (Einspeisung) – alle bereits in kWh.
 */
async function requestOverallStats(
  installationId: string,
  authHeader: string,
  proxyBase?: string,
): Promise<VrmPvData | null> {
  let response: Response
  try {
    response = await fetch(`${apiBase(proxyBase)}/installations/${installationId}/overallstats`, {
      headers: { 'X-Authorization': authHeader, Accept: 'application/json' },
    })
  } catch {
    return null // Netzwerk/CORS
  }
  if (!response.ok) return null

  const data = await response.json().catch(() => null)
  const records = data?.records as Record<string, Record<string, unknown>> | undefined
  const totals = (records?.year?.totals ??
    records?.this_year ??
    records?.total) as Record<string, unknown> | undefined
  if (!totals || typeof totals !== 'object') return null

  const annualYieldKwh = pickNumber(totals, ['total_solar_yield', 'solar_yield'])
  const consumption = pickNumber(totals, ['total_consumption', 'consumption'])
  const toGrid = pickNumber(totals, ['grid_history_to', 'grid_history_to_grid', 'to_grid']) ?? 0
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
 * Token (VRM → Preferences → Integrations → "Access tokens"). Optional über einen Proxy.
 */
export async function fetchVrmAnnualStats(
  installationId: string,
  accessToken: string,
  proxyBase?: string,
): Promise<VrmPvData> {
  const result =
    (await requestOverallStats(installationId, `Token ${accessToken}`, proxyBase)) ??
    (await requestOverallStats(installationId, `Bearer ${accessToken}`, proxyBase))
  if (!result) {
    throw new VrmFetchError(
      'Live-Abruf mit Access Token fehlgeschlagen (Token ungültig, keine Berechtigung für diese Installation oder – ohne Proxy – vom Browser wegen CORS blockiert). Alternativ Schnellschätzung oder manuelle Eingabe nutzen.',
    )
  }
  return result
}

/**
 * Tauscht den Share-Hash eines öffentlichen VRM-Links gegen ein befristetes Bearer-JWT.
 * Verifiziertes Format (per Netzwerk-Analyse des echten Share-Dashboards):
 * POST /v2/auth/verifyshare mit JSON { idSite, token }, Antwort { success, token, idUser }.
 */
async function exchangeShareHashForToken(
  installationId: string,
  shareHash: string,
  proxyBase?: string,
): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(`${apiBase(proxyBase)}/auth/verifyshare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ idSite: installationId, token: shareHash }),
    })
  } catch {
    return null // Netzwerk/CORS
  }
  if (!response.ok) return null

  const xToken = response.headers.get('x-token')
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const candidate = (typeof data?.token === 'string' && data.token) || xToken
  return typeof candidate === 'string' && candidate.length > 20 ? candidate : null
}

/**
 * Direktabruf über einen öffentlichen VRM-Share-Link, ohne Access Token: Share-Hash gegen
 * Bearer-JWT tauschen (verifyshare), dann Jahresstatistik abrufen. Ohne Proxy blockiert der
 * Browser die Aufrufe wegen Victrons CORS-Regel – dann Proxy-URL angeben (workers/vrm-proxy.js)
 * oder auf Schnellschätzung / manuelle Eingabe ausweichen.
 */
export async function fetchVrmViaShareLink(
  parsed: ParsedVrmLink,
  proxyBase?: string,
): Promise<VrmPvData> {
  if (!parsed.shareToken) {
    throw new VrmFetchError(
      'Der Link enthält keinen Share-Teil (…/share/…). Bitte den vollständigen Share-Link aus VRM kopieren.',
    )
  }

  const jwt = await exchangeShareHashForToken(parsed.installationId, parsed.shareToken, proxyBase)
  if (!jwt) {
    throw new VrmFetchError(
      proxyBase
        ? 'Der Share-Hash konnte über den Proxy nicht gegen ein Token getauscht werden. Proxy-URL korrekt und Worker erreichbar? Sonst Schnellschätzung oder manuelle Eingabe nutzen.'
        : 'Aus dem Browser blockiert Victron den Abruf (CORS). Trag eine Proxy-URL ein (siehe Hinweis) oder nutze Schnellschätzung / manuelle Eingabe.',
    )
  }

  const result = await requestOverallStats(parsed.installationId, `Bearer ${jwt}`, proxyBase)
  if (!result) {
    throw new VrmFetchError(
      'Token-Tausch hat geklappt, aber der Statistik-Abruf schlug fehl. Bitte Schnellschätzung nutzen oder Werte manuell eintragen.',
    )
  }
  return result
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
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
