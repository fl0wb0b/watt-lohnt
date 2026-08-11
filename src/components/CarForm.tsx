import type { CarConfig, CarType, FinancingType, FuelType } from '../lib/types'
import { NumberField, SelectField } from './fields'

interface CarFormProps {
  car: CarConfig
  onChange: (car: CarConfig) => void
  /** Neuwagen: Kaufpreis/Finanzierung editierbar. Bestandsfahrzeug: nur laufende Kosten. */
  showPurchaseFields?: boolean
}

export function CarForm({ car, onChange, showPurchaseFields = true }: CarFormProps) {
  const set = <K extends keyof CarConfig>(key: K, value: CarConfig[K]) =>
    onChange({ ...car, [key]: value })

  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField<CarType>
        label="Antrieb"
        value={car.type}
        onChange={(v) => set('type', v)}
        options={[
          { value: 'bev', label: 'Elektro (BEV)' },
          { value: 'ice', label: 'Verbrenner' },
        ]}
      />
      {car.type === 'ice' ? (
        <SelectField<FuelType>
          label="Kraftstoff"
          value={car.fuelType}
          onChange={(v) => set('fuelType', v)}
          options={[
            { value: 'diesel', label: 'Diesel' },
            { value: 'petrol', label: 'Benzin' },
          ]}
        />
      ) : (
        <div />
      )}

      <NumberField
        label="Jahresfahrleistung"
        value={car.annualKm}
        onChange={(v) => set('annualKm', v)}
        suffix="km/Jahr"
        step={500}
      />
      <NumberField
        label="Verbrauch"
        value={car.consumptionPer100km}
        onChange={(v) => set('consumptionPer100km', v)}
        suffix={car.type === 'bev' ? 'kWh/100km' : 'l/100km'}
        step={0.1}
      />

      {showPurchaseFields && (
        <>
          <div className="col-span-2">
            <SelectField<FinancingType>
              label="Finanzierung"
              value={car.financingType}
              onChange={(v) => set('financingType', v)}
              options={[
                { value: 'cash', label: 'Barkauf' },
                { value: 'loan', label: 'Kauf auf Kredit' },
                { value: 'balloon', label: 'Kauf mit Ballonfinanzierung' },
                { value: 'lease', label: 'Leasing' },
              ]}
            />
          </div>

          {car.financingType === 'lease' ? (
            <>
              <NumberField
                label="Kaufpreis (Referenz)"
                value={car.purchasePrice}
                onChange={(v) => set('purchasePrice', v)}
                suffix="€"
                step={100}
                hint="Nur Referenz, fließt nicht in die Kostenrechnung ein"
              />
              <div />
              <NumberField
                label="Leasing-Sonderzahlung"
                value={car.leaseSpecialPayment}
                onChange={(v) => set('leaseSpecialPayment', v)}
                suffix="€"
                step={100}
              />
              <NumberField
                label="Monatliche Leasingrate"
                value={car.leaseMonthlyRate}
                onChange={(v) => set('leaseMonthlyRate', v)}
                suffix="€/Monat"
                step={10}
                hint="Preset-Rate ist nur ein Vorschlag – aktuelles Leasingangebot eintragen"
              />
              <NumberField
                label="Leasinglaufzeit"
                value={car.leaseTermYears}
                onChange={(v) => set('leaseTermYears', v)}
                suffix="Jahre"
                step={1}
                hint="Nach Ablauf: Annahme Weiterleasen zu ähnlichen Konditionen"
              />
            </>
          ) : (
            <>
              <NumberField
                label="Kaufpreis"
                value={car.purchasePrice}
                onChange={(v) => set('purchasePrice', v)}
                suffix="€"
                step={100}
                hint="Preset-Preis ist nur ein Vorschlag – Listenpreise ändern sich laufend, aktuellen Preis beim Hersteller/Händler prüfen"
              />
              <NumberField label="Förderung / Umweltbonus" value={car.subsidy} onChange={(v) => set('subsidy', v)} suffix="€" step={100} />
              {car.financingType !== 'cash' && (
                <>
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
                  {car.financingType === 'balloon' && (
                    <NumberField
                      label="Schlussrate (Ballon)"
                      value={car.balloonPercent}
                      onChange={(v) => set('balloonPercent', v)}
                      suffix="% vom Kaufpreis"
                      step={1}
                      max={90}
                      hint="Fällig am Ende der Laufzeit"
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <NumberField
        label="Wertminderung"
        value={car.annualDepreciationPercent}
        onChange={(v) => set('annualDepreciationPercent', v)}
        suffix="%/Jahr"
        step={1}
        hint={
          showPurchaseFields && car.financingType === 'lease'
            ? 'Bei Leasing ohne Wirkung – kein Eigentum, kein Restwert'
            : 'Exponentielle Abschreibung für Restwert-Schätzung'
        }
      />
      <NumberField label="Versicherung" value={car.insurancePerYear} onChange={(v) => set('insurancePerYear', v)} suffix="€/Jahr" step={10} />
      <NumberField
        label={car.type === 'bev' ? 'Kfz-Steuer (während Befreiung)' : 'Kfz-Steuer'}
        value={car.taxPerYear}
        onChange={(v) => set('taxPerYear', v)}
        suffix="€/Jahr"
        step={10}
        hint={car.type === 'bev' ? 'Aktuell gesetzlich 0 € für BEV' : undefined}
      />
      {car.type === 'bev' && (
        <>
          <NumberField
            label="Steuerbefreiung endet in"
            value={car.taxExemptionYears}
            onChange={(v) => set('taxExemptionYears', v)}
            suffix="Jahren"
            step={1}
            hint="Aktuell gesetzlich befristet bis 2030/31 – bei langem Betrachtungszeitraum relevant"
          />
          <NumberField
            label="Kfz-Steuer nach Befreiung"
            value={car.postExemptionTaxPerYear}
            onChange={(v) => set('postExemptionTaxPerYear', v)}
            suffix="€/Jahr"
            step={10}
            hint="Schätzwert – zukünftige Regelung noch nicht final bekannt"
          />
          <NumberField
            label="THG-Quoten-Erlös"
            value={car.thgQuotePerYear}
            onChange={(v) => set('thgQuotePerYear', v)}
            suffix="€/Jahr"
            step={10}
            hint="Richtwert ca. 100–350 €/Jahr, Anbieter & Marktpreis schwanken"
          />
          {showPurchaseFields && (
            <NumberField
              label="Wallbox (Anschaffung & Installation)"
              value={car.wallboxCost}
              onChange={(v) => set('wallboxCost', v)}
              suffix="€"
              step={50}
              hint="0, falls bereits vorhanden"
            />
          )}
        </>
      )}
      <NumberField
        label="Wartung & Reparaturen"
        value={car.maintenancePerYear}
        onChange={(v) => set('maintenancePerYear', v)}
        suffix="€/Jahr"
        step={10}
        hint={
          car.type === 'bev'
            ? 'Studien (u.a. ADAC-Kostenvergleiche) zeigen im Schnitt spürbar geringere Werkstattkosten bei BEV (keine Ölwechsel, weniger Verschleißteile, weniger Bremsverschleiß durch Rekuperation) – dafür oft etwas höherer Reifenverschleiß durch Gewicht/Drehmoment.'
            : undefined
        }
      />
    </div>
  )
}
