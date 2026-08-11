import type { ChangeEvent, ReactNode } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  hint?: string
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
}: NumberFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.valueAsNumber
    onChange(Number.isFinite(v) ? v : 0)
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <span className="relative">
        <input
          type="number"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-12 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={Number.isFinite(value) ? value : 0}
          onChange={handleChange}
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
