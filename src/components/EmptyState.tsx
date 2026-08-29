import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  hint?: string
}

export default function EmptyState({ icon: Icon, title, hint }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <Icon className="size-8 text-slate-300 dark:text-slate-600" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}
