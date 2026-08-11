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
 * EXPERIMENTELL: versucht, den Share-Hash aus einem öffentlichen VRM-Share-Link direkt als
 * API-Berechtigung zu verwenden. Victron dokumentiert dafür keine öffentliche API – dieser Weg
 * kann jederzeit funktionieren oder brechen. Schlägt er fehl, bleibt Schnellschätzung/manuelle
 * Eingabe der zuverlässige Weg.
 */
export async function fetchVrmViaShareLink(parsed: ParsedVrmLink): Promise<VrmPvData> {
  if (!parsed.shareToken) {
    throw new VrmFetchError(
      'Der Link enthält keinen Share-Teil (…/share/…). Bitte den vollständigen Share-Link aus VRM kopieren.',
    )
  }
  const result =
    (await requestOverallStats(parsed.installationId, `Token ${parsed.shareToken}`)) ??
    (await requestOverallStats(parsed.installationId, `Bearer ${parsed.shareToken}`))
  if (!result) {
    throw new VrmFetchError(
      'Direktabruf über den Share-Link hat nicht geklappt – Victron bietet dafür offiziell keine API, der Versuch war experimentell. Bitte Schnellschätzung nutzen (nur kWp nötig) oder Werte manuell aus dem VRM-Dashboard ablesen.',
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
