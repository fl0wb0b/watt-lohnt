import type {
  CarConfig,
  CarResult,
  ComparisonResult,
  GeneralParams,
  OldCarConfig,
  YearBreakdown,
} from './types'

interface AmortizationSchedule {
  interestPerYear: number[]
  principalPerYear: number[]
  balanceAfterYear: number[]
}

/**
 * Annuitätentilgung mit optionaler Schlussrate (Ballonfinanzierung, balloonAmount = 0 → normaler Kredit).
 * Die Rate wird so berechnet, dass die Restschuld nach termYears exakt balloonAmount beträgt.
 */
export function amortizationSchedule(
  financedAmount: number,
  ratePercent: number,
  termYears: number,
  balloonAmount = 0,
): AmortizationSchedule {
  if (financedAmount <= 0 || termYears <= 0) {
    return { interestPerYear: [], principalPerYear: [], balanceAfterYear: [] }
  }
  const r = ratePercent / 100
  // Schlussrate darf nicht größer als der finanzierte Betrag sein, sonst negative Tilgung.
  const balloon = Math.min(Math.max(0, balloonAmount), financedAmount * 0.95)

  let payment: number
  if (r === 0) {
    payment = (financedAmount - balloon) / termYears
  } else {
    const growth = (1 + r) ** termYears
    payment = ((financedAmount * growth - balloon) * r) / (growth - 1)
  }
  payment = Math.max(0, payment)

  const interestPerYear: number[] = []
  const principalPerYear: number[] = []
  const balanceAfterYear: number[] = []
  let balance = financedAmount
  for (let y = 0; y < termYears; y++) {
    const interest = balance * r
    const principal = Math.min(balance, payment - interest)
    balance = Math.max(0, balance - principal)
    interestPerYear.push(interest)
    principalPerYear.push(principal)
    balanceAfterYear.push(balance)
  }
  return { interestPerYear, principalPerYear, balanceAfterYear }
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

function fuelPricePerLiter(car: CarConfig, general: GeneralParams): number {
  return car.fuelType === 'diesel' ? general.dieselPricePerLiter : general.petrolPricePerLiter
}

function energyCostForYear(
  car: CarConfig,
  general: GeneralParams,
  inflationFactor: number,
): number {
  const kmFactor = car.annualKm / 100
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
  return needLiters * fuelPricePerLiter(car, general) * inflationFactor
}

/**
 * Simuliert ein Fahrzeug über den Betrachtungszeitraum: tatsächliche Kassenzahlungen je Jahr
 * (Anzahlung/Sonderzahlung, laufende Kosten, Kredit-/Leasingraten, ggf. Ballon-Schlussrate) sowie
 * die daraus resultierende Nettoposition (Kassenausgänge + offene Finanzierungsschuld − Restwert).
 *
 * @param tradeInValue Erlös aus dem Verkauf des Altfahrzeugs, der die Finanzierung mindert (nur beim Neuwagen relevant).
 * @param depreciationBasis Wert, auf dem die Restwert-Abschreibung basiert (Kaufpreis bei Neuwagen, aktueller Marktwert bei Bestandsfahrzeug). Bei Leasing wird kein Restwert gutgeschrieben.
 */
export function computeCarResult(
  car: CarConfig,
  general: GeneralParams,
  tradeInValue = 0,
  depreciationBasis = car.purchasePrice,
): CarResult {
  const inflation = general.costInflationPercent / 100
  const horizon = general.horizonYears

  let upfrontCash = 0
  let financingCashPerYear: number[] = []
  let financingInterestPerYear: number[] = []
  let outstandingBalancePerYear: number[] = []
  let effectiveDepreciationBasis = depreciationBasis

  if (car.financingType === 'lease') {
    upfrontCash = car.leaseSpecialPayment
    effectiveDepreciationBasis = 0 // kein Eigentum, kein Restwert
    for (let y = 1; y <= horizon; y++) {
      const withinTerm = y <= car.leaseTermYears
      const inflationFactor = withinTerm ? 1 : (1 + inflation) ** (y - car.leaseTermYears)
      financingCashPerYear.push(car.leaseMonthlyRate * 12 * inflationFactor)
      financingInterestPerYear.push(0)
      outstandingBalancePerYear.push(0)
    }
  } else if (car.financingType === 'cash') {
    upfrontCash = Math.max(0, car.purchasePrice - car.subsidy - tradeInValue)
    financingCashPerYear = new Array(horizon).fill(0)
    financingInterestPerYear = new Array(horizon).fill(0)
    outstandingBalancePerYear = new Array(horizon).fill(0)
  } else {
    // loan oder balloon
    const financedAmount = Math.max(
      0,
      car.purchasePrice - car.subsidy - car.downPayment - tradeInValue,
    )
    const balloonAmount =
      car.financingType === 'balloon' ? (car.balloonPercent / 100) * car.purchasePrice : 0
    const schedule = amortizationSchedule(
      financedAmount,
      car.loanInterestRatePercent,
      car.loanTermYears,
      balloonAmount,
    )
    upfrontCash = car.downPayment

    for (let y = 1; y <= horizon; y++) {
      if (y <= car.loanTermYears && y <= schedule.interestPerYear.length) {
        const idx = y - 1
        let cash = schedule.interestPerYear[idx] + schedule.principalPerYear[idx]
        let outstanding = schedule.balanceAfterYear[idx]
        if (car.financingType === 'balloon' && y === car.loanTermYears) {
          cash += outstanding // Schlussrate wird bei letzter Regelrate fällig
          outstanding = 0
        }
        financingCashPerYear.push(cash)
        financingInterestPerYear.push(schedule.interestPerYear[idx])
        outstandingBalancePerYear.push(outstanding)
      } else {
        financingCashPerYear.push(0)
        financingInterestPerYear.push(0)
        outstandingBalancePerYear.push(0)
      }
    }
  }

  const years: YearBreakdown[] = []
  const cumulative: number[] = [upfrontCash]
  const outstandingBalance: number[] = [0]

  for (let y = 1; y <= horizon; y++) {
    const inflationFactor = (1 + inflation) ** (y - 1)
    const insurance = car.insurancePerYear * inflationFactor
    const tax = car.taxPerYear * inflationFactor
    const maintenance = car.maintenancePerYear * inflationFactor
    const energy = energyCostForYear(car, general, inflationFactor)
    const financingCash = financingCashPerYear[y - 1] ?? 0
    const financingInterest = financingInterestPerYear[y - 1] ?? 0
    const ongoingTotal = insurance + tax + maintenance + energy + financingCash

    years.push({ year: y, insurance, tax, maintenance, energy, financingCash, financingInterest, ongoingTotal })
    cumulative.push(cumulative[cumulative.length - 1] + ongoingTotal)
    outstandingBalance.push(outstandingBalancePerYear[y - 1] ?? 0)
  }

  const residualValueAtHorizon = residualValue(
    effectiveDepreciationBasis,
    car.annualDepreciationPercent,
    horizon,
  )
  const totalCostAtHorizon =
    cumulative[cumulative.length - 1] +
    outstandingBalance[outstandingBalance.length - 1] -
    residualValueAtHorizon

  return {
    car,
    upfrontCash,
    years,
    cumulative,
    outstandingBalance,
    residualValueAtHorizon,
    totalCostAtHorizon,
  }
}

/** Nettoposition je Jahr: Kassenausgänge + offene Finanzierungsschuld − erzielbarer Restwert, wenn in genau diesem Jahr verkauft/abgelöst würde. */
function netCumulativeByYear(result: CarResult, depreciationBasis: number): number[] {
  const isLease = result.car.financingType === 'lease'
  return result.cumulative.map((c, y) => {
    const resale = isLease ? 0 : residualValue(depreciationBasis, result.car.annualDepreciationPercent, y)
    return c + result.outstandingBalance[y] - resale
  })
}

export function compareCars(
  oldCar: OldCarConfig,
  newCar: CarConfig,
  general: GeneralParams,
  /** Verkaufserlös des Altfahrzeugs als Anzahlung/Sondertilgung für den Neuwagen verwenden? */
  useTradeIn = true,
): ComparisonResult {
  // Pfad "Behalten": kein Kauf, kein Verkaufserlös vereinnahmt, Restwert bemisst sich am aktuellen Marktwert.
  const oldPath = computeCarResult(
    { ...oldCar, financingType: 'cash', purchasePrice: 0, subsidy: 0 },
    general,
    0,
    oldCar.currentMarketValue,
  )

  // Pfad "Wechseln": Altfahrzeug wird jetzt verkauft, Erlös mindert optional die Finanzierung des Neuwagens.
  const tradeInValue = useTradeIn ? oldCar.currentMarketValue : 0
  const newPath = computeCarResult(newCar, general, tradeInValue)

  const oldCumulativeNet = netCumulativeByYear(oldPath, oldCar.currentMarketValue)
  const newCumulativeNet = netCumulativeByYear(newPath, newCar.purchasePrice)

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
