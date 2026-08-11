import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { VrmPvData } from '../lib/types'
import { fetchVrmAnnualStats, parseVrmLink, VrmFetchError } from '../lib/vrm'
import { NumberField } from './fields'

interface VrmPanelProps {
  value: VrmPvData
  onChange: (data: VrmPvData) => void
}

export function VrmPanel({ value, onChange }: VrmPanelProps) {
  const [link, setLink] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseVrmLink(link)

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
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            VRM-Link oder Installations-ID
          </span>
          <input
            type="text"
            placeholder="https://vrm.victronenergy.com/installation/238127/share/..."
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            VRM Access Token <span className="font-normal text-slate-400">(optional, für Live-Abruf)</span>
          </span>
          <input
            type="password"
            placeholder="VRM → Preferences → Integrations → Access tokens"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            Live-Daten von VRM übernommen. Werte unten können weiter angepasst werden.
          </p>
        )}

        <p className="text-xs text-slate-400">
          Reine Share-Links lassen sich aus dem Browser einer fremden Seite aus technisch nicht
          auslesen (Victron sieht dafür keine öffentliche API vor). Für den Live-Abruf braucht es
          einen persönlichen VRM Access Token – ansonsten einfach die Werte unten manuell aus dem
          VRM-Dashboard übertragen.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
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
    </div>
  )
}
