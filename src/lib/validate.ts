import type { CarConfig, ChargingSimConfig, GeneralParams, OldCarConfig, VrmPvData } from './types'

export type GeneralBase = Omit<GeneralParams, 'pvSelfConsumptionShareForEv'>

/** [Wert, Label] oder [Wert, Label, Mindestwert als ganze Zahl] – z.B. Laufzeiten in vollen Jahren. */
type Check = readonly [number, string] | readonly [number, string, number]

// NaN = leer → Label. Laufzeiten und Ladestunde steuern Schleifen und Array-Längen: 2,5 oder −1
// Jahre ließen die App abstürzen (new Array(2.5)) oder Kreditschulden ohne Zahlung verschwinden.
const missing = (checks: Check[]) =>
  checks.flatMap(([v, label, intMin]) =>
    Number.isNaN(v)
      ? [label]
      : !Number.isFinite(v) || (intMin != null && !(Number.isInteger(v) && v >= intMin))
        ? [`${label} (ungültig)`]
        : [],
  )

/**
 * Pflichtfeld-Prüfung je Wizard-Schritt: ohne echte Nutzerwerte kein Ergebnis (NaN = leer).
 * Geprüft wird jedes Feld, das in den gewählten Rechenpfad eingeht – auch vorbelegte, die der
 * Nutzer geleert hat, sonst landet NaN im Ergebnis.
 */
export function missingInputs(
  general: GeneralBase,
  oldCar: OldCarConfig,
  newCar: CarConfig,
  vrm: VrmPvData,
  charging: ChargingSimConfig,
): string[][] {
  const generalMissing = missing([
    [general.horizonYears, 'Betrachtungszeitraum', 1],
    [general.gridElectricityPricePerKwh, 'Strompreis'],
    [general.feedInTariffPerKwh, 'Einspeisevergütung'],
    [general.dieselPricePerLiter, 'Dieselpreis'],
    [general.petrolPricePerLiter, 'Benzinpreis'],
    [general.costInflationPercent, 'Kostensteigerung'],
    [general.fuelCostInflationExtraPercent, 'Zusatzsteigerung Kraftstoffe'],
    [general.chargingLossPercent, 'Ladeverluste'],
    [general.discountRatePercent, 'Kalkulationszins'],
    [general.uncertaintyPercent, 'Ergebnis-Unschärfe'],
  ])

  const bevFields = (car: CarConfig): Check[] =>
    car.type === 'bev'
      ? [
          [car.taxExemptionYears, 'Steuerbefreiung'],
          [car.postExemptionTaxPerYear, 'Kfz-Steuer nach Befreiung'],
          [car.thgQuotePerYear, 'THG-Quote'],
        ]
      : []

  const oldMissing = missing([
    [oldCar.annualKm, 'Jahresfahrleistung'],
    [oldCar.consumptionPer100km, 'Verbrauch'],
    [oldCar.ageYears, 'Fahrzeugalter'],
    [oldCar.odometerKm, 'km-Stand'],
    [oldCar.currentMarketValue, 'Marktwert'],
    [oldCar.insurancePerYear, 'Versicherung'],
    [oldCar.taxPerYear, 'Kfz-Steuer'],
    [oldCar.maintenancePerYear, 'Wartung'],
    [oldCar.annualDepreciationPercent, 'Wertminderung'],
    [oldCar.expectedLifetimeKm, 'Gesamt-Laufleistung'],
    [oldCar.replacementCost, 'Ersatzbeschaffung'],
    ...bevFields(oldCar),
  ])

  const isLease = newCar.financingType === 'lease'
  const newMissing = missing([
    [newCar.annualKm, 'Jahresfahrleistung'],
    [newCar.consumptionPer100km, 'Verbrauch'],
    [newCar.insurancePerYear, 'Versicherung'],
    [newCar.taxPerYear, 'Kfz-Steuer'],
    [newCar.maintenancePerYear, 'Wartung'],
    ...(isLease
      ? ([
          [newCar.leaseMonthlyRate, 'Leasingrate'],
          [newCar.leaseSpecialPayment, 'Sonderzahlung'],
          [newCar.leaseTermYears, 'Leasinglaufzeit', 1],
        ] as const)
      : ([
          [newCar.purchasePrice, 'Kaufpreis'],
          [newCar.subsidy, 'Förderung'],
          [newCar.annualDepreciationPercent, 'Wertminderung'],
        ] as const)),
    ...(newCar.financingType === 'loan' || newCar.financingType === 'balloon'
      ? ([
          [newCar.downPayment, 'Anzahlung'],
          [newCar.loanInterestRatePercent, 'Zinssatz'],
          [newCar.loanTermYears, 'Kreditlaufzeit', 1],
        ] as const)
      : []),
    ...(newCar.financingType === 'balloon'
      ? ([[newCar.balloonPercent, 'Schlussrate']] as const)
      : []),
    ...bevFields(newCar),
    ...(newCar.type === 'bev' ? ([[newCar.wallboxCost, 'Wallbox']] as const) : []),
  ])

  // PV-Simulation läuft für jedes BEV, auch ein elektrisches Bestandsfahrzeug.
  const pvMissing =
    newCar.type !== 'bev' && oldCar.type !== 'bev'
      ? []
      : missing([
          [vrm.annualYieldKwh, 'PV-Jahresertrag'],
          [vrm.annualHouseholdConsumptionKwh, 'Haushaltsverbrauch'],
          [charging.earliestChargeHour, 'Ladezeit', 0],
          [charging.batteryCapacityKwh, 'Speicher-kWh'],
          [charging.maxChargePowerKw, 'Ladeleistung'],
        ])

  return [generalMissing, oldMissing, newMissing, pvMissing]
}
