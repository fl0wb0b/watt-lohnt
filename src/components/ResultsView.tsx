import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ComparisonResult } from '../lib/types'

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

interface ResultsViewProps {
  result: ComparisonResult
  oldLabel: string
  newLabel: string
  discountRatePercent: number
}

export function ResultsView({ result, oldLabel, newLabel, discountRatePercent }: ResultsViewProps) {
  const { breakEvenYear, savingsAtHorizon, oldCumulativeNet, newCumulativeNet } = result
  const horizon = oldCumulativeNet.length - 1

  const chartData = oldCumulativeNet.map((_, y) => ({
    year: y,
    [oldLabel]: Math.round(oldCumulativeNet[y]),
    [newLabel]: Math.round(newCumulativeNet[y]),
  }))

  const worthIt = savingsAtHorizon > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`Nettokosten "${oldLabel}" nach ${horizon} J.`}
          value={eur.format(oldCumulativeNet[horizon])}
        />
        <StatCard
          label={`Nettokosten "${newLabel}" nach ${horizon} J.`}
          value={eur.format(newCumulativeNet[horizon])}
        />
        <StatCard
          label="Break-even"
          value={breakEvenYear ? `nach ${breakEvenYear} Jahr${breakEvenYear === 1 ? '' : 'en'}` : 'nicht erreicht'}
          accent={breakEvenYear ? 'positive' : 'neutral'}
        />
      </div>

      <div
        className={`rounded-xl border p-4 text-sm font-medium ${
          worthIt
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
        }`}
      >
        {worthIt
          ? `"${newLabel}" lohnt sich: über ${horizon} Jahre ca. ${eur.format(savingsAtHorizon)} günstiger als "${oldLabel}" behalten.`
          : `"${newLabel}" lohnt sich (noch) nicht: über ${horizon} Jahre ca. ${eur.format(Math.abs(savingsAtHorizon))} teurer als "${oldLabel}" behalten.`}
      </div>

      <div className="h-80 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
            <XAxis dataKey="year" tickFormatter={(y) => `J${y}`} className="text-xs" />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k€`}
              width={50}
              className="text-xs"
            />
            <Tooltip
              formatter={(v) => eur.format(Number(v))}
              labelFormatter={(y) => `Jahr ${y}`}
            />
            <Legend />
            {breakEvenYear && (
              <ReferenceLine
                x={breakEvenYear}
                stroke="#0ea5e9"
                strokeDasharray="4 4"
                label={{ value: 'Break-even', position: 'insideTopLeft', fontSize: 11, fill: '#0ea5e9' }}
              />
            )}
            <Line type="monotone" dataKey={oldLabel} stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={newLabel} stroke="#0ea5e9" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-400">
        Nettokosten = kumulierte Anschaffungs- und laufende Kosten (inkl. offener
        Finanzierungsschuld) abzüglich des geschätzten Wiederverkaufswerts, wenn das jeweilige
        Fahrzeug in diesem Jahr verkauft würde.{' '}
        {discountRatePercent > 0
          ? `Alle Zahlungsströme sind mit ${discountRatePercent}%/Jahr auf den heutigen Wert abgezinst (Kapitalwert-Vergleich).`
          : 'Ohne Diskontierung/Kapitalkosten auf das eingesetzte Kapital – reine nominale Kostenbetrachtung (Kalkulationszins lässt sich oben auf 0% ändern).'}
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = 'neutral',
}: {
  label: string
  value: string
  accent?: 'positive' | 'neutral'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          accent === 'positive' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
