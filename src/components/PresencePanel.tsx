import { WEEKDAYS, type PresenceProfile, type Weekday } from '../lib/types'

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Mo',
  tue: 'Di',
  wed: 'Mi',
  thu: 'Do',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'So',
}

const PRESETS: { label: string; profile: PresenceProfile }[] = [
  {
    label: 'Immer zuhause / Homeoffice',
    profile: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
  },
  {
    label: 'Nur Wochenende',
    profile: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true },
  },
  {
    label: 'Nie tagsüber (Vollzeit Büro)',
    profile: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
  },
]

interface PresencePanelProps {
  value: PresenceProfile
  onChange: (value: PresenceProfile) => void
}

export function PresencePanel({ value, onChange }: PresencePanelProps) {
  const toggle = (day: Weekday) => onChange({ ...value, [day]: !value[day] })

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          Tagsüber zuhause &amp; kann laden
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                value[day]
                  ? 'border-sky-500 bg-sky-500 text-white'
                  : 'border-slate-300 bg-white text-slate-500 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.profile)}
            className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400"
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Ohne Heimspeicher kann PV-Überschuss nur genutzt werden, wenn tagsüber jemand zuhause ist
        und das Auto einsteckt. An Tagen ohne Anwesenheit fließt der Überschuss stattdessen ins
        Netz und steht fürs Laden nicht zur Verfügung.
      </p>
    </div>
  )
}
