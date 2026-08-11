import { useMemo, useState } from 'react'
import { Car, Sun, Zap } from 'lucide-react'
import { CarForm } from './components/CarForm'
import { GeneralParamsForm } from './components/GeneralParamsForm'
import { ChargingPanel } from './components/ChargingPanel'
import { ResultsView } from './components/ResultsView'
import { Section, NumberField } from './components/fields'
import { VrmPanel } from './components/VrmPanel'
import { compareCars } from './lib/calc'
import { CAR_PRESETS, getPreset, type PresetId } from './lib/presets'
import { simulateSolarCharging } from './lib/simulate'
import type {
  CarConfig,
  ChargingSimConfig,
  GeneralParams,
  OldCarConfig,
  VrmPvData,
} from './lib/types'

type GeneralBase = Omit<GeneralParams, 'pvSelfConsumptionShareForEv'>

const initialGeneral: GeneralBase = {
  horizonYears: 8,
  gridElectricityPricePerKwh: 0.32,
  feedInTariffPerKwh: 0.08,
  dieselPricePerLiter: 2.2,
  petrolPricePerLiter: 2.13,
  costInflationPercent: 2.5,
  fuelCostInflationExtraPercent: 1,
  chargingLossPercent: 10,
  discountRatePercent: 0,
  uncertaintyPercent: 10,
}

const initialVrm: VrmPvData = {
  annualYieldKwh: 9000,
  selfConsumptionShare: 0.3,
  annualHouseholdConsumptionKwh: 4500,
  source: 'manual',
}

const initialCharging: ChargingSimConfig = {
  earliestChargeHour: 18,
  batteryCapacityKwh: 0,
  maxChargePowerKw: 11,
}

const initialOldCar: OldCarConfig = {
  id: 'old',
  label: 'Bestandsfahrzeug (behalten)',
  type: 'ice',
  fuelType: 'diesel',
  annualKm: 14000,
  ageYears: 8,
  odometerKm: 120000,
  financingType: 'cash',
  purchasePrice: 0,
  subsidy: 0,
  downPayment: 0,
  loanInterestRatePercent: 0,
  loanTermYears: 0,
  balloonPercent: 0,
  leaseMonthlyRate: 0,
  leaseSpecialPayment: 0,
  leaseTermYears: 0,
  insurancePerYear: 700,
  taxPerYear: 130,
  taxExemptionYears: 0,
  postExemptionTaxPerYear: 130,
  thgQuotePerYear: 0,
  wallboxCost: 0,
  maintenancePerYear: 650,
  consumptionPer100km: 6.5,
  annualDepreciationPercent: 12,
  currentMarketValue: 15000,
}

function App() {
  const [general, setGeneral] = useState<GeneralBase>(initialGeneral)
  const [vrm, setVrm] = useState<VrmPvData>(initialVrm)
  const [charging, setCharging] = useState<ChargingSimConfig>(initialCharging)
  const [oldCar, setOldCar] = useState<OldCarConfig>(initialOldCar)
  const [useTradeIn, setUseTradeIn] = useState(true)
  const [presetId, setPresetId] = useState<PresetId>('tesla-model-y')
  const [newCar, setNewCar] = useState<CarConfig>({
    id: 'new',
    label: getPreset('tesla-model-y').label,
    ...getPreset('tesla-model-y').config,
  })

  const handlePresetChange = (id: PresetId) => {
    setPresetId(id)
    const preset = getPreset(id)
    setNewCar({ id: 'new', label: preset.label, ...preset.config })
  }

  const evAnnualNeedKwh =
    newCar.type === 'bev' ? (newCar.annualKm / 100) * newCar.consumptionPer100km : 0

  const chargingSim = useMemo(
    () =>
      newCar.type === 'bev'
        ? simulateSolarCharging(vrm, evAnnualNeedKwh, general.chargingLossPercent, charging)
        : null,
    [vrm, evAnnualNeedKwh, general.chargingLossPercent, charging, newCar.type],
  )
  const pvSelfConsumptionShareForEv = chargingSim?.solarShare ?? 0

  const fullGeneral: GeneralParams = { ...general, pvSelfConsumptionShareForEv }

  const comparison = useMemo(
    () => compareCars(oldCar, newCar, fullGeneral, useTradeIn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oldCar, newCar, fullGeneral, useTradeIn],
  )

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
          <Zap className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Watt lohnt?
          </h1>
          <p className="text-sm text-slate-400">
            Lohnt sich das Elektroauto? Vergleich mit deinem Bestandsfahrzeug, unter
            Berücksichtigung deiner PV-Anlage.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Allgemeine Parameter" subtitle="Energiepreise, Betrachtungszeitraum, Kostensteigerung">
          <GeneralParamsForm value={general} onChange={setGeneral} />
        </Section>

        <Section
          title="PV-Anlage (Victron VRM) & Ladesimulation"
          subtitle="Bestimmt per Simulation, wie viel EV-Ladestrom aus eigener Solarproduktion kommt"
          right={<Sun className="size-5 text-amber-500" />}
        >
          <VrmPanel value={vrm} onChange={setVrm} />
          <div className="my-4 border-t border-slate-200 dark:border-slate-800" />
          <ChargingPanel
            value={charging}
            onChange={setCharging}
            result={chargingSim}
            isBev={newCar.type === 'bev'}
          />
        </Section>

        <Section
          title={oldCar.label}
          subtitle="Kosten, wenn das Fahrzeug behalten wird"
          right={<Car className="size-5 text-amber-500" />}
        >
          <div className="mb-3">
            <NumberField
              label="Aktueller Marktwert / Verkaufswert"
              value={oldCar.currentMarketValue}
              onChange={(v) => setOldCar({ ...oldCar, currentMarketValue: v })}
              suffix="€"
              step={100}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={useTradeIn}
                onChange={(e) => setUseTradeIn(e.target.checked)}
                className="size-3.5 rounded border-slate-300"
              />
              Bei Fahrzeugwechsel verkaufen und Erlös als Anzahlung/Sondertilgung fürs neue Auto nutzen
            </label>
          </div>
          <CarForm car={oldCar} onChange={(c) => setOldCar({ ...oldCar, ...c })} showPurchaseFields={false} />
        </Section>

        <Section
          title="Neues Fahrzeug"
          subtitle="Preset wählen oder komplett frei anpassen"
          right={<Zap className="size-5 text-sky-500" />}
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Preset</span>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={presetId}
                onChange={(e) => handlePresetChange(e.target.value as PresetId)}
              >
                {CAR_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Bezeichnung</span>
              <input
                type="text"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={newCar.label}
                onChange={(e) => setNewCar({ ...newCar, label: e.target.value })}
              />
            </label>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            {getPreset(presetId).description} · Richtwerte, bitte an eigenes Angebot anpassen.
          </p>
          <CarForm car={newCar} onChange={setNewCar} />
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Ergebnis" subtitle="Kumulierte Gesamtkosten im Vergleich">
          <ResultsView
            result={comparison}
            oldLabel={oldCar.label}
            newLabel={newCar.label}
            discountRatePercent={general.discountRatePercent}
            uncertaintyPercent={general.uncertaintyPercent}
          />
        </Section>
      </div>

      <footer className="mt-8 pb-4 text-center text-xs text-slate-400">
        Alle Berechnungen laufen lokal im Browser, es werden keine Daten an einen Server
        übertragen (außer beim optionalen VRM-Live-Abruf direkt an victronenergy.com).
      </footer>
    </div>
  )
}

export default App
