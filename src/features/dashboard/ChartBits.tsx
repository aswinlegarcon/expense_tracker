import type { ReactNode } from 'react'
import { formatMoney } from '../../lib/money'

export function ChartCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function LegendChips({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {i.dashed ? (
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  )
}

interface TipPayload {
  value?: number | null
  name?: string
  color?: string
  dataKey?: string | number
  payload?: { color?: string; name?: string }
}

export function ChartTip({
  active,
  payload,
  label,
  currency,
  labelText,
}: {
  active?: boolean
  payload?: TipPayload[]
  label?: string | number
  currency: string
  labelText?: (label: string | number) => string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value != null)
  if (!rows.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
      {label !== undefined && (
        <div className="mb-1 font-semibold">{labelText ? labelText(label) : label}</div>
      )}
      {rows.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-1.5 py-0.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: p.color ?? p.payload?.color ?? '#64748b' }}
          />
          <span className="text-slate-500 dark:text-slate-400">{p.name ?? p.payload?.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{formatMoney(p.value!, currency)}</span>
        </div>
      ))}
    </div>
  )
}
