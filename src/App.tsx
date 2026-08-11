import { useMemo, useState } from 'react'
import { Car, Sun, Zap } from 'lucide-react'
import { CarForm } from './components/CarForm'
import { GeneralParamsForm } from './components/GeneralParamsForm'
import { BreakdownView } from './components/BreakdownView'
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

  const steps = [
    { id: 'general', label: 'Allgemein' },
    { id: 'old', label: 'Bestand' },
    { id: 'new', label: 'Wunschfahrzeug' },
    { id: 'pv', label: 'PV & Laden' },
    { id: 'result', label: 'Übersicht' },
  ] as const
  const [step, setStep] = useState(0)
  const isLast = step === steps.length - 1

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
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

      {/* Schritt-Navigation */}
      <nav className="mb-5 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              i === step
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-xs ${
                i === step
                  ? 'bg-sky-600 text-white'
                  : i < step
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>

      {step === 0 && (
        <Section title="Allgemeine Parameter" subtitle="Energiepreise, Betrachtungszeitraum, Kostensteigerung, Toleranz">
          <GeneralParamsForm value={general} onChange={setGeneral} />
        </Section>
      )}

      {step === 1 && (
        <Section
          title={oldCar.label}
          subtitle="Dein aktuelles Fahrzeug: Kosten, wenn du es behältst"
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
      )}

      {step === 2 && (
        <Section
          title="Wunschfahrzeug"
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

          {newCar.financingType === 'lease' && (
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Effektive Sofortkosten (Leasing)
              </p>
              <dl className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <dt>Leasing-Sonderzahlung</dt>
                  <dd className="tabular-nums">{newCar.leaseSpecialPayment.toLocaleString('de-DE')} €</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={useTradeIn}
                      onChange={(e) => setUseTradeIn(e.target.checked)}
                      className="size-3.5 rounded border-slate-300"
                    />
                    − Verkaufserlös Bestandsfahrzeug
                  </dt>
                  <dd
                    className={`tabular-nums ${useTradeIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 line-through'}`}
                  >
                    −{oldCar.currentMarketValue.toLocaleString('de-DE')} €
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                  <dt>Sofort fällig (negativ = Gutschrift in der Tasche)</dt>
                  <dd className="tabular-nums">
                    {(
                      newCar.leaseSpecialPayment - (useTradeIn ? oldCar.currentMarketValue : 0)
                    ).toLocaleString('de-DE')}{' '}
                    €
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {newCar.financingType !== 'lease' && (
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Effektive Anschaffungsrechnung
              </p>
              <dl className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <dt>Kaufpreis</dt>
                  <dd className="tabular-nums">{newCar.purchasePrice.toLocaleString('de-DE')} €</dd>
                </div>
                {newCar.subsidy > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <dt>− Förderung/Umweltbonus</dt>
                    <dd className="tabular-nums">−{newCar.subsidy.toLocaleString('de-DE')} €</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={useTradeIn}
                      onChange={(e) => setUseTradeIn(e.target.checked)}
                      className="size-3.5 rounded border-slate-300"
                    />
                    − Verkaufserlös Bestandsfahrzeug (Inzahlungnahme)
                  </dt>
                  <dd
                    className={`tabular-nums ${useTradeIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 line-through'}`}
                  >
                    −{oldCar.currentMarketValue.toLocaleString('de-DE')} €
                  </dd>
                </div>
                {newCar.financingType !== 'cash' && newCar.downPayment > 0 && (
                  <div className="flex justify-between">
                    <dt>− Anzahlung (aus Ersparnissen)</dt>
                    <dd className="tabular-nums">−{newCar.downPayment.toLocaleString('de-DE')} €</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                  <dt>{newCar.financingType === 'cash' ? 'Bar zu zahlen' : 'Zu finanzieren'}</dt>
                  <dd className="tabular-nums">
                    {Math.max(
                      0,
                      newCar.purchasePrice -
                        newCar.subsidy -
                        (useTradeIn ? oldCar.currentMarketValue : 0) -
                        (newCar.financingType === 'cash' ? 0 : newCar.downPayment),
                    ).toLocaleString('de-DE')}{' '}
                    €
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Section>
      )}

      {step === 3 && (
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
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <Section title="Ergebnis" subtitle="Kumulierte Gesamtkosten im Vergleich">
            <ResultsView
              result={comparison}
              oldLabel={oldCar.label}
              newLabel={newCar.label}
              discountRatePercent={general.discountRatePercent}
              uncertaintyPercent={general.uncertaintyPercent}
            />
          </Section>
          <Section
            title="Ehrliche Gesamtaufstellung"
            subtitle={`Jede Kostenposition über ${general.horizonYears} Jahre – nachrechenbar, keine versteckten Posten`}
          >
            <BreakdownView
              oldResult={comparison.old}
              newResult={comparison.next}
              oldLabel={oldCar.label}
              newLabel={newCar.label}
            />
          </Section>
        </div>
      )}

      {/* Zurück / Weiter */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:invisible dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ← Zurück
        </button>
        {!isLast && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500"
          >
            {step === steps.length - 2 ? 'Zur Übersicht →' : 'Weiter →'}
          </button>
        )}
      </div>

      <footer className="mt-8 flex flex-col items-center gap-1.5 pb-4 text-center text-xs text-slate-400">
        <p>
          Alle Berechnungen laufen lokal im Browser, es werden keine Daten an einen Server
          übertragen (außer beim optionalen VRM-Live-Abruf über den konfigurierten Proxy).
        </p>
        <a
          href="https://github.com/fl0wb0b"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-sky-500 dark:text-slate-400"
        >
          <Zap className="size-3.5" />
          powered by fl0wb0b
        </a>
      </footer>
    </div>
  )
}

export default App
