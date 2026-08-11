import type {
  CarConfig,
  CarResult,
  ComparisonResult,
  GeneralParams,
  OldCarConfig,
  YearBreakdown,
} from './types'

/** Zinsanteil pro Jahr einer Annuitätenfinanzierung, Index 0 = Jahr 1. */
export function amortizationInterestPerYear(
  principal: number,
  ratePercent: number,
  termYears: number,
): number[] {
  if (principal <= 0 || termYears <= 0) return []
  const r = ratePercent / 100
  const annualPayment =
    r === 0 ? principal / termYears : (principal * r) / (1 - (1 + r) ** -termYears)

  const interestPerYear: number[] = []
  let balance = principal
  for (let y = 0; y < termYears; y++) {
    const interest = balance * r
    const principalPortion = annualPayment - interest
    balance = Math.max(0, balance - principalPortion)
    interestPerYear.push(interest)
  }
  return interestPerYear
}

export function residualValue(
  value0: number,
  annualDepreciationPercent: number,
  years: number,
): number {
  if (value0 <= 0) return 0
  const rate = Math.max(0, Math.min(100, annualDepreciationPercent)) / 100
  return value0 * (1 - rate) ** years
}

function energyCostForYear(
  car: CarConfig,
  general: GeneralParams,
  inflationFactor: number,
): number {
  const kmFactor = general.annualKm / 100
  if (car.type === 'bev') {
    const needKwh = kmFactor * car.consumptionPer100km
    const pvShare = Math.max(0, Math.min(1, general.pvSelfConsumptionShareForEv))
    const pvKwh = needKwh * pvShare
    const gridKwh = needKwh - pvKwh
    return (
      (pvKwh * general.feedInTariffPerKwh + gridKwh * general.gridElectricityPricePerKwh) *
      inflationFactor
    )
  }
  const needLiters = kmFactor * car.consumptionPer100km
  return needLiters * general.fuelPricePerLiter * inflationFactor
}

/**
 * Berechnet Kaufnebenkosten (netto, sofort fällig) und Jahr-für-Jahr-Kosten für ein Fahrzeug.
 * @param tradeInValue Erlös aus dem Verkauf des Altfahrzeugs, der die Anschaffung mindert (nur beim Neuwagen relevant).
 * @param depreciationBasis Wert, auf dem die Restwert-Abschreibung basiert (Kaufpreis bei Neuwagen, aktueller Marktwert bei Bestandsfahrzeug).
 */
export function computeCarResult(
  car: CarConfig,
  general: GeneralParams,
  tradeInValue = 0,
  depreciationBasis = car.purchasePrice,
): CarResult {
  const financedAmount = Math.max(
    0,
    car.purchasePrice - car.subsidy - car.downPayment - tradeInValue,
  )
  const interestPerYear = amortizationInterestPerYear(
    financedAmount,
    car.loanInterestRatePercent,
    car.loanTermYears,
  )
  const netUpfrontCost = Math.max(0, car.purchasePrice - car.subsidy - tradeInValue)

  const inflation = general.costInflationPercent / 100
  const years: YearBreakdown[] = []
  const cumulative: number[] = [netUpfrontCost]

  for (let y = 1; y <= general.horizonYears; y++) {
    const inflationFactor = (1 + inflation) ** (y - 1)
    const insurance = car.insurancePerYear * inflationFactor
    const tax = car.taxPerYear * inflationFactor
    const maintenance = car.maintenancePerYear * inflationFactor
    const energy = energyCostForYear(car, general, inflationFactor)
    const financingInterest = interestPerYear[y - 1] ?? 0
    const ongoingTotal = insurance + tax + maintenance + energy + financingInterest

    years.push({ year: y, insurance, tax, maintenance, energy, financingInterest, ongoingTotal })
    cumulative.push(cumulative[cumulative.length - 1] + ongoingTotal)
  }

  const residualValueAtHorizon = residualValue(
    depreciationBasis,
    car.annualDepreciationPercent,
    general.horizonYears,
  )

  const totalCostAtHorizon =
    cumulative[cumulative.length - 1] - residualValueAtHorizon

  return { car, netUpfrontCost, years, cumulative, residualValueAtHorizon, totalCostAtHorizon }
}

/** Kumulierte Kosten je Jahr abzüglich des Restwerts, den man bei einem Verkauf in genau diesem Jahr erzielen würde. */
function netCumulativeByYear(
  cumulative: number[],
  depreciationBasis: number,
  annualDepreciationPercent: number,
): number[] {
  return cumulative.map((c, y) => c - residualValue(depreciationBasis, annualDepreciationPercent, y))
}

export function compareCars(
  oldCar: OldCarConfig,
  newCar: CarConfig,
  general: GeneralParams,
): ComparisonResult {
  // Pfad "Behalten": kein Kauf, kein Verkaufserlös vereinnahmt, Restwert bemisst sich am aktuellen Marktwert.
  const oldPath = computeCarResult(
    { ...oldCar, purchasePrice: 0, subsidy: 0, downPayment: 0, loanInterestRatePercent: 0 },
    general,
    0,
    oldCar.currentMarketValue,
  )

  // Pfad "Wechseln": Altfahrzeug wird jetzt verkauft (Erlös = aktueller Marktwert), mindert den Neupreis.
  const newPath = computeCarResult(newCar, general, oldCar.currentMarketValue)

  const oldCumulativeNet = netCumulativeByYear(
    oldPath.cumulative,
    oldCar.currentMarketValue,
    oldCar.annualDepreciationPercent,
  )
  const newCumulativeNet = netCumulativeByYear(
    newPath.cumulative,
    newCar.purchasePrice,
    newCar.annualDepreciationPercent,
  )

  let breakEvenYear: number | null = null
  for (let y = 1; y <= general.horizonYears; y++) {
    if (newCumulativeNet[y] <= oldCumulativeNet[y]) {
      breakEvenYear = y
      break
    }
  }

  const savingsAtHorizon =
    oldCumulativeNet[oldCumulativeNet.length - 1] - newCumulativeNet[newCumulativeNet.length - 1]

  return {
    old: oldPath,
    next: newPath,
    breakEvenYear,
    savingsAtHorizon,
    oldCumulativeNet,
    newCumulativeNet,
  }
}
