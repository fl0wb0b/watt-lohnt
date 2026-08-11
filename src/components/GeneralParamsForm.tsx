import type { GeneralParams } from '../lib/types'
import { NumberField } from './fields'

type GeneralBase = Omit<GeneralParams, 'pvSelfConsumptionShareForEv'>

interface GeneralParamsFormProps {
  value: GeneralBase
  onChange: (value: GeneralBase) => void
}

const PRICE_STAND = '11.08.2026'

export function GeneralParamsForm({ value, onChange }: GeneralParamsFormProps) {
  const set = <K extends keyof GeneralBase>(key: K, v: GeneralBase[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Betrachtungszeitraum" value={value.horizonYears} onChange={(v) => set('horizonYears', v)} suffix="Jahre" step={1} max={20} />
      <NumberField
        label="Kostensteigerung p.a."
        value={value.costInflationPercent}
        onChange={(v) => set('costInflationPercent', v)}
        suffix="%/Jahr"
        step={0.5}
        hint="Auf Strom, Sprit, Versicherung, Steuer, Wartung"
      />

      <div className="col-span-2 -mb-1 mt-1 text-xs text-slate-400">
        Energiepreise – Richtwerte Stand {PRICE_STAND}. Strom- und Spritpreise schwanken
        kurzfristig spürbar, bitte vor der Rechnung den tagesaktuellen Preis eintragen (z.B.
        eigene Stromrechnung, ADAC/clever-tanken.de für Sprit).
      </div>
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
      <NumberField
        label="Dieselpreis"
        value={value.dieselPricePerLiter}
        onChange={(v) => set('dieselPricePerLiter', v)}
        suffix="€/l"
        step={0.01}
      />
      <NumberField
        label="Benzinpreis (Super E10)"
        value={value.petrolPricePerLiter}
        onChange={(v) => set('petrolPricePerLiter', v)}
        suffix="€/l"
        step={0.01}
      />
      <NumberField
        label="Ladeverluste"
        value={value.chargingLossPercent}
        onChange={(v) => set('chargingLossPercent', v)}
        suffix="%"
        step={1}
        hint="AC-Laden zuhause verliert real ca. 8–12% ggü. Fahrzeugverbrauch"
      />
      <NumberField
        label="Zusatzsteigerung fossile Kraftstoffe"
        value={value.fuelCostInflationExtraPercent}
        onChange={(v) => set('fuelCostInflationExtraPercent', v)}
        suffix="%/Jahr"
        step={0.5}
        hint="Oben auf die allgemeine Kostensteigerung, wegen CO2-Bepreisung/EU-ETS2"
      />

      <div className="col-span-2 -mb-1 mt-1 text-xs text-slate-400">
        Kapitalkosten (optional): berücksichtigt, dass eingesetztes Kapital sonst z.B. am
        Kapitalmarkt Rendite bringen könnte. 0% = einfache nominale Kostenrechnung (Standard).
      </div>
      <NumberField
        label="Kalkulationszins (Kapitalkosten)"
        value={value.discountRatePercent}
        onChange={(v) => set('discountRatePercent', v)}
        suffix="%/Jahr"
        step={0.5}
        hint="0% = wie bisher undiskontiert; >0% diskontiert alle Zahlungen auf den heutigen Wert"
      />
    </div>
  )
}
