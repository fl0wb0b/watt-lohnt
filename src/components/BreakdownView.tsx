import type { CarResult } from '../lib/types'

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

interface BreakdownViewProps {
  oldResult: CarResult
  newResult: CarResult
  oldLabel: string
  newLabel: string
}

interface Row {
  label: string
  oldValue: number
  newValue: number
  /** true = mindert die Kosten (Erlös/Gutschrift) */
  isCredit?: boolean
}

function sum(result: CarResult, pick: (y: CarResult['years'][number]) => number): number {
  return result.years.reduce((acc, y) => acc + pick(y), 0)
}

/**
 * Ehrliche Gesamtaufstellung: jede Kostenposition einzeln, über den ganzen Betrachtungszeitraum
 * summiert – für beide Pfade nebeneinander. Keine versteckten Posten.
 */
export function BreakdownView({ oldResult, newResult, oldLabel, newLabel }: BreakdownViewProps) {
  const rows: Row[] = [
    {
      label: 'Anschaffung sofort (Kaufpreis/Anzahlung/Sonderzahlung + Wallbox, abzgl. Förderung/Inzahlungnahme)',
      oldValue: oldResult.upfrontCash,
      newValue: newResult.upfrontCash,
    },
    {
      label: 'Finanzierungs-/Leasingraten (inkl. Tilgung, Zinsen, Schlussrate)',
      oldValue: sum(oldResult, (y) => y.financingCash),
      newValue: sum(newResult, (y) => y.financingCash),
    },
    {
      label: '– davon reine Zinskosten',
      oldValue: sum(oldResult, (y) => y.financingInterest),
      newValue: sum(newResult, (y) => y.financingInterest),
    },
    {
      label: 'Energie (Strom/Kraftstoff, inkl. Ladeverluste & Preissteigerung)',
      oldValue: sum(oldResult, (y) => y.energy),
      newValue: sum(newResult, (y) => y.energy),
    },
    {
      label: 'Versicherung',
      oldValue: sum(oldResult, (y) => y.insurance),
      newValue: sum(newResult, (y) => y.insurance),
    },
    {
      label: 'Kfz-Steuer (inkl. Ende der BEV-Befreiung)',
      oldValue: sum(oldResult, (y) => y.tax),
      newValue: sum(newResult, (y) => y.tax),
    },
    {
      label: 'Wartung & Reparaturen (inkl. Alters-/Laufleistungszuschlag)',
      oldValue: sum(oldResult, (y) => y.maintenance),
      newValue: sum(newResult, (y) => y.maintenance),
    },
    {
      label: 'Ersatzbeschaffung bei erreichter Lebensdauer',
      oldValue: sum(oldResult, (y) => y.replacement),
      newValue: sum(newResult, (y) => y.replacement),
    },
    {
      label: 'THG-Quoten-Erlös',
      oldValue: -sum(oldResult, (y) => y.thgIncome),
      newValue: -sum(newResult, (y) => y.thgIncome),
      isCredit: true,
    },
    {
      label: 'Restwert am Ende (Verkaufserlös, bei Leasing 0)',
      oldValue: -oldResult.residualValueAtHorizon,
      newValue: -newResult.residualValueAtHorizon,
      isCredit: true,
    },
  ]

  const oldTotal =
    oldResult.upfrontCash +
    sum(oldResult, (y) => y.ongoingTotal) +
    oldResult.outstandingBalance[oldResult.outstandingBalance.length - 1] -
    oldResult.residualValueAtHorizon
  const newTotal =
    newResult.upfrontCash +
    sum(newResult, (y) => y.ongoingTotal) +
    newResult.outstandingBalance[newResult.outstandingBalance.length - 1] -
    newResult.residualValueAtHorizon

  const fmt = (v: number, credit?: boolean) => (
    <span className={v < 0 || (credit && v !== 0) ? 'text-emerald-600 dark:text-emerald-400' : undefined}>
      {eur.format(v)}
    </span>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-400 dark:border-slate-800">
            <th className="py-2 pr-2 font-medium">Kostenposition (gesamt über den Zeitraum)</th>
            <th className="py-2 pr-2 text-right font-medium">{oldLabel}</th>
            <th className="py-2 text-right font-medium">{newLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800/60">
              <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-300">{r.label}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(r.oldValue, r.isCredit)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmt(r.newValue, r.isCredit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold text-slate-900 dark:text-slate-100">
            <td className="py-2 pr-2">Nettokosten gesamt</td>
            <td className="py-2 pr-2 text-right tabular-nums">{eur.format(oldTotal)}</td>
            <td className="py-2 text-right tabular-nums">{eur.format(newTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-xs text-slate-400">
        Alle Posten nominal aufsummiert (ohne Diskontierung), damit die Tabelle nachrechenbar
        bleibt. Zinsen sind in den Raten enthalten und nur zur Info separat ausgewiesen. Grüne
        Werte mindern die Kosten.
      </p>
    </div>
  )
}
