import { compareCars, computeCarResult } from '../src/lib/calc'
import { getPreset } from '../src/lib/presets'
import type { CarConfig, GeneralParams, OldCarConfig } from '../src/lib/types'

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
  id: 'old', label: 'Alt-Diesel', type: 'ice', fuelType: 'diesel', annualKm: 14000,
  ageYears: 8, odometerKm: 120000, financingType: 'cash', purchasePrice: 0, subsidy: 0,
  downPayment: 0, loanInterestRatePercent: 0, loanTermYears: 0, balloonPercent: 0,
  leaseMonthlyRate: 0, leaseSpecialPayment: 0, leaseTermYears: 0, insurancePerYear: 700,
  taxPerYear: 130, taxExemptionYears: 0, postExemptionTaxPerYear: 130, thgQuotePerYear: 0,
  wallboxCost: 0, maintenancePerYear: 650, consumptionPer100km: 6.5,
  annualDepreciationPercent: 12, currentMarketValue: 15000, expectedLifetimeKm: 300000, replacementCost: 12000,
}

const TESLA_FILL = {
  annualKm: 14000, purchasePrice: 44990, insurancePerYear: 950, downPayment: 0,
  loanInterestRatePercent: 7, loanTermYears: 6, balloonPercent: 35,
  leaseMonthlyRate: 429, leaseSpecialPayment: 3000, leaseTermYears: 4,
}
const TESLA: CarConfig = { id: 'n', label: 'Tesla', ...getPreset('tesla-model-y').config, ...TESLA_FILL }

console.log('=== Run A) Richtungstest: Wenigfahrer vs. Vielfahrer ===')
console.log('Erwartung: je mehr km, desto besser fürs EV (Spritkosten dominieren).')
for (const km of [5000, 14000, 30000]) {
  const cmp = compareCars(
    { ...OLD, annualKm: km },
    { ...TESLA, annualKm: km },
    G,
    true,
  )
  const s = cmp.savingsAtHorizon
  console.log(
    `${String(km).padStart(6)} km/Jahr → EV-Vorteil über 8J: ${eur(s).padStart(10)}  Break-even: ${cmp.breakEvenYear ?? '—'}`,
  )
}

console.log('\n=== Run B) Leasing-Sonderfälle ===')
{
  const lease: CarConfig = {
    ...TESLA, financingType: 'lease', leaseMonthlyRate: 429, leaseSpecialPayment: 3000, leaseTermYears: 4,
  }
  // B1: Horizont 8 > Laufzeit 4 → Jahre 5-8 mit Inflation weitergeleast (dokumentierte Annahme)
  const r8 = computeCarResult(lease, G, 0)
  const y4 = r8.years[3].financingCash
  const y5 = r8.years[4].financingCash
  const y8 = r8.years[7].financingCash
  console.log(`B1  Rate Jahr4 (in Laufzeit, erwartet 12×429=5.148): ${eur(y4)}`)
  console.log(`    Rate Jahr5 (Anschluss, erwartet ~5.148×1,025): ${eur(y5)} | Jahr8: ${eur(y8)}`)
  console.log(`    Sonderzahlung nur einmal in upfront (erwartet 3.000 + 1.500 Wallbox): ${eur(r8.upfrontCash)}`)
  // B2: Horizont 2 < Laufzeit 4 → nur 2 Jahre Raten, kein Restwert, keine Restschuld
  const r2 = computeCarResult(lease, { ...G, horizonYears: 2 }, 0)
  const total2 = r2.upfrontCash + r2.years.reduce((a, y) => a + y.ongoingTotal, 0)
  console.log(`B2  Horizont 2 Jahre: Raten gezahlt ${eur(r2.years[0].financingCash + r2.years[1].financingCash)} (erwartet 2×5.148=10.296), Restwert ${eur(r2.residualValueAtHorizon)} (erwartet 0)`)
  console.log(`    Engine-Total ${eur(r2.totalCostAtHorizon)} == Kassensumme ${eur(total2)}: ${Math.abs(r2.totalCostAtHorizon - total2) < 1 ? 'OK' : 'DIFF !!'}`)
  // B3: Auch beim Leasing ist der Verkaufserlös des Altwagens echtes Geld – er muss die
  //     Sofortkosten mindern (sonst wäre der Leasing-Pfad im Vergleich um den Erlös zu schlecht).
  const rTrade = computeCarResult(lease, G, 15000)
  const expected = r8.upfrontCash - 15000
  console.log(`B3  Leasing upfront mit tradeIn 15k (erwartet ${eur(expected)} = ${eur(r8.upfrontCash)} − 15.000): ${eur(rTrade.upfrontCash)} ${rTrade.upfrontCash === expected ? 'OK' : 'FEHLER !!'}`)
}

console.log('\n=== Run C) Diskontierung: bewusste Abweichung Tabelle (nominal) vs. Engine (Barwert) ===')
{
  const g5 = { ...G, discountRatePercent: 5 }
  const r0 = computeCarResult({ ...TESLA, financingType: 'loan' }, G, 15000)
  const r5 = computeCarResult({ ...TESLA, financingType: 'loan' }, g5, 15000)
  const nominalTable = r5.upfrontCash + r5.years.reduce((a, y) => a + y.ongoingTotal, 0) - r5.residualValueAtHorizon
  console.log(`Nominal (0%):   Engine ${eur(r0.totalCostAtHorizon)}`)
  console.log(`Barwert (5%):   Engine ${eur(r5.totalCostAtHorizon)} < nominal? ${r5.totalCostAtHorizon < r0.totalCostAtHorizon ? 'JA (korrekt: künftige Ausgaben zählen weniger)' : 'NEIN !!'}`)
  console.log(`Nominale Tabellensumme bei 5%: ${eur(nominalTable)} → weicht vom Barwert ab: ${Math.abs(nominalTable - r5.totalCostAtHorizon) > 1 ? 'JA (dokumentiert: Tabelle ist bewusst nominal)' : 'nein'}`)
  // Fairness: Diskontierung muss BEIDE Pfade gleich behandeln – Reihenfolge des Vergleichs stabil?
  const cmp0 = compareCars(OLD, TESLA, G, true)
  const cmp5 = compareCars(OLD, TESLA, g5, true)
  console.log(`Vergleich nominal: EV-Vorteil ${eur(cmp0.savingsAtHorizon)} | diskontiert 5%: ${eur(cmp5.savingsAtHorizon)} (gleiche Richtung? ${Math.sign(cmp0.savingsAtHorizon) === Math.sign(cmp5.savingsAtHorizon) ? 'JA' : 'NEIN – prüfen!'})`)
}

console.log('\n=== Run E) Lebensdauer: 350.000-km-Diesel darf nicht ewig weiterfahren ===')
{
  for (const [lbl, odo, life] of [
    ['120k km, Lebensdauer 300k (stirbt in J13 → außerhalb 8J)', 120000, 300000],
    ['250k km, Lebensdauer 300k (stirbt in J4)', 250000, 300000],
    ['350k km, Lebensdauer 300k (schon drüber → Ersatz J1)', 350000, 300000],
  ] as const) {
    const old = { ...OLD, odometerKm: odo, expectedLifetimeKm: life }
    const cmp = compareCars(old, TESLA, G, true)
    const repl = cmp.old.years.reduce((a, y) => a + y.replacement, 0)
    console.log(
      `${lbl.padEnd(52)} EoL-Jahr: ${String(cmp.old.endOfLifeYear ?? '—').padStart(2)} | Ersatzkosten: ${eur(repl).padStart(9)} | Nettokosten Behalten: ${eur(cmp.oldCumulativeNet.at(-1)!)}`,
    )
  }
}

console.log('\n=== Run D) Energiepreis-Sensitivität (0% Solar): wann kippt der EV-Vorteil? ===')
for (const grid of [0.25, 0.35, 0.45, 0.6]) {
  const g = { ...G, gridElectricityPricePerKwh: grid, pvSelfConsumptionShareForEv: 0 }
  const cmp = compareCars(OLD, TESLA, g, true)
  console.log(`Netzstrom ${grid.toFixed(2)} €/kWh → EV-Vorteil: ${eur(cmp.savingsAtHorizon).padStart(10)}`)
}
console.log('\nDone.')
