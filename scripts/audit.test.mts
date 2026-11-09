// Regressionstests zu den Audit-Funden 11/2026. Ausführen: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareCars } from '../src/lib/calc'
import { getPreset } from '../src/lib/presets'
import { simulateSolarCharging } from '../src/lib/simulate'
import type { CarConfig, ChargingSimConfig, GeneralParams, OldCarConfig, VrmPvData } from '../src/lib/types'
import { missingInputs } from '../src/lib/validate'

const G: GeneralParams = {
  horizonYears: 8, gridElectricityPricePerKwh: 0.32, feedInTariffPerKwh: 0.08,
  dieselPricePerLiter: 2.2, petrolPricePerLiter: 2.13, pvSelfConsumptionShareForEv: 0.5,
  costInflationPercent: 2.5, fuelCostInflationExtraPercent: 1, chargingLossPercent: 10,
  discountRatePercent: 0, uncertaintyPercent: 10,
}

const OLD: OldCarConfig = {
  id: 'old', label: 'Alt', type: 'ice', fuelType: 'diesel', annualKm: 14000,
  ageYears: 8, odometerKm: 120000, financingType: 'cash', purchasePrice: 0, subsidy: 0,
  downPayment: 0, loanInterestRatePercent: 0, loanTermYears: 0, balloonPercent: 0,
  leaseMonthlyRate: 0, leaseSpecialPayment: 0, leaseTermYears: 0, insurancePerYear: 700,
  taxPerYear: 130, taxExemptionYears: 0, postExemptionTaxPerYear: 130, thgQuotePerYear: 0,
  wallboxCost: 0, maintenancePerYear: 650, consumptionPer100km: 6.5,
  annualDepreciationPercent: 12, currentMarketValue: 15000, expectedLifetimeKm: 300000, replacementCost: 12000,
}

const TESLA: CarConfig = {
  id: 'new', label: 'Tesla', ...getPreset('tesla-model-y').config,
  annualKm: 14000, purchasePrice: 44990, insurancePerYear: 950, downPayment: 0,
  loanInterestRatePercent: 7, loanTermYears: 6, balloonPercent: 35,
  leaseMonthlyRate: 429, leaseSpecialPayment: 3000, leaseTermYears: 4,
}

const PV: VrmPvData = { annualYieldKwh: 8000, selfConsumptionShare: 0.3, annualHouseholdConsumptionKwh: 4000, source: 'manual' }
const CHARGING: ChargingSimConfig = { earliestChargeHour: 16, batteryCapacityKwh: 0, maxChargePowerKw: 11 }
const { pvSelfConsumptionShareForEv: _unused, ...GENERAL_BASE } = G

const delivered = (r: ReturnType<typeof simulateSolarCharging>) =>
  r.fromPvDirectKwh + r.fromBatteryKwh + r.fromGridKwh

test('Ladesimulation: ganzer Jahresbedarf wird verbucht, auch ohne Haushaltslast', () => {
  const r = simulateSolarCharging({ ...PV, annualYieldKwh: 1000, annualHouseholdConsumptionKwh: 0 }, 10000, 0, { ...CHARGING, earliestChargeHour: 18 })
  assert.ok(Math.abs(delivered(r) - r.carAnnualKwh) < 1, `verbucht ${delivered(r)} von ${r.carAnnualKwh} kWh`)
  assert.ok(r.solarShare < 0.2, `Solaranteil ${r.solarShare}`)
})

test('Ladesimulation: zu kurzes Ladefenster → Rest kommt aus dem Netz', () => {
  const r = simulateSolarCharging(PV, 6000, 0, { ...CHARGING, earliestChargeHour: 6, maxChargePowerKw: 1 })
  assert.ok(Math.abs(delivered(r) - r.carAnnualKwh) < 1, `verbucht ${delivered(r)} von ${r.carAnnualKwh} kWh`)
})

test('Pflichtfelder: gebrochener oder negativer Betrachtungszeitraum ist ungültig', () => {
  for (const horizonYears of [2.5, -1, 0]) {
    const [general] = missingInputs({ ...GENERAL_BASE, horizonYears }, OLD, TESLA, PV, CHARGING)
    assert.ok(general.some((l) => l.startsWith('Betrachtungszeitraum')), `horizon ${horizonYears}: ${general}`)
  }
})

test('Pflichtfelder: Kreditlaufzeit 0 oder gebrochen ist ungültig', () => {
  for (const loanTermYears of [0, 2.5]) {
    for (const financingType of ['loan', 'balloon'] as const) {
      const [, , next] = missingInputs(GENERAL_BASE, OLD, { ...TESLA, financingType, loanTermYears }, PV, CHARGING)
      assert.ok(next.some((l) => l.startsWith('Kreditlaufzeit')), `${financingType} ${loanTermYears}: ${next}`)
    }
  }
})

test('Pflichtfelder: geleerte Rechenfelder blockieren das Ergebnis', () => {
  const ice: CarConfig = { ...TESLA, type: 'ice', fuelType: 'petrol', financingType: 'cash' }
  const [, oldM, next] = missingInputs(GENERAL_BASE, { ...OLD, annualDepreciationPercent: NaN }, { ...ice, maintenancePerYear: NaN, subsidy: NaN }, PV, CHARGING)
  assert.ok(oldM.includes('Wertminderung'), `alt: ${oldM}`)
  assert.ok(next.includes('Wartung') && next.includes('Förderung'), `neu: ${next}`)
  const [general] = missingInputs({ ...GENERAL_BASE, costInflationPercent: NaN }, OLD, TESLA, PV, CHARGING)
  assert.ok(general.includes('Kostensteigerung'), `allgemein: ${general}`)
  const [, , bev] = missingInputs(GENERAL_BASE, OLD, { ...TESLA, wallboxCost: NaN, thgQuotePerYear: NaN }, PV, CHARGING)
  assert.ok(bev.includes('Wallbox') && bev.includes('THG-Quote'), `bev: ${bev}`)
})

test('Pflichtfelder: Ladezeit muss eine volle Stunde sein', () => {
  const [, , , pv] = missingInputs(GENERAL_BASE, OLD, TESLA, PV, { ...CHARGING, earliestChargeHour: 18.5 })
  assert.ok(pv.some((l) => l.startsWith('Ladezeit')), `pv: ${pv}`)
})

test('Pflichtfelder: PV-Angaben auch nötig, wenn nur das Bestandsfahrzeug ein BEV ist', () => {
  const [, , , pv] = missingInputs(GENERAL_BASE, { ...OLD, type: 'bev' }, { ...TESLA, type: 'ice' }, { ...PV, annualYieldKwh: NaN }, CHARGING)
  assert.ok(pv.includes('PV-Jahresertrag'), `pv: ${pv}`)
})

test('Lebensdauer: Ersatz im Jahr, in dem die Grenze überschritten wird', () => {
  // 250.000 km + 3 × 14.000 = 292.000 km zu Beginn von Jahr 4 → 300.000 km fallen in Jahr 4
  const cmp = compareCars({ ...OLD, odometerKm: 250000 }, TESLA, G, true)
  assert.equal(cmp.old.endOfLifeYear, 4)
  // schon drüber → Jahr 1; genau auf der Grenze zum Jahresende → Folgejahr
  assert.equal(compareCars({ ...OLD, odometerKm: 350000 }, TESLA, G, true).old.endOfLifeYear, 1)
  assert.equal(compareCars({ ...OLD, odometerKm: 286000 }, TESLA, G, true).old.endOfLifeYear, 2)
})

test('Break-even: schon heute günstiger → Jahr 0', () => {
  // Förderung (3.000 €) > Wallbox (1.500 €): der Wechsel ist ab Jahr 0 im Vorteil
  const cmp = compareCars(OLD, { ...TESLA, financingType: 'cash', subsidy: 3000, wallboxCost: 1500 }, { ...G, horizonYears: 1 }, true)
  assert.ok(cmp.newCumulativeNet[0] <= cmp.oldCumulativeNet[0])
  assert.equal(cmp.breakEvenYear, 0)
})

test('Bestands-BEV bekommt einen eigenen PV-Anteil', () => {
  const oldBev: OldCarConfig = { ...OLD, type: 'bev', consumptionPer100km: 18 }
  const ice: CarConfig = { ...TESLA, type: 'ice', fuelType: 'petrol', consumptionPer100km: 7 }
  const withoutPv = compareCars(oldBev, ice, { ...G, pvSelfConsumptionShareForEv: 0 }, true)
  const withPv = compareCars(oldBev, ice, { ...G, pvSelfConsumptionShareForEv: 0 }, true, 0.6)
  assert.ok(withPv.old.years[0].energy < withoutPv.old.years[0].energy, 'PV-Anteil des alten BEV wird ignoriert')
})
