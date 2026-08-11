import type { CarConfig } from './types'

export type PresetId =
  | 'tesla-model-3'
  | 'tesla-model-3-performance'
  | 'tesla-model-y'
  | 'tesla-model-y-performance'
  | 'vw-id4-pro'
  | 'hyundai-ioniq5'
  | 'bmw-x3-diesel'
  | 'bmw-x3-petrol'
  | 'custom'

export interface CarPreset {
  id: PresetId
  label: string
  description: string
  config: Omit<CarConfig, 'id' | 'label'>
}

const COMMON_FINANCING = {
  financingType: 'loan' as const,
  downPayment: 0,
  loanInterestRatePercent: 7.0,
  loanTermYears: 6,
  balloonPercent: 35,
  leaseSpecialPayment: 3000,
  leaseTermYears: 4,
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

/**
 * Richtwerte, keine Live-Preise. Kaufpreise/Verbrauch grob orientiert an Preislisten und der
 * EV Database (ev-database.org) Stand 2025/26, Kraftstoffpreise an ADAC-Tagesdurchschnitten
 * Anfang August 2026 – bitte vor der Rechnung an eure tatsächlichen Angebote und tagesaktuellen
 * Preise anpassen (Sprit-/Strompreise schwanken kurzfristig spürbar).
 */
export const CAR_PRESETS: CarPreset[] = [
  {
    id: 'tesla-model-3',
    label: 'Tesla Model 3 (Standard, RWD)',
    description: 'BEV · WLTP-Verbrauch ca. 13,5 kWh/100km',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 39990,
      subsidy: 0,
      leaseMonthlyRate: 389,
      insurancePerYear: 900,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 380,
      consumptionPer100km: 13.5,
      annualDepreciationPercent: 16,
    },
  },
  {
    id: 'tesla-model-3-performance',
    label: 'Tesla Model 3 Performance',
    description: 'BEV · WLTP-Verbrauch ca. 16,5 kWh/100km · 460+ PS AWD',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 58490,
      subsidy: 0,
      leaseMonthlyRate: 579,
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
    label: 'Tesla Model Y (Standard, RWD)',
    description: 'BEV · WLTP-Verbrauch ca. 14,5 kWh/100km',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 44990,
      subsidy: 0,
      leaseMonthlyRate: 429,
      insurancePerYear: 950,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 400,
      consumptionPer100km: 14.5,
      annualDepreciationPercent: 16,
    },
  },
  {
    id: 'tesla-model-y-performance',
    label: 'Tesla Model Y Performance',
    description: 'BEV · WLTP-Verbrauch ca. 16,5 kWh/100km · 460 PS AWD',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 61990,
      subsidy: 0,
      leaseMonthlyRate: 619,
      insurancePerYear: 1250,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 520,
      consumptionPer100km: 16.5,
      annualDepreciationPercent: 17,
    },
  },
  {
    id: 'vw-id4-pro',
    label: 'VW ID.4 Pro',
    description: 'BEV · WLTP-Verbrauch ca. 16,4 kWh/100km (EV Database), 77-kWh-Akku',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 45950,
      subsidy: 0,
      leaseMonthlyRate: 419,
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
    description: 'BEV · WLTP-Verbrauch ca. 17,4 kWh/100km (EV Database)',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 44900,
      subsidy: 0,
      leaseMonthlyRate: 409,
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
    label: 'BMW X3 xDrive20d (Diesel)',
    description: 'Verbrenner · WLTP-Verbrauch ca. 6,0 l/100km',
    config: {
      type: 'ice',
      fuelType: 'diesel',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 58000,
      subsidy: 0,
      leaseMonthlyRate: 599,
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
    label: 'BMW X3 xDrive20i (Benzin)',
    description: 'Verbrenner · WLTP-Verbrauch ca. 7,6 l/100km',
    config: {
      type: 'ice',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 55500,
      subsidy: 0,
      leaseMonthlyRate: 569,
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
    description: 'Alle Werte frei editierbar',
    config: {
      type: 'bev',
      fuelType: 'petrol',
      annualKm: 14000,
      ...COMMON_FINANCING,
      purchasePrice: 40000,
      subsidy: 0,
      leaseMonthlyRate: 400,
      insurancePerYear: 900,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: 500,
      consumptionPer100km: 16,
      annualDepreciationPercent: 15,
    },
  },
]

export function getPreset(id: PresetId): CarPreset {
  return CAR_PRESETS.find((p) => p.id === id) ?? CAR_PRESETS[0]
}
