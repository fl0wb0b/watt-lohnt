import type { ChangeEvent, ReactNode } from 'react'

interface NumberFieldProps {
  label: string
  /** NaN = noch nicht ausgefüllt (Pflichtfeld-Zustand): Eingabe leer, Platzhalter sichtbar. */
  value: number
  onChange: (value: number) => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  hint?: string
  /** Grauer Vorschlagswert, solange das Feld leer ist (z.B. "z.B. 14000"). */
  placeholder?: string
  /** Pflichtfeld: leer → amber markiert, blockiert den Weiter-Button. */
  required?: boolean
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
  max,
  hint,
  placeholder,
  required,
}: NumberFieldProps) {
  const empty = Number.isNaN(value)
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Leeres Feld bleibt bewusst "unausgefüllt" (NaN) statt still zu 0 zu werden.
    onChange(e.target.value === '' ? NaN : e.target.valueAsNumber)
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-0.5 text-amber-500">*</span>}
      </span>
      <span className="relative">
        <input
          type="number"
          className={`w-full rounded-md border bg-white px-3 py-1.5 pr-12 text-slate-900 shadow-sm placeholder:italic placeholder:text-slate-400 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
            required && empty
              ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-600'
              : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500 dark:border-slate-700'
          }`}
          value={empty ? '' : value}
          onChange={handleChange}
          placeholder={placeholder}
          step={step}
          min={min}
          max={max}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <select
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Section({
  title,
  subtitle,
  children,
  right,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}
