import type { ComparisonResult } from '../lib/types'
import { CostChart } from './CostChart'

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
  uncertaintyPercent: number
}

export function ResultsView({
  result,
  oldLabel,
  newLabel,
  discountRatePercent,
  uncertaintyPercent,
}: ResultsViewProps) {
  const { breakEvenYear, savingsAtHorizon, oldCumulativeNet, newCumulativeNet } = result
  const horizon = oldCumulativeNet.length - 1

  // Unschärfe: Differenz beider Pfade ± Toleranz auf die jeweiligen Gesamtkosten.
  const tol = Math.max(0, uncertaintyPercent) / 100
  const spread =
    (Math.abs(oldCumulativeNet[horizon]) + Math.abs(newCumulativeNet[horizon])) * tol * 0.5
  const savingsLow = savingsAtHorizon - spread
  const savingsHigh = savingsAtHorizon + spread

  const worthIt = savingsAtHorizon > 0
  const verdictUncertain = savingsLow < 0 !== savingsHigh < 0 // Toleranzband umfasst die Null
  const oldEndOfLife = result.old.endOfLifeYear

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
          verdictUncertain
            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
            : worthIt
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
        }`}
      >
        {verdictUncertain
          ? `Zu knapp für ein klares Urteil: über ${horizon} Jahre liegt der Unterschied zwischen ${eur.format(savingsLow)} und ${eur.format(savingsHigh)} (±${uncertaintyPercent}% Unschärfe auf die Eingaben). Beide Wege sind wirtschaftlich etwa gleichwertig.`
          : worthIt
            ? `"${newLabel}" lohnt sich: über ${horizon} Jahre ca. ${eur.format(savingsLow)} bis ${eur.format(savingsHigh)} günstiger als "${oldLabel}" behalten (±${uncertaintyPercent}% Toleranz).`
            : `"${newLabel}" lohnt sich (noch) nicht: über ${horizon} Jahre ca. ${eur.format(Math.abs(savingsHigh))} bis ${eur.format(Math.abs(savingsLow))} teurer als "${oldLabel}" behalten (±${uncertaintyPercent}% Toleranz).`}
      </div>

      {oldEndOfLife != null && (
        <p className="rounded-md bg-slate-100 p-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          ⚠️ Das Bestandsfahrzeug erreicht in <strong>Jahr {oldEndOfLife}</strong> seine erwartete
          Gesamt-Laufleistung. Ein Auto fährt nicht unendlich – im „Behalten"-Pfad ist deshalb ab
          dann eine gleichwertige gebrauchte Ersatzbeschaffung eingerechnet (siehe Aufstellung
          unten).
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <CostChart
          oldSeries={oldCumulativeNet}
          newSeries={newCumulativeNet}
          oldLabel={oldLabel}
          newLabel={newLabel}
          breakEvenYear={breakEvenYear}
        />
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
