import { compareCars, computeCarResult } from '../src/lib/calc'
import { getPreset } from '../src/lib/presets'
import type { CarConfig, GeneralParams, OldCarConfig } from '../src/lib/types'

const eur = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'

const G: GeneralParams = {
  horizonYears: 8, gridElectricityPricePerKwh: 0.32, feedInTariffPerKwh: 0.08,
  dieselPricePerLiter: 2.2, petrolPricePerLiter: 2.13, pvSelfConsumptionShareForEv: 0.8,
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
  annualDepreciationPercent: 12, currentMarketValue: 15000,
}

const TESLA: CarConfig = { id: 'n', label: 'Tesla', ...getPreset('tesla-model-y').config }

for (const km of [120000, 420000]) {
  const old = { ...OLD, odometerKm: km }
  const r = computeCarResult({ ...old, financingType: 'cash' as const, purchasePrice: 0, subsidy: 0 }, G, 0, old.currentMarketValue)
  const maint = r.years.reduce((a, y) => a + y.maintenance, 0)
  const cmp = compareCars(old, TESLA, G, true)
  console.log(
    `km-Stand ${String(km).padStart(6)}: Wartung Jahr1 ${eur(r.years[0].maintenance)} | Wartung 8J gesamt ${eur(maint)} | Nettokosten Bestand ${eur(cmp.oldCumulativeNet.at(-1)!)} | EV-Vorteil ${eur(cmp.savingsAtHorizon)}`,
  )
}
