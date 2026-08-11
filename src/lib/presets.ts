import type { CarConfig } from './types'

export type PresetId = 'tesla-model-y' | 'bmw-x3-diesel' | 'bmw-x3-petrol' | 'custom'

export interface CarPreset {
  id: PresetId
  label: string
  description: string
  config: Omit<CarConfig, 'id' | 'label'>
}

/**
 * Richtwerte, keine Live-Preise. Grob orientiert an Preislisten/Verbrauchsangaben Stand 2025 –
 * bitte vor der Rechnung an eure tatsächlichen Angebote (Kaufpreis, Versicherung, Verbrauch) anpassen.
 */
export const CAR_PRESETS: CarPreset[] = [
  {
    id: 'tesla-model-y',
    label: 'Tesla Model Y (Heckantrieb)',
    description: 'BEV · WLTP-Verbrauch ca. 14,5 kWh/100km · kfz-steuerbefreit bis 2030/31',
    config: {
      type: 'bev',
      purchasePrice: 44990,
      subsidy: 0,
      downPayment: 0,
      loanInterestRatePercent: 6.5,
      loanTermYears: 6,
      insurancePerYear: 950,
      taxPerYear: 0,
      maintenancePerYear: 400,
      consumptionPer100km: 14.5,
      annualDepreciationPercent: 16,
    },
  },
  {
    id: 'bmw-x3-diesel',
    label: 'BMW X3 xDrive20d (Diesel)',
    description: 'Verbrenner · WLTP-Verbrauch ca. 6,0 l/100km',
    config: {
      type: 'ice',
      purchasePrice: 58000,
      subsidy: 0,
      downPayment: 0,
      loanInterestRatePercent: 6.5,
      loanTermYears: 6,
      insurancePerYear: 1100,
      taxPerYear: 250,
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
      purchasePrice: 55500,
      subsidy: 0,
      downPayment: 0,
      loanInterestRatePercent: 6.5,
      loanTermYears: 6,
      insurancePerYear: 1050,
      taxPerYear: 180,
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
      purchasePrice: 40000,
      subsidy: 0,
      downPayment: 0,
      loanInterestRatePercent: 6.5,
      loanTermYears: 6,
      insurancePerYear: 900,
      taxPerYear: 0,
      maintenancePerYear: 500,
      consumptionPer100km: 16,
      annualDepreciationPercent: 15,
    },
  },
]

export function getPreset(id: PresetId): CarPreset {
  return CAR_PRESETS.find((p) => p.id === id) ?? CAR_PRESETS[0]
}
