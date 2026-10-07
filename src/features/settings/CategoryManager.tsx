import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ArrowRightLeft, Loader2, Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Sheet from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useAddCategory, useMoveCategory, useUpdateCategory } from '../../data/mutations'
import { previewMove, useBudgets, useCategories, useHasHoldings, useHoldings } from '../../data/queries'
import { errorText } from '../../lib/errors'
import { formatMoney, round2 } from '../../lib/money'
import { isMovableKind, type MovableKind } from '../../lib/txKinds'
import type { Category, CategoryKind } from '../../types'

const TABS: { kind: CategoryKind; label: string; holdings?: true }[] = [
  { kind: 'expense', label: 'Expense' },
  { kind: 'income', label: 'Income' },
  { kind: 'investment', label: 'Invest', holdings: true },
  { kind: 'fund', label: 'Funds', holdings: true },
]

const TAB_HINT: Partial<Record<CategoryKind, string>> = {
  investment: 'Where you invest each month. Kept out of spending; totals show on the dashboard.',
  fund: 'Money set aside, like an emergency fund. Each fund keeps a running balance.',
}

/** What entries in each kind count as, for the move confirmation. */
const KIND_NOUN: Record<MovableKind, string> = {
  expense: 'spending',
  investment: 'investments',
  fund: 'fund deposits',
}

export default function CategoryManager({ currency }: { currency: string }) {
  const { data: categories = [] } = useCategories()
  const { data: holdings = [] } = useHoldings()
  const hasHoldings = useHasHoldings()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)
  const update = useUpdateCategory()
  const toast = useToast()

  const list = categories.filter((c) => c.kind === kind)
  const balanceOf = new Map(holdings.map((h) => [h.category_id, h.balance]))
  const isHoldingTab = kind === 'investment' || kind === 'fund'

  async function toggleArchive(c: Category) {
    try {
      await update.mutateAsync({ id: c.id, is_archived: !c.is_archived })
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  function close() {
    setAdding(false)
    setEditing(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
          {TABS.filter((t) => hasHoldings || !t.holdings).map((t) => (
            <button
              key={t.kind}
              onClick={() => setKind(t.kind)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                kind === t.kind ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.label}
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

      {TAB_HINT[kind] && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{TAB_HINT[kind]}</p>}

      {list.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
          {isHoldingTab
            ? 'None yet. Add one, or open an expense category you already use for this and choose “Counts as”.'
            : 'No categories yet.'}
        </p>
      ) : (
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
              {isHoldingTab ? (
                <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {formatMoney(balanceOf.get(c.id) ?? 0, currency)}
                </span>
              ) : (
                <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
              )}
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
      )}

      <Sheet
        open={adding || !!editing}
        onClose={close}
        title={editing ? `Edit ${editing.name}` : `New ${TABS.find((t) => t.kind === kind)?.label.toLowerCase()} category`}
      >
        <CategoryForm
          key={editing?.id ?? 'new'}
          kind={editing?.kind ?? kind}
          existing={editing ?? undefined}
          currency={currency}
          onDone={close}
          onMoved={(target) => {
            setKind(target)
            close()
          }}
        />
      </Sheet>
    </div>
  )
}

function CategoryForm({
  kind,
  existing,
  currency,
  onDone,
  onMoved,
}: {
  kind: CategoryKind
  existing?: Category
  currency: string
  onDone: () => void
  onMoved: (kind: CategoryKind) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? '🏷️')
  const [color, setColor] = useState(existing?.color ?? '#64748b')
  const [balanceInput, setBalanceInput] = useState<string | null>(null)
  const add = useAddCategory()
  const update = useUpdateCategory()
  const toast = useToast()
  const hasHoldings = useHasHoldings()
  const { data: holdings = [] } = useHoldings()
  const busy = add.isPending || update.isPending

  const isHolding = kind === 'investment' || kind === 'fund'
  const holding = existing ? holdings.find((h) => h.category_id === existing.id) : undefined
  // Entries already recorded here. The person types the real total today and we keep
  // only the part that predates tracking, so recorded entries are never counted twice.
  const tracked = holding ? round2(holding.deposited - holding.withdrawn) : 0
  const balanceShown = balanceInput ?? (holding ? String(holding.balance) : '')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return toast('Enter a name', 'error')

    let opening: number | undefined
    if (isHolding && hasHoldings) {
      const total = balanceShown.trim() === '' ? tracked : Math.round(parseFloat(balanceShown) * 100) / 100
      if (!Number.isFinite(total) || total < 0) return toast('Enter a valid amount', 'error')
      opening = round2(total - tracked)
      if (opening < 0) {
        return toast(
          kind === 'fund'
            ? `That’s less than the ${formatMoney(tracked, currency)} already recorded here — record a withdrawal instead.`
            : `That’s less than the ${formatMoney(tracked, currency)} already recorded here.`,
          'error',
        )
      }
    }

    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          name: trimmed,
          icon,
          color,
          ...(opening !== undefined ? { opening_balance: opening } : {}),
        })
      } else {
        await add.mutateAsync({ name: trimmed, kind, icon, color, ...(opening !== undefined ? { opening_balance: opening } : {}) })
      }
      onDone()
    } catch (err) {
      const msg = errorText(err)
      toast(msg.includes('duplicate') ? 'A category with that name already exists' : msg, 'error')
    }
  }

  return (
    <div className="space-y-6">
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
              placeholder={kind === 'fund' ? 'e.g. Emergency fund' : kind === 'investment' ? 'e.g. Index funds' : 'e.g. Pets'}
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700"
            />
          </label>
        </div>

        {isHolding && hasHoldings && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {kind === 'fund' ? 'Current balance' : 'Total invested so far'} ({currency})
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={balanceShown}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-slate-700"
            />
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
              {tracked > 0
                ? `Include everything — the ${formatMoney(tracked, currency)} already recorded here is counted once.`
                : kind === 'fund'
                  ? 'What’s in the fund today. Leave 0 if you’re starting fresh.'
                  : 'Anything you invested before you started tracking. Leave 0 if starting fresh.'}
            </span>
          </label>
        )}

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

      {existing && hasHoldings && isMovableKind(existing.kind) && (
        <MoveSection category={existing} from={existing.kind} currency={currency} onMoved={onMoved} />
      )}
    </div>
  )
}

const MOVE_OPTIONS: { kind: MovableKind; label: string }[] = [
  { kind: 'expense', label: 'Expense' },
  { kind: 'investment', label: 'Investment' },
  { kind: 'fund', label: 'Fund' },
]

/** Re-file a category (and every entry in it) as expense, investment or fund. */
function MoveSection({
  category,
  from,
  currency,
  onMoved,
}: {
  category: Category
  from: MovableKind
  currency: string
  onMoved: (kind: CategoryKind) => void
}) {
  const [target, setTarget] = useState<MovableKind>(from)
  const move = useMoveCategory()
  const toast = useToast()
  const { data: budgets = [] } = useBudgets()
  const changing = target !== from

  const preview = useQuery({
    queryKey: ['move-preview', category.id, target],
    queryFn: () => previewMove(category.id, target),
    enabled: changing,
    staleTime: 0,
  })

  const hasBudget = budgets.some((b) => b.category_id === category.id)
  const count = preview.data?.count ?? 0
  const amount = preview.data?.total != null ? ` (${formatMoney(preview.data.total, currency)})` : ''
  const entries = `${count} past ${count === 1 ? 'entry' : 'entries'}${amount}`

  let effect: string
  if (from === 'expense') {
    effect = `${entries} will count as ${KIND_NOUN[target]} instead of spending, so earlier months’ Spent goes down by that much and Net savings goes up.`
  } else if (target === 'expense') {
    effect = `${entries} will count as spending again, so earlier months’ Spent goes up by that much.`
  } else {
    effect = `${entries} will move from ${KIND_NOUN[from]} to ${KIND_NOUN[target]}. Spending is not affected.`
  }

  async function confirm() {
    try {
      const n = await move.mutateAsync({ id: category.id, kind: target })
      toast(`Moved ${n} ${n === 1 ? 'entry' : 'entries'} — “${category.name}” now counts as ${KIND_NOUN[target]}`)
      onMoved(target)
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  return (
    <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <ArrowRightLeft className="size-4 text-slate-400" /> Counts as
      </div>
      <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {MOVE_OPTIONS.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => setTarget(o.kind)}
            className={`rounded-md py-1.5 text-xs font-semibold ${
              target === o.kind ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {o.label}
            {o.kind === from && <span className="font-normal text-slate-400"> · now</span>}
          </button>
        ))}
      </div>

      {changing && (
        <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {preview.isLoading ? (
            <p className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Checking entries…
            </p>
          ) : preview.isError ? (
            <p>{errorText(preview.error)}</p>
          ) : (
            <>
              <p>
                <span className="font-semibold">Move “{category.name}”?</span> {effect}
              </p>
              <p>
                Nothing is deleted and amounts, dates and notes stay exactly the same. You can move it back any time.
                {hasBudget && from === 'expense' && ' Its monthly budget is kept, hidden while it isn’t an expense.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTarget(from)}
                  className="flex-1 rounded-lg border border-amber-300 py-2 font-semibold hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={move.isPending}
                  onClick={confirm}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {move.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Move
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
