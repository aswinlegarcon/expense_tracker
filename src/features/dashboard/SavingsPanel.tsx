import { ArrowRightLeft, Loader2, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useToast } from '../../components/Toast'
import { useAddCategory } from '../../data/mutations'
import { useHoldings } from '../../data/queries'
import { formatShortMonth } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { formatMoney, formatMoneyCompact, round2 } from '../../lib/money'
import { STARTER_HOLDINGS } from '../../lib/txKinds'
import type { HoldingSummary, Transaction } from '../../types'
import { ChartCard, ChartTip } from './ChartBits'
import { fundNetByCategory, holdingFlows, investedByMonth } from './dashboardData'

interface Props {
  tx: Transaction[]
  months: string[]
  curMonth: string
  /** this month's income and expenses */
  income: number
  expense: number
  currency: string
}

/** Investments and funds, kept apart from spending: fund balances, where this
 *  month's savings went, and how much has been invested where. */
export default function SavingsPanel({ tx, months, curMonth, income, expense, currency }: Props) {
  const { data: holdings, isLoading } = useHoldings()
  if (isLoading || !holdings) return null

  const funds = holdings.filter((h) => h.kind === 'fund' && (!h.is_archived || h.balance !== 0))
  const investments = holdings.filter((h) => h.kind === 'investment' && (!h.is_archived || h.balance !== 0))
  const flows = holdingFlows(tx, curMonth)

  if (funds.length === 0 && investments.length === 0) return <StartCard />

  return (
    <section aria-label="Savings and investments" className="grid gap-4 lg:grid-cols-2">
      <FundCard funds={funds} net={fundNetByCategory(tx, curMonth)} currency={currency} />
      <AllocationCard
        saved={round2(income - expense)}
        invested={flows.invested}
        toFunds={round2(flows.fundIn - flows.fundOut)}
        currency={currency}
      />
      <InvestmentsCard
        investments={investments}
        thisMonth={flows.invested}
        byMonth={investedByMonth(tx, months)}
        currency={currency}
      />
    </section>
  )
}

function StartCard() {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <ArrowRightLeft className="mt-0.5 size-5 shrink-0 text-indigo-500" />
      <div className="text-sm">
        <p className="font-semibold">Track investments and your emergency fund separately</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Already logging them as expenses? Open <span className="font-medium">Settings → Categories</span>, tap the
          category and change <span className="font-medium">Counts as</span> — past entries move over too. Or add new
          ones from the Invest and Funds tabs.
        </p>
      </div>
    </section>
  )
}

function FundCard({
  funds,
  net,
  currency,
}: {
  funds: HoldingSummary[]
  net: Map<string, number>
  currency: string
}) {
  const add = useAddCategory()
  const toast = useToast()

  if (funds.length === 0) {
    return (
      <ChartCard title="Emergency fund" sub="Money set aside, kept out of spending">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">No fund yet.</p>
          <button
            disabled={add.isPending}
            onClick={() =>
              add
                .mutateAsync({ kind: 'fund', ...STARTER_HOLDINGS.fund, opening_balance: 0 })
                .catch((err) => toast(errorText(err), 'error'))
            }
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {add.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {STARTER_HOLDINGS.fund.icon} Create {STARTER_HOLDINGS.fund.name}
          </button>
        </div>
      </ChartCard>
    )
  }

  const [main, ...others] = funds
  return (
    <ChartCard title={funds.length === 1 ? main.name : 'Funds'} sub="Current balance">
      <FundRow fund={main} change={net.get(main.category_id) ?? 0} currency={currency} hero />
      {others.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {others.map((f) => (
            <li key={f.category_id}>
              <FundRow fund={f} change={net.get(f.category_id) ?? 0} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}

function FundRow({
  fund,
  change,
  currency,
  hero,
}: {
  fund: HoldingSummary
  change: number
  currency: string
  hero?: boolean
}) {
  const delta =
    Math.abs(change) < 0.005 ? null : (
      <span
        className={`text-xs font-medium ${
          change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
        }`}
      >
        {change > 0 ? '+' : '−'}
        {formatMoney(Math.abs(change), currency)} this month
      </span>
    )
  if (hero) {
    return (
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-3xl font-bold tracking-tight">{formatMoney(fund.balance, currency)}</p>
          <div className="mt-1">{delta ?? <span className="text-xs text-slate-400">No change this month</span>}</div>
        </div>
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${fund.color}26` }}
        >
          {fund.icon}
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{fund.icon}</span>
      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{fund.name}</span>
      {delta}
      <span className="font-semibold tabular-nums">{formatMoney(fund.balance, currency)}</span>
    </div>
  )
}

/** Part-to-whole: how this month's net savings split between investing, funds and
 *  what stayed in the bank. One stacked bar, direct-labelled by the legend below. */
function AllocationCard({
  saved,
  invested,
  toFunds,
  currency,
}: {
  saved: number
  invested: number
  toFunds: number
  currency: string
}) {
  const movedOut = round2(invested + Math.max(0, toFunds))
  const kept = round2(saved - invested - toFunds)
  const fromEarlier = round2(movedOut - Math.max(0, saved))

  const segments = [
    { key: 'invest', label: 'Invested', value: invested, color: 'var(--chart-invest)' },
    { key: 'fund', label: 'To funds', value: Math.max(0, toFunds), color: 'var(--chart-fund)' },
    { key: 'kept', label: 'Kept in bank', value: Math.max(0, kept), color: 'var(--chart-kept)' },
  ].filter((s) => s.value > 0)
  const whole = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <ChartCard title="Where this month’s savings went" sub="Net savings = income − expenses">
      <p className="text-sm">
        Saved <span className="font-bold tabular-nums">{formatMoney(saved, currency)}</span>
        {saved > 0 && <span className="text-slate-400"> this month</span>}
      </p>

      {whole > 0 ? (
        <>
          <div className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded">
            {segments.map((s) => (
              <div
                key={s.key}
                title={`${s.label}: ${formatMoney(s.value, currency)}`}
                className="h-full min-w-[2px]"
                style={{ width: `${(s.value / whole) * 100}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="text-slate-500 dark:text-slate-400">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatMoney(s.value, currency)}</span>
                <span className="w-9 text-right text-slate-400 tabular-nums">{Math.round((s.value / whole) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Nothing saved or moved yet this month.</p>
      )}

      {fromEarlier > 0.005 && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          You moved {formatMoney(movedOut, currency)} into investments and funds —{' '}
          {formatMoney(fromEarlier, currency)} more than this month’s savings, so it came from earlier savings.
        </p>
      )}
      {toFunds < -0.005 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Net {formatMoney(Math.abs(toFunds), currency)} taken out of funds this month.
        </p>
      )}
    </ChartCard>
  )
}

function InvestmentsCard({
  investments,
  thisMonth,
  byMonth,
  currency,
}: {
  investments: HoldingSummary[]
  thisMonth: number
  byMonth: { month: string; invested: number }[]
  currency: string
}) {
  const total = round2(investments.reduce((sum, h) => sum + h.balance, 0))
  const data = byMonth.map((m) => ({ ...m, label: formatShortMonth(m.month) }))
  const sorted = [...investments].sort((a, b) => b.balance - a.balance)

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="size-4 text-indigo-500" /> Investments
          </h2>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Amount invested (cost), all time</p>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-bold tracking-tight tabular-nums">{formatMoney(total, currency)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMoney(thisMonth, currency)} this month
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* split by investment category: identity carried by the name, share by the meter */}
        <ul className="space-y-3">
          {sorted.length === 0 && <li className="text-xs text-slate-400">No investment categories yet.</li>}
          {sorted.map((h) => {
            const share = total > 0 ? h.balance / total : 0
            return (
              <li key={h.category_id}>
                <div className="flex items-center gap-2 text-sm">
                  <span>{h.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{h.name}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(h.balance, currency)}</span>
                  <span className="w-9 text-right text-xs text-slate-400 tabular-nums">{Math.round(share * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: h.color }} />
                </div>
              </li>
            )
          })}
        </ul>

        {/* one series, so the title names it and no legend is needed */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Invested per month</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
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
                <Bar
                  dataKey="invested"
                  name="Invested"
                  fill="var(--chart-invest)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

