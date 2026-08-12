import { amortizationSchedule, compareCars, computeCarResult } from '../src/lib/calc'
import { simulateSolarCharging } from '../src/lib/simulate'
import { getPreset } from '../src/lib/presets'
import type { ChargingSimConfig, GeneralParams, OldCarConfig, VrmPvData } from '../src/lib/types'

const TESLA_FILL = {
  annualKm: 14000, purchasePrice: 44990, insurancePerYear: 950, downPayment: 0,
  loanInterestRatePercent: 7, loanTermYears: 6, balloonPercent: 35,
  leaseMonthlyRate: 429, leaseSpecialPayment: 3000, leaseTermYears: 4,
}

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
  uncertaintyPercent: 10,
}

const BASE_OLD_CAR: OldCarConfig = {
  id: 'old', label: 'Alter Diesel', type: 'ice', fuelType: 'diesel', annualKm: 20000,
  ageYears: 8, odometerKm: 120000,
  financingType: 'cash', purchasePrice: 0, subsidy: 0, downPayment: 0, loanInterestRatePercent: 0,
  loanTermYears: 0, balloonPercent: 0, leaseMonthlyRate: 0, leaseSpecialPayment: 0, leaseTermYears: 0,
  insurancePerYear: 700, taxPerYear: 130, taxExemptionYears: 0, postExemptionTaxPerYear: 130,
  thgQuotePerYear: 0, wallboxCost: 0, maintenancePerYear: 650, consumptionPer100km: 6.5,
  annualDepreciationPercent: 12, currentMarketValue: 12000, expectedLifetimeKm: 300000, replacementCost: 12000,
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

// --- 2+3) Charging simulation sanity: battery + charge time should move the solar share sensibly.
{
  const pv: VrmPvData = {
    annualYieldKwh: 24301, selfConsumptionShare: 0.38, annualHouseholdConsumptionKwh: 10329, source: 'manual',
  }
  const evNeed = (14000 / 100) * 14.5 // Tesla Model Y-ish
  const mk = (o: Partial<ChargingSimConfig>): ChargingSimConfig => ({
    earliestChargeHour: 18, batteryCapacityKwh: 0, maxChargePowerKw: 11, ...o,
  })
  console.log('\n--- Charging simulation (Kevins Anlage, evNeed=%d kWh) ---', evNeed.toFixed(0))
  for (const [label, cfg] of [
    ['abends 18h, kein Speicher', mk({ earliestChargeHour: 18, batteryCapacityKwh: 0 })],
    ['abends 18h, 10 kWh Speicher', mk({ earliestChargeHour: 18, batteryCapacityKwh: 10 })],
    ['ab 16h, 10 kWh Speicher', mk({ earliestChargeHour: 16, batteryCapacityKwh: 10 })],
    ['ab 11h (Homeoffice), kein Speicher', mk({ earliestChargeHour: 11, batteryCapacityKwh: 0 })],
    ['ab 16h, 30 kWh Speicher', mk({ earliestChargeHour: 16, batteryCapacityKwh: 30 })],
  ] as [string, ChargingSimConfig][]) {
    const r = simulateSolarCharging(pv, evNeed, 10, cfg)
    console.log(
      label.padEnd(38),
      'Solaranteil', (r.solarShare * 100).toFixed(0).padStart(3) + '%',
      '| PV', Math.round(r.fromPvDirectKwh), 'Batt', Math.round(r.fromBatteryKwh), 'Netz', Math.round(r.fromGridKwh),
    )
  }
}

// --- 3b) PV-Strom fließt wirklich in die Kosten ein: Solaranteil 0% vs 98% muss die Energiekosten drastisch ändern.
{
  const teslaPreset = getPreset('tesla-model-y')
  const car = { id: 'new', label: 'Tesla', ...teslaPreset.config, ...TESLA_FILL } // 14.000 km, 14,5 kWh/100km
  const needKwh = (car.annualKm / 100) * car.consumptionPer100km * 1.1 // inkl. 10% Ladeverluste
  const g0 = { ...BASE_GENERAL, pvSelfConsumptionShareForEv: 0 }
  const g98 = { ...BASE_GENERAL, pvSelfConsumptionShareForEv: 0.98 }
  const e0 = computeCarResult(car, g0, 0).years[0].energy
  const e98 = computeCarResult(car, g98, 0).years[0].energy
  const expected0 = needKwh * 0.32
  const expected98 = needKwh * (0.98 * 0.08 + 0.02 * 0.32)
  console.log('\n--- PV-Strom in der Kostenrechnung ---')
  console.log(`0%  Solar: ${e0.toFixed(0)} €/Jahr (erwartet ${expected0.toFixed(0)})`)
  console.log(`98% Solar: ${e98.toFixed(0)} €/Jahr (erwartet ${expected98.toFixed(0)})`)
  console.log('PV senkt die Ladekosten korrekt:', e98 < e0 * 0.4 ? 'JA' : 'NEIN!')
}

// --- 4) Full comparison: realistic household, high annual mileage -> EV should win comfortably
{
  const general = BASE_GENERAL
  const oldCar = BASE_OLD_CAR
  const teslaPreset = getPreset('tesla-model-y')
  const newCar = { id: 'new', label: teslaPreset.label, ...teslaPreset.config, ...TESLA_FILL, annualKm: 20000 }

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
    const car = { id: 'new', label: 'Tesla', ...teslaPreset.config, ...TESLA_FILL, financingType }
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
  const car = { id: 'new', label: 'Tesla', ...teslaPreset.config, ...TESLA_FILL, taxExemptionYears: 3, postExemptionTaxPerYear: 140 }
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
  const newCar = { id: 'new', label: teslaPreset.label, ...teslaPreset.config, ...TESLA_FILL }
  const nominal = compareCars(BASE_OLD_CAR, newCar, generalNominal, true)
  const discounted = compareCars(BASE_OLD_CAR, newCar, generalDiscounted, true)
  console.log('\n--- Discounting sanity (5% Kalkulationszins) ---')
  console.log('nominal new net @horizon:', eur(nominal.newCumulativeNet.at(-1)!))
  console.log('discounted new net @horizon (expect lower, future outflows worth less today):', eur(discounted.newCumulativeNet.at(-1)!))
}

console.log('\nDone.')
