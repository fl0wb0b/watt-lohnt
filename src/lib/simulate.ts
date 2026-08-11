import type { ChargingSimConfig, ChargingSimResult, VrmPvData } from './types'

/**
 * Stündliche Energiefluss-Simulation über ein Jahr, um den Solaranteil der Auto-Ladung zu
 * bestimmen – statt eines pauschalen Schätzfaktors.
 *
 * Modelliert je Stunde: PV-Erzeugung → deckt zuerst die Haushaltslast; Überschuss lädt (in der
 * Ladezeit) das Auto bzw. den Heimspeicher, der Rest geht ins Netz. Bei Unterdeckung liefert der
 * Speicher (PV-gespeist) an Haus und Auto, danach das Netz.
 *
 * Da wir aus der VRM-API nur Jahres-Summen kennen, werden realistische Stundenprofile
 * synthetisiert: PV mit saisonaler Monatsverteilung (Deutschland) und Tagesglocke, Haushaltslast
 * mit typischem Tagesgang (Morgen-/Abendspitze). Der Heimspeicher wird mit seiner tatsächlichen
 * kWh-Kapazität simuliert. Es bleibt eine Modellrechnung – für exakte Werte könnten später echte
 * Stundendaten aus VRM eingespeist werden.
 */

/** Anteil des Jahres-PV-Ertrags je Monat (Deutschland, Richtwerte, normiert auf 1). */
const PV_MONTH_SHARE = [
  0.028, 0.045, 0.083, 0.108, 0.122, 0.121, 0.125, 0.108, 0.086, 0.06, 0.03, 0.024,
]
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Tagesglocke der PV-Leistung je Stunde (relativ), Sonne grob 6–20 Uhr, Peak ~13 Uhr. */
function pvDayShape(): number[] {
  const w = Array.from({ length: 24 }, (_, h) => {
    if (h < 6 || h > 20) return 0
    return Math.max(0, Math.sin((Math.PI * (h - 6)) / 14))
  })
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / sum)
}

/** Typischer Haushalts-Tagesgang (relativ, ohne Auto): Grundlast nachts, Morgen- und Abendspitze. */
const LOAD_DAY_SHAPE = normalize([
  0.6, 0.55, 0.5, 0.5, 0.55, 0.7, 0.9, 1.2, 1.1, 0.9, 0.85, 0.9, 1.0, 0.95, 0.85, 0.85, 0.95, 1.15,
  1.45, 1.5, 1.35, 1.1, 0.85, 0.7,
])

function normalize(arr: number[]): number[] {
  const sum = arr.reduce((a, b) => a + b, 0)
  return arr.map((x) => x / sum)
}

const BATTERY_ROUND_TRIP = 0.9
const BATTERY_RESERVE_FRAC = 0.05 // nicht vollständig entladen

export function simulateSolarCharging(
  pv: VrmPvData,
  carAnnualKwhRaw: number,
  chargingLossPercent: number,
  cfg: ChargingSimConfig,
): ChargingSimResult {
  const carAnnualKwh = carAnnualKwhRaw * (1 + Math.max(0, chargingLossPercent) / 100)
  if (carAnnualKwh <= 0) {
    return { solarShare: 0, carAnnualKwh: 0, fromPvDirectKwh: 0, fromBatteryKwh: 0, fromGridKwh: 0 }
  }

  const pvShape = pvDayShape()
  const capacity = Math.max(0, cfg.batteryCapacityKwh)
  const reserve = capacity * BATTERY_RESERVE_FRAC
  const chargeEff = Math.sqrt(BATTERY_ROUND_TRIP)
  const dischargeEff = Math.sqrt(BATTERY_ROUND_TRIP)
  const battMaxKw = capacity > 0 ? Math.max(3, capacity * 0.5) : 0
  const carMaxKw = Math.max(1, cfg.maxChargePowerKw)

  const earliest = Math.max(0, Math.min(23, cfg.earliestChargeHour))
  const DEPARTURE_HOUR = 7 // morgens abgeklemmt (Wegfahren) – begrenzt die Ladefenster-Länge
  // Auto ist von der frühesten Ladezeit abends bis zur Abfahrt am Morgen angeschlossen.
  const plugged = (h: number) =>
    earliest < DEPARTURE_HOUR ? h >= earliest && h < DEPARTURE_HOUR : h >= earliest || h < DEPARTURE_HOUR

  const dailyHouseholdKwh = pv.annualHouseholdConsumptionKwh / 365
  const dailyCarKwh = carAnnualKwh / 365

  let soc = capacity * 0.5
  let fromPvDirect = 0
  let fromBattery = 0
  let fromGrid = 0

  // Zwei Durchläufe: erster wärmt den Speicher-Ladezustand ein, zweiter misst.
  for (let pass = 0; pass < 2; pass++) {
    const measure = pass === 1
    for (let m = 0; m < 12; m++) {
      const dailyPvKwh = (pv.annualYieldKwh * PV_MONTH_SHARE[m]) / DAYS_IN_MONTH[m]
      // Repräsentativer Tag, gewichtet mit der Anzahl Tage im Monat.
      const weight = DAYS_IN_MONTH[m]
      let carRemaining = dailyCarKwh

      for (let rep = 0; rep < (measure ? weight : 1); rep++) {
        // Der Ladetag beginnt beim Anstecken (earliest) und läuft über Nacht; deshalb den
        // Stunden-Loop dorthin rotieren, damit die Nachfrage nicht vor der Sonne verbraucht wird.
        carRemaining = dailyCarKwh
        for (let i = 0; i < 24; i++) {
          const h = (earliest + i) % 24
          const pvGen = dailyPvKwh * pvShape[h]
          const load = dailyHouseholdKwh * LOAD_DAY_SHAPE[h]
          const carWant = plugged(h) ? Math.min(carRemaining, carMaxKw) : 0

          let net = pvGen - load // >0 Überschuss, <0 Defizit

          if (net >= 0) {
            // 1) Auto nimmt direkten PV-Überschuss
            const toCar = Math.min(net, carWant)
            net -= toCar
            carRemaining -= toCar
            if (measure) fromPvDirect += toCar
            // 2) Speicher lädt mit Rest-Überschuss
            if (capacity > 0 && net > 0) {
              const room = (capacity - soc) / chargeEff
              const charge = Math.min(net, room, battMaxKw)
              soc += charge * chargeEff
              net -= charge
            }
            // 3) Rest → Netzeinspeisung (nicht weiter relevant)
          } else {
            let deficit = -net
            // Haus zuerst aus Speicher decken
            if (capacity > 0) {
              const avail = Math.max(0, soc - reserve) * dischargeEff
              const use = Math.min(deficit, avail, battMaxKw)
              soc -= use / dischargeEff
              deficit -= use
            }
            // Auto in Ladezeit: aus Speicher, dann Netz
            let carLeft = carWant
            if (capacity > 0 && carLeft > 0) {
              const avail = Math.max(0, soc - reserve) * dischargeEff
              const use = Math.min(carLeft, avail, battMaxKw)
              soc -= use / dischargeEff
              carLeft -= use
              carRemaining -= use
              if (measure) fromBattery += use
            }
            if (carLeft > 0) {
              carRemaining -= carLeft
              if (measure) fromGrid += carLeft
            }
          }
        }
      }
    }
  }

  const total = fromPvDirect + fromBattery + fromGrid
  const solarShare = total > 0 ? (fromPvDirect + fromBattery) / total : 0

  return {
    solarShare,
    carAnnualKwh,
    fromPvDirectKwh: fromPvDirect,
    fromBatteryKwh: fromBattery,
    fromGridKwh: fromGrid,
  }
}
