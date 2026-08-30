import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Sheet from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useAddCategory, useUpdateCategory } from '../../data/mutations'
import { useCategories } from '../../data/queries'
import type { Category, CategoryKind } from '../../types'

export default function CategoryManager() {
  const { data: categories = [] } = useCategories()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)
  const update = useUpdateCategory()
  const toast = useToast()

  const list = categories.filter((c) => c.kind === kind)

  async function toggleArchive(c: Category) {
    try {
      await update.mutateAsync({ id: c.id, is_archived: !c.is_archived })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                kind === k ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Plus className="size-3.5" /> Add
        </button>
      </div>

      <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {list.map((c) => (
          <li key={c.id} className={`flex items-center gap-3 px-3 py-2.5 ${c.is_archived ? 'opacity-45' : ''}`}>
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ backgroundColor: `${c.color}26` }}
            >
              {c.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {c.name}
              {c.is_archived && <span className="ml-2 text-[10px] text-slate-400 uppercase">archived</span>}
            </span>
            <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
            <button
              onClick={() => setEditing(c)}
              aria-label={`Edit ${c.name}`}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => toggleArchive(c)}
              aria-label={c.is_archived ? `Restore ${c.name}` : `Archive ${c.name}`}
              title={c.is_archived ? 'Restore' : 'Archive (hides from pickers, keeps history)'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              {c.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={adding || !!editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        title={editing ? `Edit ${editing.name}` : `New ${kind} category`}
      >
        <CategoryForm
          key={editing?.id ?? 'new'}
          kind={kind}
          existing={editing ?? undefined}
          onDone={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      </Sheet>
    </div>
  )
}

function CategoryForm({ kind, existing, onDone }: { kind: CategoryKind; existing?: Category; onDone: () => void }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? '🏷️')
  const [color, setColor] = useState(existing?.color ?? '#64748b')
  const add = useAddCategory()
  const update = useUpdateCategory()
  const toast = useToast()
  const busy = add.isPending || update.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return toast('Enter a name', 'error')
    try {
      if (existing) await update.mutateAsync({ id: existing.id, name: trimmed, icon, color })
      else await add.mutateAsync({ name: trimmed, kind, icon, color })
      onDone()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast(msg.includes('duplicate') ? 'A category with that name already exists' : msg, 'error')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-3">
        <label className="block w-20">
          <span className="mb-1.5 block text-sm font-medium">Emoji</span>
          <input
            type="text"
            value={icon}
            maxLength={4}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-transparent px-2 py-2.5 text-center text-lg outline-none focus:border-emerald-500 dark:border-slate-700"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input
            type="text"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pets"
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Colour</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-700"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {existing ? 'Save changes' : 'Add category'}
      </button>
    </form>
  )
}
