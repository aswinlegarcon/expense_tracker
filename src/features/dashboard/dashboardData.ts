import { monthKey, todayISO } from '../../lib/dates'
import { round2 } from '../../lib/money'
import type { Category, Transaction } from '../../types'

export interface MonthTotals {
  month: string // yyyy-MM
  income: number
  expense: number
}

export interface CategorySlice {
  id: string
  name: string
  icon: string
  color: string
  amount: number
}

export type MoMTrend = 'up' | 'down' | 'same' | 'new'

export interface MoMRow {
  id: string
  name: string
  icon: string
  color: string
  current: number
  previous: number
  /** percentage change vs previous month; null when previous === 0 */
  pct: number | null
  trend: MoMTrend
}

/** Income/expense totals per month over the window, oldest first. */
export function monthlyTotals(tx: Transaction[], months: string[]): MonthTotals[] {
  const map = new Map<string, MonthTotals>(months.map((m) => [m, { month: m, income: 0, expense: 0 }]))
  for (const t of tx) {
    const row = map.get(monthKey(t.occurred_on))
    if (!row) continue
    // card_payment is a transfer, not income or spending — it must fall through
    if (t.type === 'income') row.income += t.amount
    else if (t.type === 'expense') row.expense += t.amount
  }
  return months.map((m) => {
    const r = map.get(m)!
    return { ...r, income: round2(r.income), expense: round2(r.expense) }
  })
}

/** Current-month expense breakdown by category, largest first, top N + Other. */
export function categoryBreakdown(
  tx: Transaction[],
  catById: Map<string, Category>,
  month: string,
  topN = 6,
): CategorySlice[] {
  const sums = new Map<string, number>()
  for (const t of tx) {
    if (t.type !== 'expense' || monthKey(t.occurred_on) !== month) continue
    const key = t.category_id ?? 'none'
    sums.set(key, (sums.get(key) ?? 0) + t.amount)
  }
  const slices: CategorySlice[] = [...sums.entries()]
    .map(([id, amount]) => {
      const c = id === 'none' ? undefined : catById.get(id)
      return {
        id,
        name: c?.name ?? 'Uncategorised',
        icon: c?.icon ?? '🏷️',
        color: c?.color ?? '#64748b',
        amount: round2(amount),
      }
    })
    .sort((a, b) => b.amount - a.amount)

  if (slices.length <= topN + 1) return slices
  const top = slices.slice(0, topN)
  const rest = slices.slice(topN)
  top.push({
    id: 'other',
    name: `Other (${rest.length})`,
    icon: '📦',
    color: '#94a3b8',
    amount: round2(rest.reduce((s, x) => s + x.amount, 0)),
  })
  return top
}

/** Month-over-month comparison of expense categories.
 *  Sorted: increases first (largest absolute delta first), then the rest. */
export function momComparison(
  tx: Transaction[],
  catById: Map<string, Category>,
  curMonth: string,
  prevMonth: string,
): MoMRow[] {
  const cur = new Map<string, number>()
  const prev = new Map<string, number>()
  for (const t of tx) {
    if (t.type !== 'expense') continue
    const m = monthKey(t.occurred_on)
    const key = t.category_id ?? 'none'
    if (m === curMonth) cur.set(key, (cur.get(key) ?? 0) + t.amount)
    else if (m === prevMonth) prev.set(key, (prev.get(key) ?? 0) + t.amount)
  }

  const ids = new Set([...cur.keys(), ...prev.keys()])
  const rows: MoMRow[] = []
  for (const id of ids) {
    const c = id === 'none' ? undefined : catById.get(id)
    const current = round2(cur.get(id) ?? 0)
    const previous = round2(prev.get(id) ?? 0)
    const delta = current - previous
    const pct = previous > 0 ? (delta / previous) * 100 : null
    const trend: MoMTrend =
      previous === 0
        ? 'new'
        : Math.abs(pct ?? 0) < 1
          ? 'same'
          : delta > 0
            ? 'up'
            : 'down'
    rows.push({
      id,
      name: c?.name ?? 'Uncategorised',
      icon: c?.icon ?? '🏷️',
      color: c?.color ?? '#64748b',
      current,
      previous,
      pct,
      trend,
    })
  }

  return rows.sort((a, b) => {
    const aUp = a.trend === 'up' || a.trend === 'new'
    const bUp = b.trend === 'up' || b.trend === 'new'
    if (aUp !== bUp) return aUp ? -1 : 1
    return Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous)
  })
}

/** Credit-card activity within a single month, for the card panel. */
export function creditMonthActivity(tx: Transaction[], month: string): { charged: number; paid: number } {
  let charged = 0
  let paid = 0
  for (const t of tx) {
    if (monthKey(t.occurred_on) !== month) continue
    if (t.type === 'expense' && t.payment_method === 'credit') charged += t.amount
    else if (t.type === 'card_payment') paid += t.amount
  }
  return { charged: round2(charged), paid: round2(paid) }
}

/** Cumulative expense by day-of-month for two months (for the pace chart). */
export function cumulativeByDay(
  tx: Transaction[],
  curMonth: string,
  prevMonth: string,
): { day: number; current: number | null; previous: number | null }[] {
  const daysIn = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()
  const curDays = daysIn(curMonth)
  const prevDays = daysIn(prevMonth)
  const today = todayISO()
  const todayDay = monthKey(today) === curMonth ? Number(today.slice(8, 10)) : curDays

  const curDaily = new Array<number>(curDays + 1).fill(0)
  const prevDaily = new Array<number>(prevDays + 1).fill(0)
  for (const t of tx) {
    if (t.type !== 'expense') continue
    const m = monthKey(t.occurred_on)
    const day = Number(t.occurred_on.slice(8, 10))
    if (m === curMonth) curDaily[day] += t.amount
    else if (m === prevMonth) prevDaily[day] += t.amount
  }

  const out: { day: number; current: number | null; previous: number | null }[] = []
  let curSum = 0
  let prevSum = 0
  for (let day = 1; day <= Math.max(curDays, prevDays); day++) {
    if (day <= curDays) curSum += curDaily[day]
    if (day <= prevDays) prevSum += prevDaily[day]
    out.push({
      day,
      current: day <= todayDay ? round2(curSum) : null,
      previous: day <= prevDays ? round2(prevSum) : null,
    })
  }
  return out
}
