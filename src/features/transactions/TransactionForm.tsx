import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CreditCard,
  LifeBuoy,
  Loader2,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import CategoryPicker from '../../components/CategoryPicker'
import { useToast } from '../../components/Toast'
import { useAddCategory, useAddTransaction, useDeleteTransaction, useUpdateTransaction } from '../../data/mutations'
import { useCreditSummary, useHasHoldings, useHoldings } from '../../data/queries'
import { todayISO } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { formatMoney, round2 } from '../../lib/money'
import { STARTER_HOLDINGS, canUseCredit, kindOfType } from '../../lib/txKinds'
import type { Category, PaymentMethod, Transaction, TxType } from '../../types'

interface Props {
  categories: Category[]
  /** present = edit mode */
  existing?: Transaction
  /** open the form straight in a given mode, e.g. credit-card bill */
  initialType?: TxType
  currency?: string
  onDone: () => void
}

/** What the person is recording. Fund deposits and withdrawals share one mode with
 *  a direction toggle, so switching direction keeps the chosen fund. */
type Mode = 'expense' | 'income' | 'investment' | 'fund' | 'card_payment'
type FundDirection = 'deposit' | 'withdraw'

const MODES: { value: Mode; label: string; icon: typeof Wallet; activeClass: string }[] = [
  { value: 'expense', label: 'Expense', icon: ShoppingBag, activeClass: 'text-red-600 dark:text-red-400' },
  { value: 'income', label: 'Income', icon: Wallet, activeClass: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'investment', label: 'Invest', icon: TrendingUp, activeClass: 'text-indigo-600 dark:text-indigo-400' },
  { value: 'fund', label: 'Fund', icon: LifeBuoy, activeClass: 'text-sky-600 dark:text-sky-400' },
  { value: 'card_payment', label: 'Card bill', icon: CreditCard, activeClass: 'text-violet-600 dark:text-violet-400' },
]

function modeOf(type: TxType): Mode {
  return type === 'fund_deposit' || type === 'fund_withdrawal' ? 'fund' : type
}

function typeOf(mode: Mode, direction: FundDirection): TxType {
  if (mode === 'fund') return direction === 'deposit' ? 'fund_deposit' : 'fund_withdrawal'
  return mode
}

export default function TransactionForm({ categories, existing, initialType, currency = 'INR', onDone }: Props) {
  const [mode, setMode] = useState<Mode>(modeOf(existing?.type ?? initialType ?? 'expense'))
  const [direction, setDirection] = useState<FundDirection>(
    existing?.type === 'fund_withdrawal' ? 'withdraw' : 'deposit',
  )
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null)
  const [method, setMethod] = useState<PaymentMethod>(existing?.payment_method ?? 'cash')
  const [date, setDate] = useState(existing?.occurred_on ?? todayISO())
  const [note, setNote] = useState(existing?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toast = useToast()
  const hasHoldings = useHasHoldings()
  const { data: credit } = useCreditSummary()
  const { data: holdings = [] } = useHoldings()
  const add = useAddTransaction()
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const addCategory = useAddCategory()
  const busy = add.isPending || update.isPending || del.isPending

  const modes = hasHoldings ? MODES : MODES.filter((m) => m.value !== 'investment' && m.value !== 'fund')
  const type = typeOf(mode, direction)
  const kind = kindOfType(type)
  const isBill = mode === 'card_payment'
  const isHolding = kind === 'investment' || kind === 'fund'
  const options = categories.filter((c) => c.kind === kind && !c.is_archived)

  // With a single fund or investment bucket there is nothing to choose: use it.
  const chosenId = categoryId ?? (isHolding && options.length === 1 ? options[0].id : null)

  // Fund balance as it would be without this entry, so editing a withdrawal
  // doesn't warn about the very amount it already took out.
  let available = holdings.find((h) => h.category_id === chosenId)?.balance ?? 0
  if (existing && existing.category_id === chosenId) {
    if (existing.type === 'fund_withdrawal') available += existing.amount
    if (existing.type === 'fund_deposit') available -= existing.amount
  }
  available = round2(available)
  const value = Math.round(parseFloat(amount) * 100) / 100
  const overdraws = mode === 'fund' && direction === 'withdraw' && chosenId !== null && value > available + 0.005

  function switchMode(next: Mode) {
    setMode(next)
    const nextKind = kindOfType(typeOf(next, direction))
    // categories belong to one kind; a bill payment has none at all
    if (categoryId && categories.find((c) => c.id === categoryId)?.kind !== nextKind) setCategoryId(null)
  }

  async function createStarter(starterKind: 'investment' | 'fund') {
    try {
      await addCategory.mutateAsync({ kind: starterKind, ...STARTER_HOLDINGS[starterKind], opening_balance: 0 })
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(value) || value <= 0) return toast('Enter a valid amount', 'error')
    if (kind && !chosenId) return toast(mode === 'fund' ? 'Pick a fund' : 'Pick a category', 'error')
    if (!date) return toast('Pick a date', 'error')

    const input = {
      type,
      amount: value,
      category_id: isBill ? null : chosenId,
      // only types that can go on the card keep 'credit'; everything else left your bank
      payment_method: canUseCredit(type) ? method : ('cash' as const),
      occurred_on: date,
      note: note.trim() || (isBill ? 'Credit card bill' : ''),
    }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, ...input })
      else await add.mutateAsync(input)
      onDone()
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  async function onDelete() {
    if (!existing) return
    try {
      await del.mutateAsync(existing.id)
      onDone()
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  const outstanding = credit?.outstanding ?? 0
  const submitLabel = existing
    ? 'Save changes'
    : isBill
      ? 'Record payment'
      : mode === 'investment'
        ? 'Add investment'
        : mode === 'fund'
          ? direction === 'deposit'
            ? 'Add to fund'
            : 'Withdraw from fund'
          : 'Add'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* what is being recorded */}
      <div
        className={`grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 ${
          modes.length === 5 ? 'grid-cols-5' : 'grid-cols-3'
        }`}
      >
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => switchMode(m.value)}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[11px] font-semibold transition-colors ${
              mode === m.value
                ? `bg-white shadow-sm dark:bg-slate-900 ${m.activeClass}`
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <m.icon className="size-4" />
            {m.label}
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

      {isHolding && (
        <p className="-mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {mode === 'investment'
            ? 'Investments are kept out of your spending — they show in their own section on the dashboard.'
            : 'Fund money is kept out of your spending — the dashboard shows the fund’s running balance.'}
        </p>
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

      {/* fund: which way the money moves */}
      {mode === 'fund' && (
        <div className="grid grid-cols-2 gap-2">
          <ChoiceButton
            active={direction === 'deposit'}
            onClick={() => setDirection('deposit')}
            icon={ArrowDownToLine}
            label="Deposit"
            hint="bank → fund"
          />
          <ChoiceButton
            active={direction === 'withdraw'}
            onClick={() => setDirection('withdraw')}
            icon={ArrowUpFromLine}
            label="Withdraw"
            hint="fund → bank"
          />
        </div>
      )}

      {/* paid with — for anything that can be charged to the card */}
      {canUseCredit(type) && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Paid with</span>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              active={method === 'cash'}
              onClick={() => setMethod('cash')}
              icon={Banknote}
              label="Cash"
              hint="cash, UPI, debit"
            />
            <ChoiceButton
              active={method === 'credit'}
              onClick={() => setMethod('credit')}
              icon={CreditCard}
              label="Credit"
              hint="pay at bill time"
            />
          </div>
        </div>
      )}

      {/* category / investment bucket / fund */}
      {kind && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">
            {mode === 'fund' ? 'Fund' : mode === 'investment' ? 'Invest in' : 'Category'}
          </span>
          {isHolding && options.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'fund' ? 'You don’t have a fund yet.' : 'You don’t have an investment category yet.'}
              </p>
              <button
                type="button"
                disabled={addCategory.isPending}
                onClick={() => createStarter(mode === 'fund' ? 'fund' : 'investment')}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {mode === 'fund'
                  ? `${STARTER_HOLDINGS.fund.icon} Create ${STARTER_HOLDINGS.fund.name}`
                  : `${STARTER_HOLDINGS.investment.icon} Create ${STARTER_HOLDINGS.investment.name}`}
              </button>
            </div>
          ) : (
            <CategoryPicker categories={categories} kind={kind} value={chosenId} onChange={setCategoryId} />
          )}
          {mode === 'fund' && chosenId && (
            <p
              className={`mt-2 text-xs ${
                overdraws ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {overdraws
                ? `That’s more than the ${formatMoney(available, currency)} in this fund.`
                : `Balance: ${formatMoney(available, currency)}`}
            </p>
          )}
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
            placeholder={isBill ? 'Credit card bill' : mode === 'investment' ? 'e.g. Index fund SIP' : 'e.g. Lunch with team'}
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
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function ChoiceButton({
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
