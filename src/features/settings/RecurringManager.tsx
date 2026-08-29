import { Loader2, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import CategoryPicker from '../../components/CategoryPicker'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Sheet from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useAddRecurring, useDeleteRecurring, useUpdateRecurring } from '../../data/mutations'
import { useCategories, useRecurring } from '../../data/queries'
import { formatFullDate, todayISO } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { Frequency, RecurringRule, TxType } from '../../types'

export default function RecurringManager({ currency }: { currency: string }) {
  const { data: rules = [] } = useRecurring()
  const { data: categories = [] } = useCategories()
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [adding, setAdding] = useState(false)
  const catById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Due amounts post automatically when you open the app.
        </p>
        <button
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Plus className="size-3.5" /> Add
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Repeat} title="No recurring transactions" hint="Rent, salary, subscriptions…" />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {rules.map((r) => {
            const cat = r.category_id ? catById.get(r.category_id) : undefined
            return (
              <li key={r.id}>
                <button
                  onClick={() => setEditing(r)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    r.is_active ? '' : 'opacity-45'
                  }`}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: `${cat?.color ?? '#64748b'}26` }}
                  >
                    {cat?.icon ?? '🏷️'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.note || cat?.name || 'Recurring'}
                      <span className="ml-1.5 text-[10px] text-slate-400 uppercase">{r.frequency}</span>
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {r.is_active ? `next ${formatFullDate(r.next_occurrence)}` : 'paused'}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      r.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {r.type === 'expense' ? '−' : '+'}
                    {formatMoney(r.amount, currency)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet
        open={adding || !!editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        title={editing ? 'Edit recurring' : 'New recurring'}
      >
        <RecurringForm
          key={editing?.id ?? 'new'}
          existing={editing ?? undefined}
          currency={currency}
          onDone={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      </Sheet>
    </div>
  )
}

function RecurringForm({
  existing,
  currency,
  onDone,
}: {
  existing?: RecurringRule
  currency: string
  onDone: () => void
}) {
  const { data: categories = [] } = useCategories()
  const [type, setType] = useState<TxType>(existing?.type ?? 'expense')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null)
  const [note, setNote] = useState(existing?.note ?? '')
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(existing?.start_date ?? todayISO())
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const add = useAddRecurring()
  const update = useUpdateRecurring()
  const del = useDeleteRecurring()
  const toast = useToast()
  const busy = add.isPending || update.isPending || del.isPending

  function switchType(t: TxType) {
    setType(t)
    if (categoryId && categories.find((c) => c.id === categoryId)?.kind !== t) setCategoryId(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Math.round(parseFloat(amount) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) return toast('Enter a valid amount', 'error')
    if (!categoryId) return toast('Pick a category', 'error')
    if (endDate && endDate < startDate) return toast('End date is before start date', 'error')

    const base = {
      type,
      amount: value,
      category_id: categoryId,
      note: note.trim(),
      frequency,
      start_date: startDate,
      end_date: endDate || null,
      is_active: isActive,
    }
    try {
      if (existing) {
        // A changed start date re-anchors the schedule from that date.
        const next = existing.start_date !== startDate ? startDate : existing.next_occurrence
        await update.mutateAsync({ id: existing.id, ...base, next_occurrence: next })
      } else {
        // Past start dates intentionally backfill on the next app open.
        await add.mutateAsync({ ...base, next_occurrence: startDate })
      }
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize ${
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

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Amount ({currency})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-slate-700"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Repeats</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Category</span>
        <CategoryPicker categories={categories} kind={type} value={categoryId} onChange={setCategoryId} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Starts / anchor date</span>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:[color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Ends <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:[color-scheme:dark]"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Note <span className="font-normal text-slate-400">(shown on posted transactions)</span>
        </span>
        <input
          type="text"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Rent"
          className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700"
        />
      </label>

      {existing && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          Active
        </label>
      )}

      <div className="flex gap-3 pt-1">
        {existing && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {existing ? 'Save changes' : 'Add recurring'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete recurring rule?"
        message="Already-posted transactions are kept; only the schedule is removed."
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          void onDelete()
        }}
      />
    </form>
  )
}
