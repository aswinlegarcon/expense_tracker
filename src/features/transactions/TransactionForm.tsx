import { Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import CategoryPicker from '../../components/CategoryPicker'
import { useToast } from '../../components/Toast'
import { useAddTransaction, useDeleteTransaction, useUpdateTransaction } from '../../data/mutations'
import { todayISO } from '../../lib/dates'
import type { Category, Transaction, TxType } from '../../types'

interface Props {
  categories: Category[]
  /** present = edit mode */
  existing?: Transaction
  onDone: () => void
}

export default function TransactionForm({ categories, existing, onDone }: Props) {
  const [type, setType] = useState<TxType>(existing?.type ?? 'expense')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null)
  const [date, setDate] = useState(existing?.occurred_on ?? todayISO())
  const [note, setNote] = useState(existing?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toast = useToast()
  const add = useAddTransaction()
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const busy = add.isPending || update.isPending || del.isPending

  function switchType(t: TxType) {
    setType(t)
    // categories are per-kind; drop a selection that no longer applies
    if (categoryId && categories.find((c) => c.id === categoryId)?.kind !== t) setCategoryId(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Math.round(parseFloat(amount) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) return toast('Enter a valid amount', 'error')
    if (!categoryId) return toast('Pick a category', 'error')
    if (!date) return toast('Pick a date', 'error')

    const input = { type, amount: value, category_id: categoryId, occurred_on: date, note: note.trim() }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, ...input })
      else await add.mutateAsync(input)
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    }
  }

  async function onDelete() {
    if (!existing) return
    try {
      await del.mutateAsync(existing.id)
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* type toggle */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
              type === t
                ? t === 'expense'
                  ? 'bg-white text-red-600 shadow-sm dark:bg-slate-900 dark:text-red-400'
                  : 'bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* amount */}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Amount</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          autoFocus={!existing}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-2xl font-bold tracking-tight outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700"
        />
      </label>

      {/* category */}
      <div>
        <span className="mb-1.5 block text-sm font-medium">Category</span>
        <CategoryPicker categories={categories} kind={type} value={categoryId} onChange={setCategoryId} />
      </div>

      {/* date + note */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:[color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Note <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            type="text"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Lunch with team"
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700"
          />
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        {existing &&
          (confirmDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Trash2 className="size-4" /> Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          ))}
        <button
          type="submit"
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {existing ? 'Save changes' : 'Add'}
        </button>
      </div>
    </form>
  )
}
