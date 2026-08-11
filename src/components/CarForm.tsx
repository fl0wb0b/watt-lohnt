import type { CarConfig, CarType } from '../lib/types'
import { NumberField, SelectField } from './fields'

interface CarFormProps {
  car: CarConfig
  onChange: (car: CarConfig) => void
  showPurchaseFields?: boolean
}

export function CarForm({ car, onChange, showPurchaseFields = true }: CarFormProps) {
  const set = <K extends keyof CarConfig>(key: K, value: CarConfig[K]) =>
    onChange({ ...car, [key]: value })

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <SelectField<CarType>
          label="Antrieb"
          value={car.type}
          onChange={(v) => set('type', v)}
          options={[
            { value: 'bev', label: 'Elektro (BEV)' },
            { value: 'ice', label: 'Verbrenner' },
          ]}
        />
      </div>

      {showPurchaseFields && (
        <>
          <NumberField label="Kaufpreis" value={car.purchasePrice} onChange={(v) => set('purchasePrice', v)} suffix="€" step={100} />
          <NumberField label="Förderung / Umweltbonus" value={car.subsidy} onChange={(v) => set('subsidy', v)} suffix="€" step={100} />
          <NumberField label="Anzahlung" value={car.downPayment} onChange={(v) => set('downPayment', v)} suffix="€" step={100} />
          <NumberField
            label="Zinssatz Finanzierung"
            value={car.loanInterestRatePercent}
            onChange={(v) => set('loanInterestRatePercent', v)}
            suffix="% p.a."
            step={0.1}
          />
          <NumberField
            label="Kreditlaufzeit"
            value={car.loanTermYears}
            onChange={(v) => set('loanTermYears', v)}
            suffix="Jahre"
            step={1}
          />
        </>
      )}

      <NumberField
        label={car.type === 'bev' ? 'Verbrauch' : 'Verbrauch'}
        value={car.consumptionPer100km}
        onChange={(v) => set('consumptionPer100km', v)}
        suffix={car.type === 'bev' ? 'kWh/100km' : 'l/100km'}
        step={0.1}
      />
      <NumberField
        label="Wertminderung"
        value={car.annualDepreciationPercent}
        onChange={(v) => set('annualDepreciationPercent', v)}
        suffix="%/Jahr"
        step={1}
        hint="Exponentielle Abschreibung für Restwert-Schätzung"
      />
      <NumberField label="Versicherung" value={car.insurancePerYear} onChange={(v) => set('insurancePerYear', v)} suffix="€/Jahr" step={10} />
      <NumberField label="Kfz-Steuer" value={car.taxPerYear} onChange={(v) => set('taxPerYear', v)} suffix="€/Jahr" step={10} />
      <NumberField label="Wartung & Reparaturen" value={car.maintenancePerYear} onChange={(v) => set('maintenancePerYear', v)} suffix="€/Jahr" step={10} />
    </div>
  )
}
