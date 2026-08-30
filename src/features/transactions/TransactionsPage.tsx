import { ChevronLeft, ChevronRight, CreditCard, ReceiptText, Repeat, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import EmptyState from '../../components/EmptyState'
import Sheet from '../../components/Sheet'
import { useCategories, useTransactions } from '../../data/queries'
import { formatDay, formatMonth, monthEndISO, monthKey, monthStartISO, todayISO, type ISODate } from '../../lib/dates'
import { formatMoney, round2 } from '../../lib/money'
import type { Category, PaymentMethod, Transaction, TxType } from '../../types'
import TransactionForm from './TransactionForm'

type TypeFilter = 'all' | TxType
type MethodFilter = 'all' | PaymentMethod

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'card_payment', label: 'Card bill' },
]

export default function TransactionsPage({ currency }: { currency: string }) {
  const [monthStart, setMonthStart] = useState<ISODate>(monthStartISO(0))
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const monthEnd = useMemo(() => monthEndISO(monthStart), [monthStart])

  const { data: categories = [] } = useCategories()
  const { data: transactions, isLoading } = useTransactions(monthStart, monthEnd)

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (transactions ?? []).filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      // a bill payment has no payment method of its own — hide it when filtering by one
      if (methodFilter !== 'all' && (t.type !== 'expense' || t.payment_method !== methodFilter)) return false
      if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false
      if (q) {
        const cat = t.category_id ? catById.get(t.category_id)?.name.toLowerCase() : ''
        if (!t.note.toLowerCase().includes(q) && !cat?.includes(q)) return false
      }
      return true
    })
  }, [transactions, typeFilter, methodFilter, categoryFilter, search, catById])

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const list = byDay.get(t.occurred_on) ?? []
      list.push(t)
      byDay.set(t.occurred_on, list)
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  const isCurrentMonth = monthKey(monthStart) === monthKey(todayISO())

  return (
    <div className="space-y-4">
      {/* month pager */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
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

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                typeFilter === t.value
                  ? 'bg-white shadow-sm dark:bg-slate-900'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
          {(['all', 'cash', 'credit'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize ${
                methodFilter === m ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {m === 'all' ? 'Any pay' : m}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">All categories</option>
          {categories
            .filter((c) => !c.is_archived && (typeFilter === 'all' || c.kind === typeFilter))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
        </select>
        <label className="relative min-w-40 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search note or category"
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {/* list */}
      {isLoading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No transactions"
          hint={
            transactions?.length
              ? 'Nothing matches the current filters.'
              : 'Add your first one with the + button.'
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([day, items]) => (
            <DayGroup
              key={day}
              day={day}
              items={items}
              catById={catById}
              currency={currency}
              onEdit={setEditing}
            />
          ))}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && (
          <TransactionForm
            categories={categories}
            existing={editing}
            currency={currency}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

function DayGroup({
  day,
  items,
  catById,
  currency,
  onEdit,
}: {
  day: string
  items: Transaction[]
  catById: Map<string, Category>
  currency: string
  onEdit: (t: Transaction) => void
}) {
  const spent = round2(items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0))

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {formatDay(day)}
        </h3>
        {spent > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">−{formatMoney(spent, currency)}</span>
        )}
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {items.map((t) => {
          const isBill = t.type === 'card_payment'
          const cat = t.category_id ? catById.get(t.category_id) : undefined
          return (
            <button
              key={t.id}
              onClick={() => onEdit(t)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                style={{ backgroundColor: isBill ? '#8b5cf626' : `${cat?.color ?? '#64748b'}26` }}
              >
                {isBill ? <CreditCard className="size-4 text-violet-600 dark:text-violet-400" /> : (cat?.icon ?? '🏷️')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {isBill ? 'Credit card bill' : (cat?.name ?? 'Uncategorised')}
                  {t.recurring_rule_id && <Repeat className="size-3 shrink-0 text-slate-400" />}
                  {t.type === 'expense' && t.payment_method === 'credit' && (
                    <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-px text-[9px] font-bold tracking-wide text-violet-700 uppercase dark:bg-violet-950/60 dark:text-violet-300">
                      Credit
                    </span>
                  )}
                </span>
                {t.note && <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{t.note}</span>}
              </span>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  isBill
                    ? 'text-violet-600 dark:text-violet-400'
                    : t.type === 'expense'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {t.type === 'income' ? '+' : '−'}
                {formatMoney(t.amount, currency)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
      ))}
    </div>
  )
}
