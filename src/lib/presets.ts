import type { CarConfig } from './types'

export type PresetId =
  | 'tesla-model-3'
  | 'tesla-model-3-performance'
  | 'tesla-model-y'
  | 'tesla-model-y-performance'
  | 'vw-id4-pro'
  | 'hyundai-ioniq5'
  | 'skoda-elroq'
  | 'leapmotor-b05'
  | 'xpeng-g6'
  | 'byd-seal-u'
  | 'bmw-x3-diesel'
  | 'bmw-x3-petrol'
  | 'custom'

export interface CarPreset {
  id: PresetId
  label: string
  description: string
  config: Omit<CarConfig, 'id' | 'label'>
}

/**
 * Finanzierungskonditionen bleiben LEER (NaN = Pflichtfeld): Zins, Laufzeit, Anzahlung und
 * Leasingraten hängen vom konkreten Angebot ab – z.B. bietet Tesla zeitweise 0% Finanzierung,
 * da wäre eine 7%-Vorgabe irreführend. Der Kaufpreis ist mit dem recherchierten Listenpreis
 * vorbelegt (Stand 2026) und bleibt editierbar, damit Rabatte/Aktionen eingetragen werden können.
 */
const COMMON_FINANCING = {
  financingType: 'loan' as const,
  downPayment: NaN,
  loanInterestRatePercent: NaN,
  loanTermYears: NaN,
  balloonPercent: NaN,
  leaseSpecialPayment: NaN,
  leaseTermYears: NaN,
  leaseMonthlyRate: NaN,
}

/** Nur für BEV relevant: aktuell gesetzlich befristete Kfz-Steuerbefreiung (Stand 2026: bis 2030/31). */
const BEV_TAX = {
  taxPerYear: 0,
  taxExemptionYears: 5,
  postExemptionTaxPerYear: 140,
}

const BEV_EXTRAS = {
  thgQuotePerYear: 200,
  wallboxCost: 1500,
}

const ICE_TAX_EXTRAS = {
  taxExemptionYears: 0,
  postExemptionTaxPerYear: 0,
  thgQuotePerYear: 0,
  wallboxCost: 0,
}

/** Felder, die jedes Fahrzeug-Preset gemeinsam hat und die der Nutzer selbst kennen muss. */
const PERSONAL = {
  annualKm: NaN,
  ageYears: 0,
  odometerKm: 0,
  subsidy: 0,
}

/**
 * Listenpreise und WLTP-Verbräuche recherchiert im August 2026 (Herstellerpreislisten,
 * EV Database, ADAC/Fachpresse). Versicherung ist eine grobe Klassen-Schätzung und sollte
 * durch ein echtes Angebot ersetzt werden. Alle Werte sind editierbar – Rabatte, Aktionen
 * und regionale Unterschiede gehören eingetragen.
 */
export const CAR_PRESETS: CarPreset[] = [
  {
    id: 'tesla-model-3',
    label: 'Tesla Model 3 Standard',
    description: 'BEV · 13,0 kWh/100km · Listenpreis 12/2025: 36.990 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 36990,
      insurancePerYear: 900,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 380,
      consumptionPer100km: 13.0,
      annualDepreciationPercent: 16,
    },
  },
  {
    id: 'tesla-model-3-performance',
    label: 'Tesla Model 3 Performance',
    description: 'BEV · 16,5 kWh/100km · 460+ PS AWD · Listenpreis 2026: 58.490 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 58490,
      insurancePerYear: 1200,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 500,
      consumptionPer100km: 16.5,
      annualDepreciationPercent: 17,
    },
  },
  {
    id: 'tesla-model-y',
    label: 'Tesla Model Y Standard',
    description: 'BEV · 13,1 kWh/100km · Listenpreis 10/2025: 39.990 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 39990,
      insurancePerYear: 950,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 400,
      consumptionPer100km: 13.1,
      annualDepreciationPercent: 16,
    },
  },
  {
    id: 'tesla-model-y-performance',
    label: 'Tesla Model Y Performance',
    description: 'BEV · 16,2 kWh/100km · 460 PS AWD · Listenpreis 2026: 61.990 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 61990,
      insurancePerYear: 1250,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 520,
      consumptionPer100km: 16.2,
      annualDepreciationPercent: 17,
    },
  },
  {
    id: 'leapmotor-b05',
    label: 'Leapmotor B05 (67 kWh)',
    description: 'BEV · 15,9 kWh/100km · 218 PS · 482 km WLTP · Listenpreis 2026: ab 27.900 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 31900,
      insurancePerYear: 750,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 350,
      consumptionPer100km: 15.9,
      annualDepreciationPercent: 18,
    },
  },
  {
    id: 'xpeng-g6',
    label: 'XPeng G6 (Long Range)',
    description: 'BEV · 17,9 kWh/100km · 800-V-Technik, 525 km WLTP · Listenpreis 2026: 47.600 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 47600,
      insurancePerYear: 950,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 420,
      consumptionPer100km: 17.9,
      annualDepreciationPercent: 18,
    },
  },
  {
    id: 'byd-seal-u',
    label: 'BYD Seal U',
    description: 'BEV · 19,9 kWh/100km · bis 500 km WLTP · Listenpreis 2026: ab 40.000 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 40000,
      insurancePerYear: 900,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 400,
      consumptionPer100km: 19.9,
      annualDepreciationPercent: 18,
    },
  },
  {
    id: 'skoda-elroq',
    label: 'Škoda Elroq',
    description: 'BEV · 15,2 kWh/100km · bis 580 km WLTP · Listenpreis 2026: ab 33.900 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 33900,
      insurancePerYear: 820,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 400,
      consumptionPer100km: 15.2,
      annualDepreciationPercent: 15,
    },
  },
  {
    id: 'vw-id4-pro',
    label: 'VW ID.4 Pro',
    description: 'BEV · 16,4 kWh/100km (EV Database) · 77-kWh-Akku · Listenpreis 2026: ab 45.950 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 45950,
      insurancePerYear: 900,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 450,
      consumptionPer100km: 16.4,
      annualDepreciationPercent: 15,
    },
  },
  {
    id: 'hyundai-ioniq5',
    label: 'Hyundai Ioniq 5 (63 kWh RWD)',
    description: 'BEV · 17,4 kWh/100km (EV Database) · Listenpreis 2026: ab 44.900 €',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 44900,
      insurancePerYear: 920,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 430,
      consumptionPer100km: 17.4,
      annualDepreciationPercent: 15,
    },
  },
  {
    id: 'bmw-x3-diesel',
    label: 'BMW X3 20d xDrive (Diesel)',
    description: 'Verbrenner · ca. 6,0 l/100km · 197 PS · Listenpreis 08/2026: 62.800 €',
    config: {
      type: 'ice',
      fuelType: 'diesel',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 62800,
      insurancePerYear: 1100,
      taxPerYear: 250,
      ...ICE_TAX_EXTRAS,
      maintenancePerYear: 800,
      consumptionPer100km: 6.0,
      annualDepreciationPercent: 13,
    },
  },
  {
    id: 'bmw-x3-petrol',
    label: 'BMW X3 20 xDrive (Benzin)',
    description: 'Verbrenner · ca. 7,6 l/100km · 208 PS · Listenpreis 08/2026: 59.400 €',
    config: {
      type: 'ice',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: 59400,
      insurancePerYear: 1050,
      taxPerYear: 180,
      ...ICE_TAX_EXTRAS,
      maintenancePerYear: 750,
      consumptionPer100km: 7.6,
      annualDepreciationPercent: 13,
    },
  },
  {
    id: 'custom',
    label: 'Custom Fahrzeug',
    description: 'Alle Werte selbst eintragen',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: NaN,
      insurancePerYear: NaN,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: NaN,
      consumptionPer100km: NaN,
      annualDepreciationPercent: 15,
    },
  },
]

export function getPreset(id: PresetId): CarPreset {
  return CAR_PRESETS.find((p) => p.id === id) ?? CAR_PRESETS[0]
}
