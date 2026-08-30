import { Banknote, CreditCard, Loader2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import CategoryPicker from '../../components/CategoryPicker'
import { useToast } from '../../components/Toast'
import { useAddTransaction, useDeleteTransaction, useUpdateTransaction } from '../../data/mutations'
import { useCreditSummary } from '../../data/queries'
import { todayISO } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { Category, PaymentMethod, Transaction, TxType } from '../../types'

interface Props {
  categories: Category[]
  /** present = edit mode */
  existing?: Transaction
  /** open the form straight in credit-card-bill mode */
  initialType?: TxType
  currency?: string
  onDone: () => void
}

const TYPE_TABS: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'card_payment', label: 'Card bill' },
]

export default function TransactionForm({
  categories,
  existing,
  initialType,
  currency = 'INR',
  onDone,
}: Props) {
  const [type, setType] = useState<TxType>(existing?.type ?? initialType ?? 'expense')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null)
  const [method, setMethod] = useState<PaymentMethod>(existing?.payment_method ?? 'cash')
  const [date, setDate] = useState(existing?.occurred_on ?? todayISO())
  const [note, setNote] = useState(existing?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toast = useToast()
  const { data: credit } = useCreditSummary()
  const add = useAddTransaction()
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const busy = add.isPending || update.isPending || del.isPending

  const isBill = type === 'card_payment'
  const outstanding = credit?.outstanding ?? 0

  function switchType(next: TxType) {
    setType(next)
    // categories are per-kind, and a bill payment has no category at all
    if (next === 'card_payment') setCategoryId(null)
    else if (categoryId && categories.find((c) => c.id === categoryId)?.kind !== next) setCategoryId(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Math.round(parseFloat(amount) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) return toast('Enter a valid amount', 'error')
    if (!isBill && !categoryId) return toast('Pick a category', 'error')
    if (!date) return toast('Pick a date', 'error')

    const input = {
      type,
      amount: value,
      category_id: isBill ? null : categoryId,
      // a bill payment leaves your bank, so it is never itself "credit"
      payment_method: isBill || type === 'income' ? ('cash' as const) : method,
      occurred_on: date,
      note: note.trim() || (isBill ? 'Credit card bill' : ''),
    }
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
      <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => switchType(t.value)}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              type === t.value
                ? t.value === 'expense'
                  ? 'bg-white text-red-600 shadow-sm dark:bg-slate-900 dark:text-red-400'
                  : t.value === 'income'
                    ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                    : 'bg-white text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isBill && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Outstanding on card</p>
              <p className="text-lg font-bold tracking-tight text-violet-900 dark:text-violet-100">
                {formatMoney(outstanding, currency)}
              </p>
            </div>
            {outstanding > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(outstanding))}
                className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Pay full
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-violet-700/80 dark:text-violet-300/80">
            Settling the bill is not counted as new spending — the items were already recorded when you charged
            them.
          </p>
        </div>
      )}

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

      {/* paid with — only meaningful for expenses */}
      {type === 'expense' && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Paid with</span>
          <div className="grid grid-cols-2 gap-2">
            <PayButton
              active={method === 'cash'}
              onClick={() => setMethod('cash')}
              icon={Banknote}
              label="Cash"
              hint="cash, UPI, debit"
            />
            <PayButton
              active={method === 'credit'}
              onClick={() => setMethod('credit')}
              icon={CreditCard}
              label="Credit"
              hint="pay at bill time"
            />
          </div>
        </div>
      )}

      {/* category */}
      {!isBill && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Category</span>
          <CategoryPicker categories={categories} kind={type} value={categoryId} onChange={setCategoryId} />
        </div>
      )}

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
            placeholder={isBill ? 'Credit card bill' : 'e.g. Lunch with team'}
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
          {existing ? 'Save changes' : isBill ? 'Record payment' : 'Add'}
        </button>
      </div>
    </form>
  )
}

function PayButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Banknote
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active
          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40'
          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
      }`}
    >
      <Icon className={`size-4 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>
      </span>
    </button>
  )
}
