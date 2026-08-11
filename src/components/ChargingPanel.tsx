import type { ChargingSimConfig, ChargingSimResult } from '../lib/types'
import { NumberField } from './fields'

interface ChargingPanelProps {
  value: ChargingSimConfig
  onChange: (value: ChargingSimConfig) => void
  result: ChargingSimResult | null
  isBev: boolean
}

const kwh = (n: number) => Math.round(n).toLocaleString('de-DE') + ' kWh'

export function ChargingPanel({ value, onChange, result, isBev }: ChargingPanelProps) {
  const set = <K extends keyof ChargingSimConfig>(key: K, v: ChargingSimConfig[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Ladeverhalten &amp; Heimspeicher
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Früheste Ladezeit"
          value={value.earliestChargeHour}
          onChange={(v) => set('earliestChargeHour', Math.max(0, Math.min(23, v)))}
          suffix="Uhr"
          step={1}
          min={0}
          max={23}
          hint="Ab wann steckt das Auto (bis morgens)"
        />
        <NumberField
          label="Ladeleistung"
          value={value.maxChargePowerKw}
          onChange={(v) => set('maxChargePowerKw', v)}
          suffix="kW"
          step={0.5}
          hint="Wallbox/Onboard-Lader, z.B. 11"
        />
        <NumberField
          label="Heimspeicher-Kapazität"
          value={value.batteryCapacityKwh}
          onChange={(v) => set('batteryCapacityKwh', v)}
          suffix="kWh"
          step={0.5}
          hint="0 = kein Speicher. Puffert Mittags-Überschuss in die Ladezeit"
        />
      </div>

      {isBev && result && result.carAnnualKwh > 0 ? (
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <p className="mb-1">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Simulierter Solaranteil der Ladung: {Math.round(result.solarShare * 100)}%
            </span>{' '}
            (stündliche Jahressimulation)
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Ladebedarf {kwh(result.carAnnualKwh)}/Jahr → davon direkt PV {kwh(result.fromPvDirectKwh)},
            aus Speicher {kwh(result.fromBatteryKwh)}, aus Netz {kwh(result.fromGridKwh)}. Der
            Netzanteil wird zum Strompreis (Netzbezug) berechnet, der Solaranteil zu den
            Opportunitätskosten (Einspeisevergütung).
          </p>
        </div>
      ) : (
        <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          {isBev
            ? 'PV-Daten eingeben (oben), dann wird der Solaranteil simuliert.'
            : 'Neues Fahrzeug ist kein BEV – die Ladesimulation wird nicht genutzt.'}
        </p>
      )}

      <p className="text-xs text-slate-400">
        Statt zu raten wird der Solaranteil über eine stündliche Jahres-Energieflusssimulation
        bestimmt: PV deckt zuerst das Haus, Überschuss lädt Auto bzw. Speicher, bei Bedarf liefert
        der Speicher abends – mit deiner tatsächlichen Speichergröße und Ladezeit. Die
        PV-/Lastprofile sind aus den Jahreswerten modelliert (Richtwert, keine exakte Messung).
      </p>
    </div>
  )
}
