export type CarType = 'bev' | 'ice'
export type FuelType = 'diesel' | 'petrol'
export type FinancingType = 'cash' | 'loan' | 'balloon' | 'lease'

export interface CarConfig {
  id: string
  label: string
  type: CarType
  /** Nur relevant für type === 'ice'. */
  fuelType: FuelType
  /** Jährliche Fahrleistung DIESES Fahrzeugs. */
  annualKm: number

  financingType: FinancingType

  /** Kaufpreis / Neupreis. Bei Leasing nur Referenzwert, fließt nicht in die Kostenrechnung ein. */
  purchasePrice: number
  /** Förderung / Umweltbonus / THG-Quote-Erlös etc. */
  subsidy: number
  /** Anzahlung bei Kredit/Ballonfinanzierung. */
  downPayment: number
  /** Sollzins p.a. in % (Kredit/Ballon). */
  loanInterestRatePercent: number
  /** Laufzeit in Jahren (Kredit/Ballon). */
  loanTermYears: number
  /** Schlussrate bei Ballonfinanzierung, in % des Kaufpreises. */
  balloonPercent: number

  /** Monatliche Leasingrate. */
  leaseMonthlyRate: number
  /** Leasing-Sonderzahlung bei Vertragsbeginn. */
  leaseSpecialPayment: number
  /** Leasinglaufzeit in Jahren. */
  leaseTermYears: number

  insurancePerYear: number
  /** Kfz-Steuer pro Jahr. */
  taxPerYear: number
  maintenancePerYear: number
  /** kWh/100km bei BEV, l/100km bei ICE. */
  consumptionPer100km: number
  /** Jährliche Wertminderung in % (exponentiell) für die Restwert-Schätzung. Bei Leasing irrelevant (kein Eigentum). */
  annualDepreciationPercent: number
}

export interface OldCarConfig extends CarConfig {
  /** Aktueller Verkaufswert / Restwert des Bestandsfahrzeugs heute. */
  currentMarketValue: number
}

export interface GeneralParams {
  horizonYears: number
  gridElectricityPricePerKwh: number
  feedInTariffPerKwh: number
  dieselPricePerLiter: number
  petrolPricePerLiter: number
  /** Anteil der EV-Ladeenergie, der aus PV-Überschuss gedeckt werden kann (0..1) – berücksichtigt bereits das Anwesenheitsprofil. */
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
  /** Tatsächlich in diesem Jahr gezahlte Finanzierungskosten (Zins+Tilgung, Leasingrate oder Ballon-Schlussrate). */
  financingCash: number
  /** Davon Zinsanteil (nur informativ). */
  financingInterest: number
  ongoingTotal: number
}

export interface CarResult {
  car: CarConfig
  /** Sofort fällige Zahlung bei Vertragsbeginn (Anzahlung bzw. Leasing-Sonderzahlung). */
  upfrontCash: number
  years: YearBreakdown[]
  /** Rohe kumulierte Kassenausgänge je Jahr (Index 0 = Jahr 0), ohne Restwert-Abzug. */
  cumulative: number[]
  /** Noch offene Finanzierungsschuld je Jahr (0 bei Cash/Leasing bzw. nach Tilgung). */
  outstandingBalance: number[]
  residualValueAtHorizon: number
  totalCostAtHorizon: number
}

export interface ComparisonResult {
  old: CarResult
  next: CarResult
  breakEvenYear: number | null
  savingsAtHorizon: number
  /** Kumulierte Nettokosten (Kassenausgänge + offene Schuld − Restwert) je Jahr, Länge horizonYears+1. */
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

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** An welchen Wochentagen tagsüber (während der PV-Erzeugung) jemand zuhause ist und laden könnte. */
export type PresenceProfile = Record<Weekday, boolean>
