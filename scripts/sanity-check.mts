import { amortizationSchedule, compareCars, computeCarResult } from '../src/lib/calc'
import { estimatePvShareForEv, presenceFactor } from '../src/lib/vrm'
import { getPreset } from '../src/lib/presets'
import type { GeneralParams, OldCarConfig, PresenceProfile } from '../src/lib/types'

function eur(n: number) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
}

const BASE_GENERAL: GeneralParams = {
  horizonYears: 8,
  gridElectricityPricePerKwh: 0.32,
  feedInTariffPerKwh: 0.08,
  dieselPricePerLiter: 2.2,
  petrolPricePerLiter: 2.13,
  pvSelfConsumptionShareForEv: 0.5,
  costInflationPercent: 2.5,
  fuelCostInflationExtraPercent: 1,
  chargingLossPercent: 10,
  discountRatePercent: 0,
}

const BASE_OLD_CAR: OldCarConfig = {
  id: 'old', label: 'Alter Diesel', type: 'ice', fuelType: 'diesel', annualKm: 20000,
  financingType: 'cash', purchasePrice: 0, subsidy: 0, downPayment: 0, loanInterestRatePercent: 0,
  loanTermYears: 0, balloonPercent: 0, leaseMonthlyRate: 0, leaseSpecialPayment: 0, leaseTermYears: 0,
  insurancePerYear: 700, taxPerYear: 130, taxExemptionYears: 0, postExemptionTaxPerYear: 130,
  thgQuotePerYear: 0, wallboxCost: 0, maintenancePerYear: 650, consumptionPer100km: 6.5,
  annualDepreciationPercent: 12, currentMarketValue: 12000,
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
  const general = BASE_GENERAL
  const oldCar = BASE_OLD_CAR
  const teslaPreset = getPreset('tesla-model-y')
  const newCar = { id: 'new', label: teslaPreset.label, ...teslaPreset.config, annualKm: 20000 }

  console.log('\n--- Full comparison: 20.000 km/Jahr, 50% PV-Deckung, Kredit ---')
  const cmp = compareCars(oldCar, newCar, general, true)
  console.log('old net @horizon:', eur(cmp.oldCumulativeNet.at(-1)!))
  console.log('new net @horizon:', eur(cmp.newCumulativeNet.at(-1)!))
  console.log('breakEvenYear:', cmp.breakEvenYear)
  console.log('savingsAtHorizon:', eur(cmp.savingsAtHorizon))

  // Sanity: old car energy cost per year should equal 20000/100*6.5*2.2 = 2860 (+ maintenance/insurance/tax)
  const oldResult = computeCarResult({ ...oldCar, financingType: 'cash', purchasePrice: 0, subsidy: 0 }, general, 0, oldCar.currentMarketValue)
  console.log('old car year1 energy (expect 2860, no charging losses/CO2-extra for diesel except its own fuel-extra):', oldResult.years[0].energy.toFixed(0))

  // New car year1 energy: needKwh=20000/100*14.5=2900, *1.10 (10% charging loss)=3190. 50% PV @0.08 + 50% grid @0.32.
  const expectedEnergyY1 = (3190 * 0.5 * 0.08 + 3190 * 0.5 * 0.32)
  console.log(`new car year1 energy (expect ~${expectedEnergyY1.toFixed(0)}, incl. 10% Ladeverluste):`, oldResult && '')
  const newResult = computeCarResult(newCar, general, oldCar.currentMarketValue)
  console.log('  actual:', newResult.years[0].energy.toFixed(0))

  // THG income should reduce ongoingTotal
  console.log('new car year1 thgIncome (expect 200):', newResult.years[0].thgIncome.toFixed(0))
  console.log('new car upfrontCash includes wallbox (expect >= 1500 minus tradeIn logic, wallbox always added):', newResult.upfrontCash.toFixed(0))
}

// --- 5) Leasing vs Kredit vs Ballon vs Cash for same car -> compare total cost at horizon
{
  const general = { ...BASE_GENERAL, horizonYears: 6, pvSelfConsumptionShareForEv: 0.6 }
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

// --- 6) Tax exemption ends mid-horizon: tax should jump after taxExemptionYears
{
  const general = { ...BASE_GENERAL, horizonYears: 8 }
  const teslaPreset = getPreset('tesla-model-y')
  const car = { id: 'new', label: 'Tesla', ...teslaPreset.config, taxExemptionYears: 3, postExemptionTaxPerYear: 140 }
  const result = computeCarResult(car, general, 0)
  console.log('\n--- Tax exemption ends after year 3 ---')
  console.log('year3 tax (expect 0):', result.years[2].tax.toFixed(0))
  console.log('year4 tax (expect ~140+inflation):', result.years[3].tax.toFixed(0))
}

// --- 7) Discounting: with discountRatePercent > 0, net cost at a future year should be lower than nominal.
{
  const generalNominal = { ...BASE_GENERAL, horizonYears: 8 }
  const generalDiscounted = { ...BASE_GENERAL, horizonYears: 8, discountRatePercent: 5 }
  const teslaPreset = getPreset('tesla-model-y')
  const newCar = { id: 'new', label: teslaPreset.label, ...teslaPreset.config }
  const nominal = compareCars(BASE_OLD_CAR, newCar, generalNominal, true)
  const discounted = compareCars(BASE_OLD_CAR, newCar, generalDiscounted, true)
  console.log('\n--- Discounting sanity (5% Kalkulationszins) ---')
  console.log('nominal new net @horizon:', eur(nominal.newCumulativeNet.at(-1)!))
  console.log('discounted new net @horizon (expect lower, future outflows worth less today):', eur(discounted.newCumulativeNet.at(-1)!))
}

console.log('\nDone.')
