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

const VRM_API_BASE = 'https://vrm.victronenergy.com/api/v2'

/**
 * Ruft Jahres-PV-Ertrag und Verbrauch live über die VRM API v2 ab.
 *
 * WICHTIG: Victrons öffentliche Share-Links ("/installation/{id}/share/{token}") sind reine
 * Dashboard-Ansichten und keine browser-seitig aufrufbare API – ein Drittanbieter kann darüber
 * keine Daten abrufen (kein CORS/Auth vorgesehen). Für einen echten Live-Abruf braucht es einen
 * VRM Access Token (VRM → Preferences → Integrations → "Access tokens" → neuen Token erzeugen).
 * Schlägt der Abruf fehl (falscher/fehlender Token, CORS, Netzwerk), wird ein Fehler geworfen –
 * die UI fällt dann auf manuelle Eingabe zurück.
 */
export async function fetchVrmAnnualStats(
  installationId: string,
  accessToken: string,
): Promise<VrmPvData> {
  const url = `${VRM_API_BASE}/installations/${installationId}/overallstats`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'X-Authorization': `Token ${accessToken}`,
        Accept: 'application/json',
      },
    })
  } catch {
    throw new VrmFetchError(
      'Live-Abruf fehlgeschlagen (Netzwerk/CORS). Victron erlaubt Browser-Zugriffe von fremden Seiten häufig nicht – bitte Werte manuell eintragen.',
    )
  }

  if (!response.ok) {
    throw new VrmFetchError(
      `VRM API antwortete mit Status ${response.status}. Access Token korrekt und für diese Installation gültig? Sonst bitte manuell eintragen.`,
    )
  }

  const data = await response.json().catch(() => null)
  const records = data?.records?.this_year ?? data?.records?.total ?? data?.records

  if (!records || typeof records !== 'object') {
    throw new VrmFetchError('Unerwartetes Antwortformat der VRM API. Bitte Werte manuell eintragen.')
  }

  const annualYieldKwh = pickFirstNumber(records, ['solar_yield', 'total_solar_yield', 'Pdc'])
  const consumption = pickFirstNumber(records, ['consumption', 'total_consumption'])
  const toGrid = pickFirstNumber(records, ['grid_history_to_grid', 'to_grid']) ?? 0

  if (annualYieldKwh == null || consumption == null) {
    throw new VrmFetchError(
      'PV-Ertrag/Verbrauch nicht in der Antwort gefunden. Bitte Werte manuell eintragen.',
    )
  }

  const selfConsumedKwh = Math.max(0, annualYieldKwh - toGrid)
  const selfConsumptionShare = annualYieldKwh > 0 ? selfConsumedKwh / annualYieldKwh : 0

  return {
    annualYieldKwh,
    selfConsumptionShare,
    annualHouseholdConsumptionKwh: consumption,
    source: 'live',
  }
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
