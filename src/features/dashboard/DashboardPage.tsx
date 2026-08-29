import { ArrowDownRight, ArrowUpRight, LayoutDashboard, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../../components/EmptyState'
import StatCard from '../../components/StatCard'
import { useCategories, useTransactions } from '../../data/queries'
import { formatMonth, formatShortMonth, monthEndISO, monthKey, monthStartISO } from '../../lib/dates'
import { formatMoney, formatMoneyCompact, round2 } from '../../lib/money'
import { ChartCard, ChartTip, LegendChips } from './ChartBits'
import {
  categoryBreakdown,
  cumulativeByDay,
  momComparison,
  monthlyTotals,
  type MoMRow,
} from './dashboardData'

const WINDOW = 6 // months

export default function DashboardPage({ currency }: { currency: string }) {
  const from = useMemo(() => monthStartISO(-(WINDOW - 1)), [])
  const to = useMemo(() => monthEndISO(monthStartISO(0)), [])
  const { data: tx = [], isLoading } = useTransactions(from, to)
  const { data: categories = [] } = useCategories()

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const months = useMemo(
    () => Array.from({ length: WINDOW }, (_, i) => monthKey(monthStartISO(i - (WINDOW - 1)))),
    [],
  )
  const curMonth = months[WINDOW - 1]
  const prevMonth = months[WINDOW - 2]

  const totals = useMemo(() => monthlyTotals(tx, months), [tx, months])
  const slices = useMemo(() => categoryBreakdown(tx, catById, curMonth), [tx, catById, curMonth])
  const mom = useMemo(() => momComparison(tx, catById, curMonth, prevMonth), [tx, catById, curMonth, prevMonth])
  const pace = useMemo(() => cumulativeByDay(tx, curMonth, prevMonth), [tx, curMonth, prevMonth])

  const cur = totals[WINDOW - 1]
  const prev = totals[WINDOW - 2]
  const net = round2(cur.income - cur.expense)
  const spentPct = prev.expense > 0 ? ((cur.expense - prev.expense) / prev.expense) * 100 : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{formatMonth(curMonth)}</span>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Spent this month"
          value={formatMoney(cur.expense, currency)}
          icon={TrendingDown}
          tone="red"
          sub={
            spentPct !== null && Math.abs(spentPct) >= 1 ? (
              <span
                className={`inline-flex items-center gap-0.5 font-medium ${
                  spentPct > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {spentPct > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(spentPct).toFixed(0)}% vs last month
              </span>
            ) : (
              'vs ' + formatMoney(prev.expense, currency) + ' last month'
            )
          }
        />
        <StatCard label="Income" value={formatMoney(cur.income, currency)} icon={TrendingUp} tone="green" />
        <StatCard
          label="Net savings"
          value={formatMoney(net, currency)}
          icon={PiggyBank}
          tone="blue"
          sub={net < 0 ? <span className="text-red-500">spending exceeds income</span> : 'income − expenses'}
        />
      </div>

      {tx.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No data yet"
          hint="Add your first transaction with the + button and the charts will light up."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MoMList rows={mom} currency={currency} />
          <Donut slices={slices} total={cur.expense} currency={currency} />
          <MonthBars totals={totals} currency={currency} />
          <PaceLines pace={pace} currency={currency} curMonth={curMonth} prevMonth={prevMonth} />
        </div>
      )}
    </div>
  )
}

/** The explicit requirement: categories that increased vs last month are bolded,
 *  tinted, badged with a red rising arrow, and sorted to the top. */
function MoMList({ rows, currency }: { rows: MoMRow[]; currency: string }) {
  return (
    <ChartCard title="Where spending changed" sub="This month vs all of last month, per category">
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">No expenses in either month yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => {
            const up = r.trend === 'up'
            const isNew = r.trend === 'new'
            return (
              <li
                key={r.id}
                className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 ${
                  up ? 'bg-red-50/70 dark:bg-red-950/25' : ''
                }`}
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ backgroundColor: `${r.color}26` }}
                >
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${up || isNew ? 'font-bold' : 'font-medium'}`}>
                    {r.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    last month {formatMoney(r.previous, currency)}
                  </span>
                </span>
                <span className="text-right">
                  <span className={`block text-sm tabular-nums ${up || isNew ? 'font-bold' : 'font-medium'}`}>
                    {formatMoney(r.current, currency)}
                  </span>
                  <MoMBadge row={r} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </ChartCard>
  )
}

function MoMBadge({ row }: { row: MoMRow }) {
  if (row.trend === 'new')
    return (
      <span className="inline-flex rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-400">
        New
      </span>
    )
  if (row.trend === 'same')
    return <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">≈ same</span>
  const up = row.trend === 'up'
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${
        up ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
      }`}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {row.pct === null ? '' : `${Math.abs(row.pct).toFixed(0)}%`}
    </span>
  )
}

function Donut({
  slices,
  total,
  currency,
}: {
  slices: ReturnType<typeof categoryBreakdown>
  total: number
  currency: string
}) {
  return (
    <ChartCard title="Spending by category" sub="This month">
      {slices.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">No expenses this month yet.</p>
      ) : (
        <>
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.id} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Total
              </span>
              <span className="text-lg font-bold tracking-tight">{formatMoney(total, currency)}</span>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {slices.map((s) => (
              <li key={s.id} className="flex min-w-0 items-center gap-1.5 text-xs">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate text-slate-500 dark:text-slate-400">{s.name}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatMoney(s.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  )
}

function MonthBars({ totals, currency }: { totals: ReturnType<typeof monthlyTotals>; currency: string }) {
  const data = totals.map((t) => ({ ...t, label: formatShortMonth(t.month) }))
  return (
    <ChartCard title="Income vs expenses" sub="Last 6 months">
      <LegendChips
        items={[
          { label: 'Income', color: 'var(--chart-income)' },
          { label: 'Expenses', color: 'var(--chart-expense)' },
        ]}
      />
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              tickFormatter={(v: number) => formatMoneyCompact(v, currency)}
            />
            <Tooltip
              cursor={{ fill: 'var(--chart-grid)', opacity: 0.35 }}
              content={<ChartTip currency={currency} />}
            />
            <Bar dataKey="income" name="Income" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar
              dataKey="expense"
              name="Expenses"
              fill="var(--chart-expense)"
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function PaceLines({
  pace,
  currency,
  curMonth,
  prevMonth,
}: {
  pace: ReturnType<typeof cumulativeByDay>
  currency: string
  curMonth: string
  prevMonth: string
}) {
  return (
    <ChartCard title="Spending pace" sub="Cumulative spend by day of month — like-for-like comparison">
      <LegendChips
        items={[
          { label: formatMonth(curMonth), color: 'var(--chart-cur)' },
          { label: formatMonth(prevMonth), color: 'var(--chart-prev)', dashed: true },
        ]}
      />
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pace} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="day"
              ticks={[1, 5, 10, 15, 20, 25, 30]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              tickFormatter={(v: number) => formatMoneyCompact(v, currency)}
            />
            <Tooltip
              cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<ChartTip currency={currency} labelText={(d) => `Day ${d}`} />}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name={formatMonth(prevMonth)}
              stroke="var(--chart-prev)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name={formatMonth(curMonth)}
              stroke="var(--chart-cur)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
