import { compareCars, computeCarResult } from '../src/lib/calc'
import { simulateSolarCharging } from '../src/lib/simulate'
import { getPreset } from '../src/lib/presets'
import type { CarConfig, GeneralParams, OldCarConfig, VrmPvData } from '../src/lib/types'

const eur = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'

const G: GeneralParams = {
  horizonYears: 8,
  gridElectricityPricePerKwh: 0.32,
  feedInTariffPerKwh: 0.08,
  dieselPricePerLiter: 2.2,
  petrolPricePerLiter: 2.13,
  pvSelfConsumptionShareForEv: 0.8,
  costInflationPercent: 2.5,
  fuelCostInflationExtraPercent: 1,
  chargingLossPercent: 10,
  discountRatePercent: 0,
  uncertaintyPercent: 10,
}

const OLD: OldCarConfig = {
  id: 'old', label: 'Alt', type: 'ice', fuelType: 'diesel', annualKm: 15000,
  ageYears: 8, odometerKm: 120000, financingType: 'cash', purchasePrice: 0, subsidy: 0,
  downPayment: 0, loanInterestRatePercent: 0, loanTermYears: 0, balloonPercent: 0,
  leaseMonthlyRate: 0, leaseSpecialPayment: 0, leaseTermYears: 0, insurancePerYear: 700,
  taxPerYear: 130, taxExemptionYears: 0, postExemptionTaxPerYear: 130, thgQuotePerYear: 0,
  wallboxCost: 0, maintenancePerYear: 650, consumptionPer100km: 6.5,
  annualDepreciationPercent: 12, currentMarketValue: 15000,
}

const TESLA: CarConfig = { id: 'n', label: 'Tesla', ...getPreset('tesla-model-y').config }

function reconcile(label: string, car: CarConfig, g: GeneralParams, tradeIn: number) {
  const r = computeCarResult(car, g, tradeIn)
  const ongoing = r.years.reduce((a, y) => a + y.ongoingTotal, 0)
  const table = r.upfrontCash + ongoing + r.outstandingBalance.at(-1)! - r.residualValueAtHorizon
  const diff = Math.abs(table - r.totalCostAtHorizon)
  console.log(
    `${label.padEnd(46)} Tabelle=${eur(table).padStart(10)}  Engine=${eur(r.totalCostAtHorizon).padStart(10)}  ${diff < 1 ? 'OK' : 'DIFF ' + diff.toFixed(2) + ' !!'}`,
  )
  return r
}

console.log('=== A) Tabellen-Summe == Engine-Summe (Reconciliation, alle Finanzierungsarten) ===')
for (const ft of ['cash', 'loan', 'balloon', 'lease'] as const) {
  reconcile(`Tesla ${ft}, tradeIn 15k`, { ...TESLA, financingType: ft }, G, 15000)
}
reconcile('Tesla loan, Horizont 3 < Laufzeit 6 (Restschuld!)', { ...TESLA, financingType: 'loan' }, { ...G, horizonYears: 3 }, 0)
reconcile('Tesla balloon, Horizont 4 < Laufzeit 6', { ...TESLA, financingType: 'balloon' }, { ...G, horizonYears: 4 }, 0)

console.log('\n=== B) Grenzfall: Inzahlungnahme/Anzahlung übersteigt den Kaufpreis ===')
{
  const cheap: CarConfig = { ...TESLA, purchasePrice: 12000, financingType: 'cash' }
  const r = computeCarResult(cheap, G, 15000) // Altwagen bringt 15k, Neuwagen kostet 12k
  console.log('cash, Preis 12k, tradeIn 15k → upfront (erwartet −3.000 € Überschuss-Gutschrift):', eur(r.upfrontCash - (cheap.type === 'bev' ? cheap.wallboxCost : 0)))
  const loanCar: CarConfig = { ...TESLA, purchasePrice: 30000, financingType: 'loan', downPayment: 20000 }
  const r2 = computeCarResult(loanCar, G, 15000) // 30k − 15k tradeIn = 15k Bedarf, aber 20k Anzahlung angesetzt
  console.log('loan, Preis 30k, tradeIn 15k, Anzahlung 20k → upfront ohne Wallbox (erwartet ≤ 15.000, nicht 20.000):', eur(r2.upfrontCash - loanCar.wallboxCost), '| finanziert Jahr1-Rate:', eur(r2.years[0].financingCash))
}

console.log('\n=== C) Extremwerte müssen gutmütig bleiben ===')
{
  const zeroKm = computeCarResult({ ...TESLA, annualKm: 0 }, G, 0)
  console.log('0 km/Jahr → Energie Jahr1 (erwartet 0):', eur(zeroKm.years[0].energy))
  const g0 = { ...G, horizonYears: 1 }
  const one = compareCars(OLD, TESLA, g0, true)
  console.log('Horizont 1 Jahr → Kurvenlänge (erwartet 2):', one.oldCumulativeNet.length)
  const subBig = computeCarResult({ ...TESLA, subsidy: 99999, financingType: 'cash' }, G, 0)
  console.log('Förderung > Kaufpreis, cash → upfront (erwartet ≥ 0 bzw. ehrlicher Umgang):', eur(subBig.upfrontCash))
}

console.log('\n=== D) Simulation: Energieerhaltung & Plausibilität ===')
{
  const pv: VrmPvData = { annualYieldKwh: 24301, selfConsumptionShare: 0.38, annualHouseholdConsumptionKwh: 10329, source: 'manual' }
  const need = (14000 / 100) * 13.1
  for (const [lbl, cfg] of [
    ['16 Uhr, 10 kWh Speicher, 11 kW', { earliestChargeHour: 16, batteryCapacityKwh: 10, maxChargePowerKw: 11 }],
    ['16 Uhr, 10 kWh Speicher, 2 kW (schwacher Lader)', { earliestChargeHour: 16, batteryCapacityKwh: 10, maxChargePowerKw: 2 }],
    ['Winter-taugliche Mini-PV: 2.000 kWh Ertrag', null],
  ] as const) {
    const p = lbl.startsWith('Winter') ? { ...pv, annualYieldKwh: 2000 } : pv
    const c = cfg ?? { earliestChargeHour: 16, batteryCapacityKwh: 10, maxChargePowerKw: 11 }
    const r = simulateSolarCharging(p, need, 10, c)
    const delivered = r.fromPvDirectKwh + r.fromBatteryKwh + r.fromGridKwh
    const cover = delivered / r.carAnnualKwh
    console.log(
      `${lbl.padEnd(46)} Solar ${(r.solarShare * 100).toFixed(0).padStart(3)}% | geliefert ${Math.round(delivered)} / Bedarf ${Math.round(r.carAnnualKwh)} kWh (${(cover * 100).toFixed(0)}% gedeckt${cover < 0.95 ? ' ← UNTERDECKUNG!' : ''})`,
    )
  }
}

console.log('\n=== E) Monotonie: mehr PV/Speicher darf nie schaden, mehr Zins nie helfen ===')
{
  const pv = (y: number): VrmPvData => ({ annualYieldKwh: y, selfConsumptionShare: 0.38, annualHouseholdConsumptionKwh: 10329, source: 'manual' })
  const need = 2000
  let prev = -1
  let mono = true
  for (const y of [2000, 6000, 12000, 24000, 48000]) {
    const s = simulateSolarCharging(pv(y), need, 10, { earliestChargeHour: 16, batteryCapacityKwh: 10, maxChargePowerKw: 11 }).solarShare
    if (s < prev - 1e-9) mono = false
    prev = s
  }
  console.log('Solaranteil steigt monoton mit PV-Ertrag:', mono ? 'JA' : 'NEIN !!')
  const cheapLoan = computeCarResult({ ...TESLA, financingType: 'loan', loanInterestRatePercent: 2 }, G, 0)
  const dearLoan = computeCarResult({ ...TESLA, financingType: 'loan', loanInterestRatePercent: 12 }, G, 0)
  console.log('12% Zins teurer als 2% Zins:', dearLoan.totalCostAtHorizon > cheapLoan.totalCostAtHorizon ? 'JA' : 'NEIN !!')
}
console.log('\nDone.')
