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
        required
        placeholder="deine echten km, z.B. 14.000"
      />
      {!showPurchaseFields && (
        <>
          <NumberField
            label="Fahrzeugalter"
            value={car.ageYears}
            onChange={(v) => set('ageYears', v)}
            suffix="Jahre"
            step={1}
            required
            placeholder="z.B. 8"
            hint="Ab ~6 Jahren steigende Reparaturkosten"
          />
          <NumberField
            label="Aktueller km-Stand"
            value={car.odometerKm}
            onChange={(v) => set('odometerKm', v)}
            suffix="km"
            step={5000}
            required
            placeholder="vom Tacho ablesen"
            hint="Ab ~100.000 km steigende Verschleißkosten"
          />
        </>
      )}
      <NumberField
        label="Verbrauch"
        value={car.consumptionPer100km}
        onChange={(v) => set('consumptionPer100km', v)}
        suffix={car.type === 'bev' ? 'kWh/100km' : 'l/100km'}
        step={0.1}
        required
        placeholder={car.type === 'bev' ? 'z.B. 15' : 'dein realer Verbrauch'}
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
                required
                placeholder="aus deinem Angebot"
              />
              <NumberField
                label="Monatliche Leasingrate"
                value={car.leaseMonthlyRate}
                onChange={(v) => set('leaseMonthlyRate', v)}
                suffix="€/Monat"
                step={10}
                required
                placeholder="aus deinem Angebot"
              />
              <NumberField
                label="Leasinglaufzeit"
                value={car.leaseTermYears}
                onChange={(v) => set('leaseTermYears', v)}
                suffix="Jahre"
                step={1}
                required
                placeholder="z.B. 4"
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
                required
                placeholder="dein Angebotspreis"
                hint="Aktuellen Preis aus deinem Angebot/Konfigurator eintragen – Listenpreis des Presets steht oben als Anhalt"
              />
              <NumberField
                label="Förderung / Umweltbonus"
                value={car.subsidy}
                onChange={(v) => set('subsidy', v)}
                suffix="€"
                step={100}
                hint={
                  car.type === 'bev'
                    ? 'E-Auto-Prämie 2026: 1.500–6.000 € je nach zu versteuerndem Haushaltseinkommen (max. 80.000 €, +5.000 € je Kind), zzgl. 500 € pro Kind. Nur Privatpersonen – eigenen Anspruch prüfen.'
                    : undefined
                }
              />
              {car.financingType !== 'cash' && (
                <>
                  <NumberField label="Anzahlung" value={car.downPayment} onChange={(v) => set('downPayment', v)} suffix="€" step={100} required placeholder="z.B. 0" />
                  <NumberField
                    label="Zinssatz Finanzierung"
                    value={car.loanInterestRatePercent}
                    onChange={(v) => set('loanInterestRatePercent', v)}
                    suffix="% p.a."
                    step={0.1}
                    required
                    placeholder="aus DEINEM Angebot"
                    hint="Hersteller-Aktionen beachten – z.B. bietet Tesla zeitweise 0%!"
                  />
                  <NumberField
                    label="Kreditlaufzeit"
                    value={car.loanTermYears}
                    onChange={(v) => set('loanTermYears', v)}
                    suffix="Jahre"
                    step={1}
                    required
                    placeholder="z.B. 6"
                  />
                  {car.financingType === 'balloon' && (
                    <NumberField
                      label="Schlussrate (Ballon)"
                      value={car.balloonPercent}
                      onChange={(v) => set('balloonPercent', v)}
                      suffix="% vom Kaufpreis"
                      step={1}
                      max={90}
                      required
                      placeholder="aus deinem Angebot"
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
      <NumberField label="Versicherung" value={car.insurancePerYear} onChange={(v) => set('insurancePerYear', v)} suffix="€/Jahr" step={10} required placeholder="dein Beitrag" hint="Vollkasko-Jahresbeitrag – ggf. Angebot einholen" />
      <NumberField
        label={car.type === 'bev' ? 'Kfz-Steuer (während Befreiung)' : 'Kfz-Steuer'}
        value={car.taxPerYear}
        onChange={(v) => set('taxPerYear', v)}
        suffix="€/Jahr"
        step={10}
        required
        placeholder={car.type === 'bev' ? '0' : 'siehe Steuerbescheid'}
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
        required
        placeholder="Durchschnitt der letzten Jahre"
        hint={
          car.type === 'bev'
            ? 'Studien (u.a. ADAC-Kostenvergleiche) zeigen im Schnitt spürbar geringere Werkstattkosten bei BEV (keine Ölwechsel, weniger Verschleißteile, weniger Bremsverschleiß durch Rekuperation) – dafür oft etwas höherer Reifenverschleiß durch Gewicht/Drehmoment.'
            : undefined
        }
      />
    </div>
  )
}
