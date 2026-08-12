import type { CarConfig } from './types'

export type PresetId =
  | 'dacia-spring'
  | 'renault-5'
  | 'leapmotor-b05'
  | 'mg4'
  | 'skoda-elroq'
  | 'kia-ev3'
  | 'cupra-born'
  | 'vw-id3'
  | 'volvo-ex30'
  | 'tesla-model-3'
  | 'tesla-model-3-awd'
  | 'tesla-model-3-performance'
  | 'tesla-model-y'
  | 'tesla-model-y-lr-rwd'
  | 'tesla-model-y-lr-awd'
  | 'tesla-model-y-performance'
  | 'byd-seal-u'
  | 'vw-id4-pro'
  | 'hyundai-ioniq5'
  | 'xpeng-g6'
  | 'bmw-x3-diesel'
  | 'bmw-x3-petrol'
  | 'custom'

/** Grobe Klassifizierung für die Gruppierung im Auswahlmenü. */
export type PresetGroup = 'Kleinwagen (BEV)' | 'Kompaktklasse (BEV)' | 'Mittelklasse & SUV (BEV)' | 'Verbrenner' | 'Frei'

export interface CarPreset {
  id: PresetId
  label: string
  group: PresetGroup
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

/** Felder, die der Nutzer selbst kennen muss (Fahrleistung) bzw. beim Neuwagen 0 sind. */
const PERSONAL = {
  annualKm: NaN,
  ageYears: 0,
  odometerKm: 0,
  subsidy: 0,
}

interface BevInput {
  id: PresetId
  label: string
  group: PresetGroup
  description: string
  price: number
  consumption: number
  insurance: number
  maintenance: number
  depreciation: number
}

function bev(v: BevInput): CarPreset {
  return {
    id: v.id,
    label: v.label,
    group: v.group,
    description: v.description,
    config: {
      type: 'bev',
      fuelType: 'petrol',
      ...PERSONAL,
      ...COMMON_FINANCING,
      purchasePrice: v.price,
      insurancePerYear: v.insurance,
      ...BEV_TAX,
      ...BEV_EXTRAS,
      maintenancePerYear: v.maintenance,
      consumptionPer100km: v.consumption,
      annualDepreciationPercent: v.depreciation,
    },
  }
}

/**
 * Listenpreise und WLTP-Verbräuche recherchiert im August 2026 (Herstellerpreislisten,
 * EV Database ev-database.org, ADAC/Fachpresse). Versicherung und Wartung sind grobe
 * Klassen-Schätzungen. Alle Werte sind editierbar – Rabatte, Aktionen und regionale
 * Unterschiede gehören eingetragen; Preise ändern sich mehrmals im Jahr.
 */
export const CAR_PRESETS: CarPreset[] = [
  // --- Kleinwagen ---
  bev({
    id: 'dacia-spring', label: 'Dacia Spring', group: 'Kleinwagen (BEV)',
    description: 'BEV · 12,4 kWh/100km · günstigster Stromer · Listenpreis 2026: ab 16.900 €',
    price: 16900, consumption: 12.4, insurance: 550, maintenance: 300, depreciation: 17,
  }),
  bev({
    id: 'renault-5', label: 'Renault 5 E-Tech', group: 'Kleinwagen (BEV)',
    description: 'BEV · ca. 14,0 kWh/100km · Listenpreis 2026: ab 27.990 €',
    price: 27990, consumption: 14.0, insurance: 700, maintenance: 350, depreciation: 16,
  }),
  bev({
    id: 'leapmotor-b05', label: 'Leapmotor B05 (67 kWh)', group: 'Kleinwagen (BEV)',
    description: 'BEV · 15,9 kWh/100km · 218 PS · 482 km WLTP · Listenpreis 2026: ab 27.900 €',
    price: 31900, consumption: 15.9, insurance: 750, maintenance: 350, depreciation: 18,
  }),

  // --- Kompaktklasse ---
  bev({
    id: 'mg4', label: 'MG4 Electric', group: 'Kompaktklasse (BEV)',
    description: 'BEV · ca. 16,0 kWh/100km · Listenpreis 2026: ab 32.990 €',
    price: 32990, consumption: 16.0, insurance: 780, maintenance: 380, depreciation: 18,
  }),
  bev({
    id: 'skoda-elroq', label: 'Škoda Elroq', group: 'Kompaktklasse (BEV)',
    description: 'BEV · 15,2 kWh/100km · bis 580 km WLTP · Listenpreis 2026: ab 33.900 €',
    price: 33900, consumption: 15.2, insurance: 820, maintenance: 400, depreciation: 15,
  }),
  bev({
    id: 'kia-ev3', label: 'Kia EV3 (58 kWh)', group: 'Kompaktklasse (BEV)',
    description: 'BEV · 15,8 kWh/100km · 7 Jahre Garantie · Listenpreis 2026: ab 35.990 € (81 kWh: 41.390 €)',
    price: 35990, consumption: 15.8, insurance: 800, maintenance: 400, depreciation: 15,
  }),
  bev({
    id: 'cupra-born', label: 'Cupra Born', group: 'Kompaktklasse (BEV)',
    description: 'BEV · ca. 15,5 kWh/100km · Schwestermodell des ID.3 · Listenpreis 2026: ab 35.990 €',
    price: 35990, consumption: 15.5, insurance: 850, maintenance: 420, depreciation: 16,
  }),
  bev({
    id: 'vw-id3', label: 'VW ID.3 Pro (58 kWh)', group: 'Kompaktklasse (BEV)',
    description: 'BEV · ca. 15,0 kWh/100km · Listenpreis 2026: ab 38.000 €',
    price: 38000, consumption: 15.0, insurance: 830, maintenance: 420, depreciation: 16,
  }),
  bev({
    id: 'volvo-ex30', label: 'Volvo EX30 (Single Motor)', group: 'Kompaktklasse (BEV)',
    description: 'BEV · 17,0 kWh/100km · 51-kWh-Akku · Listenpreis 2026: ab 39.790 €',
    price: 39790, consumption: 17.0, insurance: 900, maintenance: 430, depreciation: 16,
  }),

  // --- Mittelklasse & SUV ---
  bev({
    id: 'tesla-model-3', label: 'Tesla Model 3 Premium RWD', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 13,0 kWh/100km · bis 750 km WLTP · Listenpreis 2026: ca. 36.590 € (Standard-Version günstiger)',
    price: 36590, consumption: 13.0, insurance: 900, maintenance: 380, depreciation: 16,
  }),
  bev({
    id: 'tesla-model-3-awd', label: 'Tesla Model 3 Premium AWD', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · ca. 14,5 kWh/100km · Allrad, 0–100 in 4,4 s · Listenpreis 2026: ca. 41.330 €',
    price: 41330, consumption: 14.5, insurance: 1000, maintenance: 420, depreciation: 16,
  }),
  bev({
    id: 'tesla-model-3-performance', label: 'Tesla Model 3 Performance', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 16,5 kWh/100km · 0–100 in 3,1 s · Listenpreis 2026: ca. 47.360 €',
    price: 47360, consumption: 16.5, insurance: 1200, maintenance: 500, depreciation: 17,
  }),
  bev({
    id: 'tesla-model-y', label: 'Tesla Model Y Standard (RWD)', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 13,1 kWh/100km · Basisversion (Juniper) · Listenpreis 2026: ab 39.990 €',
    price: 39990, consumption: 13.1, insurance: 950, maintenance: 400, depreciation: 16,
  }),
  bev({
    id: 'tesla-model-y-lr-rwd', label: 'Tesla Model Y Long Range RWD', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · ca. 13,9 kWh/100km · größte Reichweite der Baureihe · Listenpreis 2026: ab 46.990 €',
    price: 46990, consumption: 13.9, insurance: 1000, maintenance: 420, depreciation: 16,
  }),
  bev({
    id: 'tesla-model-y-lr-awd', label: 'Tesla Model Y Long Range AWD', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · ca. 14,9 kWh/100km · Allrad, Dual Motor · Listenpreis 2026: ab 52.990 €',
    price: 52990, consumption: 14.9, insurance: 1100, maintenance: 450, depreciation: 16,
  }),
  bev({
    id: 'byd-seal-u', label: 'BYD Seal U', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 19,9 kWh/100km · bis 500 km WLTP · Listenpreis 2026: ab 40.000 €',
    price: 40000, consumption: 19.9, insurance: 900, maintenance: 400, depreciation: 18,
  }),
  bev({
    id: 'hyundai-ioniq5', label: 'Hyundai Ioniq 5 (63 kWh RWD)', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 17,4 kWh/100km (EV Database) · Listenpreis 2026: ab 44.900 €',
    price: 44900, consumption: 17.4, insurance: 920, maintenance: 430, depreciation: 15,
  }),
  bev({
    id: 'vw-id4-pro', label: 'VW ID.4 Pro', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 16,4 kWh/100km (EV Database) · 77-kWh-Akku · Listenpreis 2026: ab 45.950 €',
    price: 45950, consumption: 16.4, insurance: 900, maintenance: 450, depreciation: 15,
  }),
  bev({
    id: 'xpeng-g6', label: 'XPeng G6 (Long Range)', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 17,9 kWh/100km · 800-V-Technik, 525 km WLTP · Listenpreis 2026: 47.600 €',
    price: 47600, consumption: 17.9, insurance: 950, maintenance: 420, depreciation: 18,
  }),
  bev({
    id: 'tesla-model-y-performance', label: 'Tesla Model Y Performance', group: 'Mittelklasse & SUV (BEV)',
    description: 'BEV · 16,2 kWh/100km · 460 PS AWD · Listenpreis 2026: 61.990 €',
    price: 61990, consumption: 16.2, insurance: 1250, maintenance: 520, depreciation: 17,
  }),

  // --- Verbrenner ---
  {
    id: 'bmw-x3-petrol',
    label: 'BMW X3 20 xDrive (Benzin)',
    group: 'Verbrenner',
    description: 'Verbrenner · ca. 7,6 l/100km · 208 PS · Listenpreis 08/2026: 59.400 €',
    config: {
      type: 'ice', fuelType: 'petrol', ...PERSONAL, ...COMMON_FINANCING,
      purchasePrice: 59400, insurancePerYear: 1050, taxPerYear: 180, ...ICE_TAX_EXTRAS,
      maintenancePerYear: 750, consumptionPer100km: 7.6, annualDepreciationPercent: 13,
    },
  },
  {
    id: 'bmw-x3-diesel',
    label: 'BMW X3 20d xDrive (Diesel)',
    group: 'Verbrenner',
    description: 'Verbrenner · ca. 6,0 l/100km · 197 PS · Listenpreis 08/2026: 62.800 €',
    config: {
      type: 'ice', fuelType: 'diesel', ...PERSONAL, ...COMMON_FINANCING,
      purchasePrice: 62800, insurancePerYear: 1100, taxPerYear: 250, ...ICE_TAX_EXTRAS,
      maintenancePerYear: 800, consumptionPer100km: 6.0, annualDepreciationPercent: 13,
    },
  },

  // --- Frei ---
  {
    id: 'custom',
    label: 'Custom Fahrzeug (alles selbst eintragen)',
    group: 'Frei',
    description: 'Alle Werte selbst eintragen – für Modelle, die nicht in der Liste stehen',
    config: {
      type: 'bev', fuelType: 'petrol', ...PERSONAL, ...COMMON_FINANCING,
      purchasePrice: NaN, insurancePerYear: NaN, ...BEV_TAX, ...BEV_EXTRAS,
      maintenancePerYear: NaN, consumptionPer100km: NaN, annualDepreciationPercent: 15,
    },
  },
]

/** Presets nach Gruppe, in der Reihenfolge, in der sie im Menü erscheinen sollen. */
export const PRESET_GROUPS: PresetGroup[] = [
  'Kleinwagen (BEV)',
  'Kompaktklasse (BEV)',
  'Mittelklasse & SUV (BEV)',
  'Verbrenner',
  'Frei',
]

export function getPreset(id: PresetId): CarPreset {
  return CAR_PRESETS.find((p) => p.id === id) ?? CAR_PRESETS[0]
}
