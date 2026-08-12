import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Break-even-Chart: kumulierte Nettokosten beider Pfade über die Jahre.
 *
 * Bewusst als eigenes SVG statt Chart-Bibliothek, damit die Darstellungsregeln exakt
 * eingehalten werden: 2px-Linien, ≥8px-Marker mit 2px-Ring in Flächenfarbe, hauchdünne
 * Gitterlinien, sparsame Direktbeschriftung (nur Endpunkte), Legende plus Tabellenansicht
 * (Identität nie nur über Farbe), Crosshair-Tooltip mit beiden Serien.
 *
 * Farben: validierte kategoriale Slots 1 (blau) und 2 (orange), hell und dunkel getrennt
 * gesetzt – beide Modi bestehen Helligkeits-, Chroma-, Farbfehlsichtigkeits- und
 * Kontrastprüfung.
 */

interface CostChartProps {
  oldSeries: number[]
  newSeries: number[]
  oldLabel: string
  newLabel: string
  breakEvenYear: number | null
}

const eur0 = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const M = { top: 24, right: 16, bottom: 34, left: 60 }
const HEIGHT = 320

/** Achsengrenzen auf runde Schritte erweitern, damit die Ticks lesbare Zahlen tragen. */
function niceScale(min: number, max: number, targetTicks = 5) {
  if (min === max) {
    min -= 1000
    max += 1000
  }
  const raw = (max - min) / targetTicks
  const mag = 10 ** Math.floor(Math.log10(Math.abs(raw) || 1))
  const norm = raw / mag
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v))
  return { min: niceMin, max: niceMax, ticks }
}

function formatTick(v: number) {
  if (v === 0) return '0'
  const k = v / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k €`
}

export function CostChart({
  oldSeries,
  newSeries,
  oldLabel,
  newLabel,
  breakEvenYear,
}: CostChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const horizon = oldSeries.length - 1
  const scale = useMemo(() => {
    const all = [...oldSeries, ...newSeries, 0]
    return niceScale(Math.min(...all), Math.max(...all))
  }, [oldSeries, newSeries])

  const plotW = Math.max(120, width - M.left - M.right)
  const plotH = HEIGHT - M.top - M.bottom
  const x = (year: number) => M.left + (horizon === 0 ? plotW / 2 : (year / horizon) * plotW)
  const y = (v: number) =>
    M.top + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH

  const path = (s: number[]) => s.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')

  // Direktbeschriftung nur an den Endpunkten; bei Überlappung auseinanderschieben.
  const endOld = y(oldSeries[horizon])
  const endNew = y(newSeries[horizon])
  const gap = Math.abs(endOld - endNew)
  const push = gap < 22 ? (22 - gap) / 2 : 0
  const labelOldY = endOld + (endOld <= endNew ? -6 - push : 14 + push)
  const labelNewY = endNew + (endNew < endOld ? -6 - push : 14 + push)

  const hoveredFromEvent = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || horizon === 0) return 0
    const rel = clientX - rect.left - M.left
    return Math.max(0, Math.min(horizon, Math.round((rel / plotW) * horizon)))
  }

  const diff = hoverYear != null ? oldSeries[hoverYear] - newSeries[hoverYear] : 0

  return (
    <figure className="viz m-0">
      {/* Legende: Identität nie nur über Farbe – Linien-Key plus Name */}
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {[
          { label: newLabel, cls: 'viz-s1' },
          { label: oldLabel, cls: 'viz-s2' },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className={`inline-block h-0.5 w-4 rounded-full ${s.cls}-bg`} />
            {s.label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="ml-auto rounded px-1.5 py-0.5 text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
        >
          {showTable ? 'Diagramm zeigen' : 'Als Tabelle'}
        </button>
      </figcaption>

      {showTable ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Jahr</th>
                <th className="px-3 py-2 text-right font-medium">{newLabel}</th>
                <th className="px-3 py-2 text-right font-medium">{oldLabel}</th>
                <th className="px-3 py-2 text-right font-medium">Differenz</th>
              </tr>
            </thead>
            <tbody>
              {oldSeries.map((o, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">
                    {i === 0 ? 'heute' : `nach ${i} J.`}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur0.format(newSeries[i])}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur0.format(o)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {eur0.format(o - newSeries[i])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative w-full">
          <svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={`Kumulierte Nettokosten über ${horizon} Jahre: ${newLabel} gegen ${oldLabel}`}
            onPointerMove={(e) => setHoverYear(hoveredFromEvent(e.clientX))}
            onPointerLeave={() => setHoverYear(null)}
            className="touch-pan-y"
          >
            {/* Gitter: hauchdünn, durchgezogen, zurückhaltend */}
            {scale.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  x2={M.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? 'viz-axis' : 'viz-grid'}
                  strokeWidth={1}
                />
                <text x={M.left - 10} y={y(t) + 4} textAnchor="end" className="viz-tick">
                  {formatTick(t)}
                </text>
              </g>
            ))}

            {/* X-Achse */}
            {Array.from({ length: horizon + 1 }, (_, i) => i)
              .filter((i) => horizon <= 10 || i % Math.ceil(horizon / 10) === 0 || i === horizon)
              .map((i) => (
                <text key={i} x={x(i)} y={HEIGHT - 12} textAnchor="middle" className="viz-tick">
                  {i === 0 ? 'heute' : `J${i}`}
                </text>
              ))}

            {/* Break-even-Markierung */}
            {breakEvenYear != null && (
              <g>
                <line
                  x1={x(breakEvenYear)}
                  x2={x(breakEvenYear)}
                  y1={M.top}
                  y2={M.top + plotH}
                  className="viz-annot"
                  strokeWidth={1}
                />
                <g transform={`translate(${x(breakEvenYear)}, ${M.top - 8})`}>
                  <rect x={-46} y={-13} width={92} height={18} rx={9} className="viz-annot-chip" />
                  <text y={0} textAnchor="middle" className="viz-annot-text">
                    Break-even J{breakEvenYear}
                  </text>
                </g>
              </g>
            )}

            {/* Serien: 2px, runde Enden */}
            <path d={path(oldSeries)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="viz-s2-stroke" />
            <path d={path(newSeries)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="viz-s1-stroke" />

            {/* Crosshair + Punkte am gehoverten Jahr */}
            {hoverYear != null && (
              <g>
                <line
                  x1={x(hoverYear)}
                  x2={x(hoverYear)}
                  y1={M.top}
                  y2={M.top + plotH}
                  className="viz-crosshair"
                  strokeWidth={1}
                />
                {[
                  { v: newSeries[hoverYear], cls: 'viz-s1-fill' },
                  { v: oldSeries[hoverYear], cls: 'viz-s2-fill' },
                ].map((p, i) => (
                  <circle key={i} cx={x(hoverYear)} cy={y(p.v)} r={4.5} strokeWidth={2} className={`${p.cls} viz-ring`} />
                ))}
              </g>
            )}

            {/* Endpunkte mit Ring in Flächenfarbe */}
            <circle cx={x(horizon)} cy={endOld} r={4.5} strokeWidth={2} className="viz-s2-fill viz-ring" />
            <circle cx={x(horizon)} cy={endNew} r={4.5} strokeWidth={2} className="viz-s1-fill viz-ring" />

            {/* Direktbeschriftung nur an den Endpunkten – Text in Text-Tokens, nie in Serienfarbe */}
            <text x={x(horizon) - 8} y={labelOldY} textAnchor="end" className="viz-endlabel">
              {eur0.format(oldSeries[horizon])}
            </text>
            <text x={x(horizon) - 8} y={labelNewY} textAnchor="end" className="viz-endlabel">
              {eur0.format(newSeries[horizon])}
            </text>
          </svg>

          {/* Tooltip: Wert führt, Serienname folgt */}
          {hoverYear != null && (
            <div
              className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-slate-200 bg-white/95 p-2.5 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
              style={{
                left: Math.min(Math.max(x(hoverYear) + 12, 8), Math.max(8, width - 190)),
                top: M.top,
              }}
            >
              <p className="mb-1.5 font-medium text-slate-500 dark:text-slate-400">
                {hoverYear === 0 ? 'Heute' : `Nach ${hoverYear} Jahr${hoverYear === 1 ? '' : 'en'}`}
              </p>
              {[
                { label: newLabel, v: newSeries[hoverYear], cls: 'viz-s1-bg' },
                { label: oldLabel, v: oldSeries[hoverYear], cls: 'viz-s2-bg' },
              ].map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 py-0.5">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className={`inline-block h-0.5 w-3 rounded-full ${r.cls}`} />
                    {r.label}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {eur0.format(r.v)}
                  </span>
                </div>
              ))}
              <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1.5 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">
                  {diff >= 0 ? 'Vorteil neu' : 'Nachteil neu'}
                </span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {eur0.format(Math.abs(diff))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </figure>
  )
}
