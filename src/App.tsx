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
import { CAR_PRESETS, PRESET_GROUPS, getPreset, type PresetId } from './lib/presets'
import { simulateSolarCharging } from './lib/simulate'
import type {
  CarConfig,
  ChargingSimConfig,
  GeneralParams,
  OldCarConfig,
  VrmPvData,
} from './lib/types'

type GeneralBase = Omit<GeneralParams, 'pvSelfConsumptionShareForEv'>

// Persönliche/Markt-Werte starten LEER (NaN): Nutzer müssen ihre echten Zahlen eintragen,
// sonst geht es nicht weiter – ein Ergebnis aus Beispielwerten wäre keine echte Entscheidung.
// Modell-Parameter (Inflation, Ladeverluste, Toleranz, …) behalten sinnvolle Defaults.
const initialGeneral: GeneralBase = {
  horizonYears: NaN,
  gridElectricityPricePerKwh: NaN,
  feedInTariffPerKwh: NaN,
  dieselPricePerLiter: NaN,
  petrolPricePerLiter: NaN,
  costInflationPercent: 2.5,
  fuelCostInflationExtraPercent: 1,
  chargingLossPercent: 10,
  discountRatePercent: 0,
  uncertaintyPercent: 10,
}

const initialVrm: VrmPvData = {
  annualYieldKwh: NaN,
  selfConsumptionShare: NaN,
  annualHouseholdConsumptionKwh: NaN,
  source: 'manual',
}

const initialCharging: ChargingSimConfig = {
  earliestChargeHour: NaN,
  batteryCapacityKwh: NaN,
  maxChargePowerKw: 11,
}

const initialOldCar: OldCarConfig = {
  id: 'old',
  label: 'Bestandsfahrzeug (behalten)',
  type: 'ice',
  fuelType: 'diesel',
  annualKm: NaN,
  ageYears: NaN,
  odometerKm: NaN,
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
  insurancePerYear: NaN,
  taxPerYear: NaN,
  taxExemptionYears: 0,
  postExemptionTaxPerYear: 0,
  thgQuotePerYear: 0,
  wallboxCost: 0,
  maintenancePerYear: NaN,
  consumptionPer100km: NaN,
  annualDepreciationPercent: 12,
  currentMarketValue: NaN,
  expectedLifetimeKm: NaN,
  replacementCost: NaN,
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

  // --- Pflichtfeld-Prüfung: ohne echte Nutzerwerte kein Ergebnis (NaN = leer). ---
  const filled = (...vals: number[]) => vals.every((v) => !Number.isNaN(v))

  const generalMissing = [
    [general.horizonYears, 'Betrachtungszeitraum'],
    [general.gridElectricityPricePerKwh, 'Strompreis'],
    [general.feedInTariffPerKwh, 'Einspeisevergütung'],
    [general.dieselPricePerLiter, 'Dieselpreis'],
    [general.petrolPricePerLiter, 'Benzinpreis'],
  ].filter(([v]) => Number.isNaN(v as number)).map(([, l]) => l as string)

  const oldMissing = [
    [oldCar.annualKm, 'Jahresfahrleistung'],
    [oldCar.consumptionPer100km, 'Verbrauch'],
    [oldCar.ageYears, 'Fahrzeugalter'],
    [oldCar.odometerKm, 'km-Stand'],
    [oldCar.currentMarketValue, 'Marktwert'],
    [oldCar.insurancePerYear, 'Versicherung'],
    [oldCar.taxPerYear, 'Kfz-Steuer'],
    [oldCar.maintenancePerYear, 'Wartung'],
    [oldCar.expectedLifetimeKm, 'Gesamt-Laufleistung'],
    [oldCar.replacementCost, 'Ersatzbeschaffung'],
  ].filter(([v]) => Number.isNaN(v as number)).map(([, l]) => l as string)

  const isLease = newCar.financingType === 'lease'
  const newMissing = [
    [newCar.annualKm, 'Jahresfahrleistung'],
    [newCar.consumptionPer100km, 'Verbrauch'],
    [newCar.insurancePerYear, 'Versicherung'],
    ...(isLease
      ? ([
          [newCar.leaseMonthlyRate, 'Leasingrate'],
          [newCar.leaseSpecialPayment, 'Sonderzahlung'],
          [newCar.leaseTermYears, 'Leasinglaufzeit'],
        ] as const)
      : ([[newCar.purchasePrice, 'Kaufpreis']] as const)),
    ...(newCar.financingType === 'loan' || newCar.financingType === 'balloon'
      ? ([
          [newCar.downPayment, 'Anzahlung'],
          [newCar.loanInterestRatePercent, 'Zinssatz'],
          [newCar.loanTermYears, 'Kreditlaufzeit'],
        ] as const)
      : []),
    ...(newCar.financingType === 'balloon'
      ? ([[newCar.balloonPercent, 'Schlussrate']] as const)
      : []),
    ...(newCar.type === 'bev' ? ([[newCar.maintenancePerYear, 'Wartung']] as const) : []),
  ].filter(([v]) => Number.isNaN(v as number)).map(([, l]) => l as string)

  const pvMissing =
    newCar.type !== 'bev'
      ? []
      : [
          [vrm.annualYieldKwh, 'PV-Jahresertrag'],
          [vrm.annualHouseholdConsumptionKwh, 'Haushaltsverbrauch'],
          [charging.earliestChargeHour, 'Ladezeit'],
          [charging.batteryCapacityKwh, 'Speicher-kWh'],
          [charging.maxChargePowerKw, 'Ladeleistung'],
        ].filter(([v]) => Number.isNaN(v as number)).map(([, l]) => l as string)

  const missingByStep = [generalMissing, oldMissing, newMissing, pvMissing]
  const allComplete = missingByStep.every((m) => m.length === 0)

  const evAnnualNeedKwh =
    newCar.type === 'bev' ? (newCar.annualKm / 100) * newCar.consumptionPer100km : 0

  const chargingSim = useMemo(
    () =>
      newCar.type === 'bev' && filled(vrm.annualYieldKwh, vrm.annualHouseholdConsumptionKwh, evAnnualNeedKwh, charging.earliestChargeHour, charging.batteryCapacityKwh, charging.maxChargePowerKw)
        ? simulateSolarCharging(vrm, evAnnualNeedKwh, general.chargingLossPercent, charging)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vrm, evAnnualNeedKwh, general.chargingLossPercent, charging, newCar.type],
  )
  const pvSelfConsumptionShareForEv = chargingSim?.solarShare ?? 0

  const fullGeneral: GeneralParams = { ...general, pvSelfConsumptionShareForEv }

  const comparison = useMemo(
    () => (allComplete ? compareCars(oldCar, newCar, fullGeneral, useTradeIn) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oldCar, newCar, fullGeneral, useTradeIn, allComplete],
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
          <span className="powered-by">
            <span className="powered-by__text">powered by fL0wb0b</span>
          </span>
        </div>
      </header>

      {/* Schritt-Navigation: grüner Haken erst, wenn alle Pflichtfelder des Schritts ausgefüllt sind */}
      <nav className="mb-5 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800">
        {steps.map((s, i) => {
          const complete = i < 4 ? missingByStep[i].length === 0 : allComplete
          return (
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
                  complete
                    ? 'bg-emerald-500 text-white'
                    : i === step
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {complete ? '✓' : i + 1}
              </span>
              {s.label}
              {i < 4 && missingByStep[i].length > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  {missingByStep[i].length}
                </span>
              )}
            </button>
          )
        })}
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
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField
              label="Aktueller Marktwert / Verkaufswert"
              value={oldCar.currentMarketValue}
              onChange={(v) => setOldCar({ ...oldCar, currentMarketValue: v })}
              suffix="€"
              step={100}
              required
              placeholder="z.B. Schwacke/mobile.de prüfen"
            />
            <NumberField
              label="Lebensdauer des Fahrzeugs"
              value={oldCar.expectedLifetimeKm}
              onChange={(v) => setOldCar({ ...oldCar, expectedLifetimeKm: v })}
              suffix="km gesamt"
              step={10000}
              required
              placeholder="Diesel typ. 300.000–400.000"
              hint="Tacho-Endstand, bei dem das Auto wirtschaftlich am Ende ist (NICHT pro Jahr) – danach wird der Ersatzkauf eingerechnet"
            />
            <NumberField
              label="Ersatzbeschaffung bei Ausfall"
              value={oldCar.replacementCost}
              onChange={(v) => setOldCar({ ...oldCar, replacementCost: v })}
              suffix="€"
              step={500}
              required
              placeholder="Preis gleichwertiger Gebrauchter"
              hint="Gleichwertiger Gebrauchter (halbe Lebensdauer, ~6 Jahre)"
            />
          </div>
          <div className="mb-3">
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
                {PRESET_GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {CAR_PRESETS.filter((p) => p.group === g).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
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

          {newCar.financingType === 'lease' && filled(newCar.leaseSpecialPayment, oldCar.currentMarketValue) && (
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

          {newCar.financingType !== 'lease' &&
            filled(
              newCar.purchasePrice,
              oldCar.currentMarketValue,
              newCar.financingType === 'cash' ? 0 : newCar.downPayment,
            ) && (
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

      {step === 4 && !comparison && (
        <Section
          title="Noch nicht bereit"
          subtitle="Das Ergebnis wird erst berechnet, wenn alle Pflichtfelder mit deinen echten Werten gefüllt sind"
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ein Ergebnis aus Beispielwerten wäre keine Entscheidungsgrundlage. Diese Angaben
              fehlen noch:
            </p>
            {missingByStep.map((missing, i) =>
              missing.length === 0 ? null : (
                <div
                  key={steps[i].id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
                >
                  <div>
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      {steps[i].label}:
                    </span>{' '}
                    <span className="text-amber-700 dark:text-amber-400">
                      {missing.join(', ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-400"
                  >
                    Ausfüllen →
                  </button>
                </div>
              ),
            )}
          </div>
        </Section>
      )}

      {step === 4 && comparison && (
        <div className="flex flex-col gap-4">
          <Section title="Ergebnis" subtitle="Kumulierte Gesamtkosten im Vergleich – berechnet aus deinen Werten">
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
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={missingByStep[step].length > 0}
              className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              {step === steps.length - 2 ? 'Zur Übersicht →' : 'Weiter →'}
            </button>
            {missingByStep[step].length > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Noch {missingByStep[step].length}{' '}
                {missingByStep[step].length === 1 ? 'Pflichtfeld' : 'Pflichtfelder'}:{' '}
                {missingByStep[step].join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      <footer className="mt-8 flex flex-col items-center gap-1.5 pb-4 text-center text-xs text-slate-400">
        <p>
          Alle Berechnungen laufen lokal im Browser, es werden keine Daten an einen Server
          übertragen (außer beim optionalen VRM-Live-Abruf über den konfigurierten Proxy).
        </p>
      </footer>
    </div>
  )
}

export default App
