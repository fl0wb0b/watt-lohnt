export type CarType = 'bev' | 'ice'

export interface CarConfig {
  id: string
  label: string
  type: CarType
  /** Kaufpreis / Neupreis. 0 falls kein Kauf ansteht (z.B. Bestandsfahrzeug wird behalten). */
  purchasePrice: number
  /** Förderung / Umweltbonus / THG-Quote-Erlös etc. */
  subsidy: number
  /** Anzahlung bei Finanzierung. */
  downPayment: number
  /** Sollzins p.a. in %, 0 = Barkauf ohne Finanzierung. */
  loanInterestRatePercent: number
  /** Kreditlaufzeit in Jahren. */
  loanTermYears: number
  insurancePerYear: number
  /** Kfz-Steuer pro Jahr. */
  taxPerYear: number
  maintenancePerYear: number
  /** kWh/100km bei BEV, l/100km bei ICE. */
  consumptionPer100km: number
  /** Jährliche Wertminderung in % (exponentiell) für die Restwert-Schätzung. */
  annualDepreciationPercent: number
}

export interface OldCarConfig extends CarConfig {
  /** Aktueller Verkaufswert / Restwert des Bestandsfahrzeugs heute. */
  currentMarketValue: number
}

export interface GeneralParams {
  annualKm: number
  horizonYears: number
  gridElectricityPricePerKwh: number
  feedInTariffPerKwh: number
  fuelPricePerLiter: number
  /** Anteil der EV-Ladeenergie, der aus PV-Überschuss gedeckt werden kann (0..1). */
  pvSelfConsumptionShareForEv: number
  /** Jährliche Kostensteigerung (Strom, Sprit, Versicherung, Steuer, Wartung) in %. */
  costInflationPercent: number
}

export interface YearBreakdown {
  year: number
  insurance: number
  tax: number
  maintenance: number
  energy: number
  financingInterest: number
  ongoingTotal: number
}

export interface CarResult {
  car: CarConfig
  netUpfrontCost: number
  years: YearBreakdown[]
  cumulative: number[]
  residualValueAtHorizon: number
  totalCostAtHorizon: number
}

export interface ComparisonResult {
  old: CarResult
  next: CarResult
  breakEvenYear: number | null
  savingsAtHorizon: number
  /** Kumulierte Nettokosten (nach Restwert) je Jahr, Index 0 = Jahr 0 (Anschaffung), Länge horizonYears+1. */
  oldCumulativeNet: number[]
  newCumulativeNet: number[]
}

export interface VrmPvData {
  /** Jahresertrag PV in kWh. */
  annualYieldKwh: number
  /** Eigenverbrauchsanteil der PV-Erzeugung (0..1) – wie viel wird selbst genutzt statt eingespeist. */
  selfConsumptionShare: number
  /** Jahresverbrauch des Haushalts in kWh (ohne Auto). */
  annualHouseholdConsumptionKwh: number
  source: 'live' | 'manual'
}
