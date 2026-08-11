import type { GeneralParams } from '../lib/types'
import { NumberField } from './fields'

type GeneralBase = Omit<GeneralParams, 'pvSelfConsumptionShareForEv'>

interface GeneralParamsFormProps {
  value: GeneralBase
  onChange: (value: GeneralBase) => void
}

export function GeneralParamsForm({ value, onChange }: GeneralParamsFormProps) {
  const set = <K extends keyof GeneralBase>(key: K, v: GeneralBase[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Jahresfahrleistung" value={value.annualKm} onChange={(v) => set('annualKm', v)} suffix="km/Jahr" step={500} />
      <NumberField label="Betrachtungszeitraum" value={value.horizonYears} onChange={(v) => set('horizonYears', v)} suffix="Jahre" step={1} max={20} />
      <NumberField
        label="Strompreis (Netzbezug)"
        value={value.gridElectricityPricePerKwh}
        onChange={(v) => set('gridElectricityPricePerKwh', v)}
        suffix="€/kWh"
        step={0.01}
      />
      <NumberField
        label="Einspeisevergütung"
        value={value.feedInTariffPerKwh}
        onChange={(v) => set('feedInTariffPerKwh', v)}
        suffix="€/kWh"
        step={0.01}
        hint="Opportunitätskosten für PV-Strom, der sonst eingespeist würde"
      />
      <NumberField label="Kraftstoffpreis" value={value.fuelPricePerLiter} onChange={(v) => set('fuelPricePerLiter', v)} suffix="€/l" step={0.01} />
      <NumberField
        label="Kostensteigerung p.a."
        value={value.costInflationPercent}
        onChange={(v) => set('costInflationPercent', v)}
        suffix="%/Jahr"
        step={0.5}
        hint="Auf Strom, Sprit, Versicherung, Steuer, Wartung"
      />
    </div>
  )
}
