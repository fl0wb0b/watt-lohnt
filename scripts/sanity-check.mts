import { amortizationSchedule, compareCars, computeCarResult } from '../src/lib/calc'
import { estimatePvShareForEv, presenceFactor } from '../src/lib/vrm'
import { getPreset } from '../src/lib/presets'
import type { GeneralParams, OldCarConfig, PresenceProfile } from '../src/lib/types'

function eur(n: number) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
}

// --- 1) Amortization sanity: standard loan should reach 0 balance, balloon should reach balloonAmount.
{
  const std = amortizationSchedule(30000, 7, 6, 0)
  const balloon = amortizationSchedule(30000, 7, 6, 12000)
  console.log('--- Amortization ---')
  console.log('standard final balance (expect ~0):', std.balanceAfterYear.at(-1))
  console.log('balloon final balance (expect ~12000):', balloon.balanceAfterYear.at(-1))
  console.log(
    'balloon total interest > standard total interest (higher balance held longer):',
    balloon.interestPerYear.reduce((a, b) => a + b, 0) > std.interestPerYear.reduce((a, b) => a + b, 0),
  )
}

// --- 2) Presence factor sanity
{
  const weekendOnly: PresenceProfile = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true }
  const always: PresenceProfile = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
  console.log('\n--- Presence factor ---')
  console.log('weekend only (expect ~0.286):', presenceFactor(weekendOnly).toFixed(3))
  console.log('always home (expect 1):', presenceFactor(always).toFixed(3))
}

// --- 3) PV share for EV: big PV surplus, small EV need, always home -> should approach 100%
{
  const pv = { annualYieldKwh: 9000, selfConsumptionShare: 0.3, annualHouseholdConsumptionKwh: 4500, source: 'manual' as const }
  const always: PresenceProfile = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
  const weekend: PresenceProfile = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true }
  const officeOnly: PresenceProfile = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false }
  const evNeed = (14000 / 100) * 14.5 // Tesla Model Y-ish
  console.log('\n--- PV share for EV (evNeed=%d kWh) ---', evNeed.toFixed(0))
  console.log('always home:', (estimatePvShareForEv(pv, evNeed, always) * 100).toFixed(0) + '%')
  console.log('weekend only:', (estimatePvShareForEv(pv, evNeed, weekend) * 100).toFixed(0) + '%')
  console.log('office only (never home daytime):', (estimatePvShareForEv(pv, evNeed, officeOnly) * 100).toFixed(0) + '%')
}

// --- 4) Full comparison: realistic household, high annual mileage -> EV should win comfortably
{
  const general: GeneralParams = {
    horizonYears: 8,
    gridElectricityPricePerKwh: 0.32,
    feedInTariffPerKwh: 0.08,
    dieselPricePerLiter: 2.2,
    petrolPricePerLiter: 2.13,
    pvSelfConsumptionShareForEv: 0.5,
    costInflationPercent: 2.5,
  }
  const oldCar: OldCarConfig = {
    id: 'old', label: 'Alter Diesel', type: 'ice', fuelType: 'diesel', annualKm: 20000,
    financingType: 'cash', purchasePrice: 0, subsidy: 0, downPayment: 0, loanInterestRatePercent: 0,
    loanTermYears: 0, balloonPercent: 0, leaseMonthlyRate: 0, leaseSpecialPayment: 0, leaseTermYears: 0,
    insurancePerYear: 700, taxPerYear: 130, maintenancePerYear: 650, consumptionPer100km: 6.5,
    annualDepreciationPercent: 12, currentMarketValue: 12000,
  }
  const teslaPreset = getPreset('tesla-model-y')
  const newCar = { id: 'new', label: teslaPreset.label, ...teslaPreset.config, annualKm: 20000 }

  console.log('\n--- Full comparison: 20.000 km/Jahr, 50% PV-Deckung, Kredit ---')
  const cmp = compareCars(oldCar, newCar, general, true)
  console.log('old net @horizon:', eur(cmp.oldCumulativeNet.at(-1)!))
  console.log('new net @horizon:', eur(cmp.newCumulativeNet.at(-1)!))
  console.log('breakEvenYear:', cmp.breakEvenYear)
  console.log('savingsAtHorizon:', eur(cmp.savingsAtHorizon))
  console.log('year-by-year old:', cmp.oldCumulativeNet.map((v) => Math.round(v)))
  console.log('year-by-year new:', cmp.newCumulativeNet.map((v) => Math.round(v)))

  // Sanity: old car energy cost per year should equal 20000/100*6.5*2.2 = 2860 (+ maintenance/insurance/tax)
  const oldResult = computeCarResult({ ...oldCar, financingType: 'cash', purchasePrice: 0, subsidy: 0 }, general, 0, oldCar.currentMarketValue)
  console.log('\nold car year1 energy (expect 2860):', oldResult.years[0].energy.toFixed(0))
  console.log('old car year1 ongoingTotal (expect 2860+650+700+130=4340):', oldResult.years[0].ongoingTotal.toFixed(0))
}

// --- 5) Leasing vs Kredit vs Ballon vs Cash for same car -> compare total cost at horizon
{
  const general: GeneralParams = {
    horizonYears: 6,
    gridElectricityPricePerKwh: 0.32,
    feedInTariffPerKwh: 0.08,
    dieselPricePerLiter: 2.2,
    petrolPricePerLiter: 2.13,
    pvSelfConsumptionShareForEv: 0.6,
    costInflationPercent: 2.5,
  }
  const teslaPreset = getPreset('tesla-model-y')
  console.log('\n--- Financing comparison (6y horizon, Tesla Model Y) ---')
  for (const financingType of ['cash', 'loan', 'balloon', 'lease'] as const) {
    const car = { id: 'new', label: 'Tesla', ...teslaPreset.config, financingType }
    const result = computeCarResult(car, general, 0)
    const net = result.cumulative.at(-1)! + result.outstandingBalance.at(-1)! - result.residualValueAtHorizon
    console.log(
      financingType.padEnd(8),
      'upfront:', eur(result.upfrontCash).padStart(10),
      'cumulative(raw):', eur(result.cumulative.at(-1)!).padStart(12),
      'residual:', eur(result.residualValueAtHorizon).padStart(10),
      'net:', eur(net).padStart(12),
    )
  }
}

console.log('\nDone.')
