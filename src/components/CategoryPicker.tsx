import type { Category, CategoryKind } from '../types'

interface Props {
  categories: Category[]
  kind: CategoryKind
  value: string | null
  onChange: (id: string) => void
}

export default function CategoryPicker({ categories, kind, value, onChange }: Props) {
  const options = categories.filter((c) => c.kind === kind && !c.is_archived)

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
      {options.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition-colors ${
            value === c.id
              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40'
              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
          }`}
        >
          <span
            className="flex size-8 items-center justify-center rounded-full text-base"
            style={{ backgroundColor: `${c.color}26` }}
          >
            {c.icon}
          </span>
          <span className="w-full truncate text-[11px] font-medium leading-tight">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
