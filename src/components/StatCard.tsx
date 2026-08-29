import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  icon: LucideIcon
  tone: 'red' | 'green' | 'blue'
  sub?: ReactNode
}

const TONES = {
  red: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400',
  green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  blue: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
}

export default function StatCard({ label, value, icon: Icon, tone, sub }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className={`flex size-8 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon className="size-4" />
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="mt-2.5 truncate text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  )
}
