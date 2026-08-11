import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { VrmPvData } from '../lib/types'
import { estimatePvFromSize, fetchVrmAnnualStats, parseVrmLink, VrmFetchError } from '../lib/vrm'
import { NumberField } from './fields'

type Mode = 'quick' | 'manual' | 'live'

interface VrmPanelProps {
  value: VrmPvData
  onChange: (data: VrmPvData) => void
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export function VrmPanel({ value, onChange }: VrmPanelProps) {
  const [mode, setMode] = useState<Mode>('quick')

  // Schnellschätzung
  const [kwp, setKwp] = useState(9)
  const [specificYield, setSpecificYield] = useState(1000)
  const [quickConsumption, setQuickConsumption] = useState(4500)
  const [hasBattery, setHasBattery] = useState(false)

  // Live-Abruf
  const [link, setLink] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseVrmLink(link)

  const applyQuick = (
    nextKwp = kwp,
    nextYield = specificYield,
    nextConsumption = quickConsumption,
    nextBattery = hasBattery,
  ) => {
    onChange(estimatePvFromSize(nextKwp, nextYield, nextConsumption, nextBattery))
  }

  const handleLiveFetch = async () => {
    if (!parsed) {
      setError('Kein gültiger VRM-Link bzw. keine Installations-ID erkannt.')
      return
    }
    if (!accessToken.trim()) {
      setError('Für den Live-Abruf wird ein VRM Access Token benötigt (siehe Hinweis unten).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchVrmAnnualStats(parsed.installationId, accessToken.trim())
      onChange(data)
    } catch (e) {
      setError(e instanceof VrmFetchError ? e.message : 'Unbekannter Fehler beim Live-Abruf.')
    } finally {
      setLoading(false)
    }
  }

  const setManual = <K extends keyof VrmPvData>(key: K, v: VrmPvData[K]) =>
    onChange({ ...value, [key]: v, source: 'manual' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            ['quick', 'Schnellschätzung'],
            ['manual', 'Manuell (aus VRM)'],
            ['live', 'VRM-Live (Token)'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              mode === m
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'quick' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            Kein Token, kein Ablesen – nur die Anlagengröße eingeben. Ertrag und Eigenverbrauch
            werden mit typischen Werten für Deutschland geschätzt. Wer es genauer will, nutzt
            "Manuell" mit den echten Zahlen aus dem VRM-Dashboard.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="PV-Anlagengröße"
              value={kwp}
              onChange={(v) => {
                setKwp(v)
                applyQuick(v)
              }}
              suffix="kWp"
              step={0.5}
            />
            <NumberField
              label="Spezifischer Ertrag"
              value={specificYield}
              onChange={(v) => {
                setSpecificYield(v)
                applyQuick(undefined, v)
              }}
              suffix="kWh/kWp"
              step={10}
              hint="Deutschland typ. 950–1050, Süddach eher mehr"
            />
            <NumberField
              label="Haushaltsverbrauch (ohne Auto)"
              value={quickConsumption}
              onChange={(v) => {
                setQuickConsumption(v)
                applyQuick(undefined, undefined, v)
              }}
              suffix="kWh/Jahr"
              step={100}
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hasBattery}
                onChange={(e) => {
                  setHasBattery(e.target.checked)
                  applyQuick(undefined, undefined, undefined, e.target.checked)
                }}
                className="size-4 rounded border-slate-300"
              />
              Heimspeicher vorhanden
            </label>
          </div>
          <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            Geschätzt: <strong>{Math.round(value.annualYieldKwh).toLocaleString('de-DE')} kWh/Jahr</strong> Ertrag,{' '}
            <strong>{Math.round(value.selfConsumptionShare * 100)}%</strong> Eigenverbrauch (ohne Auto).
          </p>
        </div>
      )}

      {mode === 'manual' && (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-xs text-slate-400">
            Die drei Werte stehen im VRM-Dashboard (Jahresansicht): Solarertrag, Verbrauch und
            Netzeinspeisung. Eigenverbrauchsanteil = (Ertrag − Einspeisung) / Ertrag.
          </p>
          <NumberField
            label="PV-Jahresertrag"
            value={value.annualYieldKwh}
            onChange={(v) => setManual('annualYieldKwh', v)}
            suffix="kWh/Jahr"
            step={100}
          />
          <NumberField
            label="Eigenverbrauchsanteil"
            value={Math.round(value.selfConsumptionShare * 100)}
            onChange={(v) => setManual('selfConsumptionShare', v / 100)}
            suffix="%"
            step={1}
            max={100}
            hint="Anteil der PV-Erzeugung, der schon heute selbst verbraucht statt eingespeist wird"
          />
          <NumberField
            label="Haushaltsverbrauch (ohne Auto)"
            value={value.annualHouseholdConsumptionKwh}
            onChange={(v) => setManual('annualHouseholdConsumptionKwh', v)}
            suffix="kWh/Jahr"
            step={100}
          />
        </div>
      )}

      {mode === 'live' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              VRM-Link oder Installations-ID
            </span>
            <input
              type="text"
              placeholder="https://vrm.victronenergy.com/installation/238127/share/..."
              className={inputClass}
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">VRM Access Token</span>
            <input
              type="password"
              placeholder="VRM → Preferences → Integrations → Access tokens"
              className={inputClass}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={handleLiveFetch}
            disabled={loading || !parsed}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Live-Daten abrufen
          </button>

          {error && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          )}
          {value.source === 'live' && !error && (
            <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Live-Daten von VRM übernommen.
            </p>
          )}

          <p className="text-xs text-slate-400">
            Victron bietet für reine Share-Links keine öffentliche API – der Live-Abruf braucht
            leider zwingend einen persönlichen Access Token. Wem das zu umständlich ist: die
            Schnellschätzung liefert in 10 Sekunden brauchbare Werte.
          </p>
        </div>
      )}
    </div>
  )
}
