import { ChevronLeft, ChevronRight, Loader2, Target } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import EmptyState from '../../components/EmptyState'
import ProgressBar from '../../components/ProgressBar'
import Sheet from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useDeleteBudget, useUpsertBudget } from '../../data/mutations'
import { useBudgets, useCategories, useTransactions } from '../../data/queries'
import { formatMonth, monthEndISO, monthKey, monthStartISO, todayISO, type ISODate } from '../../lib/dates'
import { formatMoney, round2 } from '../../lib/money'
import type { Budget, Category } from '../../types'

interface EditTarget {
  category: Category | null // null = overall budget
  budget: Budget | undefined
}

export default function BudgetsPage({ currency }: { currency: string }) {
  const [monthStart, setMonthStart] = useState<ISODate>(monthStartISO(0))
  const [editing, setEditing] = useState<EditTarget | null>(null)

  const monthEnd = useMemo(() => monthEndISO(monthStart), [monthStart])
  const { data: categories = [] } = useCategories()
  const { data: budgets = [], isLoading } = useBudgets()
  const { data: tx = [] } = useTransactions(monthStart, monthEnd)

  const spentByCat = useMemo(() => {
    const m = new Map<string, number>()
    let total = 0
    for (const t of tx) {
      if (t.type !== 'expense') continue
      total += t.amount
      if (t.category_id) m.set(t.category_id, (m.get(t.category_id) ?? 0) + t.amount)
    }
    m.set('__total__', total)
    return m
  }, [tx])

  const overall = budgets.find((b) => b.category_id === null)
  const budgetByCat = useMemo(
    () => new Map(budgets.filter((b) => b.category_id).map((b) => [b.category_id!, b])),
    [budgets],
  )

  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.is_archived)
  const totalSpent = round2(spentByCat.get('__total__') ?? 0)
  const isCurrentMonth = monthKey(monthStart) === monthKey(todayISO())

  // budgeted categories first (by usage ratio desc), then the rest by spend
  const sorted = [...expenseCats].sort((a, b) => {
    const ba = budgetByCat.get(a.id)
    const bb = budgetByCat.get(b.id)
    if (!!ba !== !!bb) return ba ? -1 : 1
    if (ba && bb) {
      const ra = (spentByCat.get(a.id) ?? 0) / ba.amount
      const rb = (spentByCat.get(b.id) ?? 0) / bb.amount
      return rb - ra
    }
    return (spentByCat.get(b.id) ?? 0) - (spentByCat.get(a.id) ?? 0)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthStart(monthStartISO(-1, monthStart))}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="w-32 text-center text-sm font-semibold">{formatMonth(monthStart)}</span>
          <button
            onClick={() => setMonthStart(monthStartISO(1, monthStart))}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {/* overall budget */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Overall monthly budget</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {overall
                ? `${formatMoney(totalSpent, currency)} of ${formatMoney(overall.amount, currency)}`
                : 'No overall budget set'}
            </p>
          </div>
          <button
            onClick={() => setEditing({ category: null, budget: overall })}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {overall ? 'Edit' : 'Set budget'}
          </button>
        </div>
        {overall && (
          <div className="mt-3">
            <ProgressBar ratio={overall.amount > 0 ? totalSpent / overall.amount : 0} />
            {totalSpent > overall.amount && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                Over by {formatMoney(round2(totalSpent - overall.amount), currency)}
              </p>
            )}
          </div>
        )}
      </section>

      {/* per-category */}
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
      ) : expenseCats.length === 0 ? (
        <EmptyState icon={Target} title="No expense categories" hint="Add categories in Settings first." />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {sorted.map((c) => {
            const budget = budgetByCat.get(c.id)
            const spent = round2(spentByCat.get(c.id) ?? 0)
            const over = budget ? spent > budget.amount : false
            return (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{ backgroundColor: `${c.color}26` }}
                  >
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${over ? 'font-bold' : 'font-medium'}`}>{c.name}</span>
                    <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {budget
                        ? `${formatMoney(spent, currency)} of ${formatMoney(budget.amount, currency)}`
                        : `${formatMoney(spent, currency)} spent`}
                    </span>
                  </span>
                  <button
                    onClick={() => setEditing({ category: c, budget })}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {budget ? 'Edit' : 'Set'}
                  </button>
                </div>
                {budget && (
                  <div className="mt-2.5 pl-12">
                    <ProgressBar ratio={budget.amount > 0 ? spent / budget.amount : 0} color={c.color} />
                    {over && (
                      <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                        Over by {formatMoney(round2(spent - budget.amount), currency)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.category ? `Budget · ${editing.category.name}` : 'Overall monthly budget'}
      >
        {editing && <BudgetForm target={editing} currency={currency} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function BudgetForm({ target, currency, onDone }: { target: EditTarget; currency: string; onDone: () => void }) {
  const [amount, setAmount] = useState(target.budget ? String(target.budget.amount) : '')
  const upsert = useUpsertBudget()
  const del = useDeleteBudget()
  const toast = useToast()
  const busy = upsert.isPending || del.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Math.round(parseFloat(amount) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) return toast('Enter a valid amount', 'error')
    try {
      await upsert.mutateAsync({ category_id: target.category?.id ?? null, amount: value })
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    }
  }

  async function onRemove() {
    if (!target.budget) return
    try {
      await del.mutateAsync(target.budget.id)
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove', 'error')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Standing budget that applies every month{target.category ? ` to ${target.category.name}` : ' overall'}.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Monthly amount ({currency})</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-2xl font-bold tracking-tight outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700"
        />
      </label>
      <div className="flex gap-3">
        {target.budget && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Remove
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  )
}
