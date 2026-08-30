import { Check, CreditCard } from 'lucide-react'
import { formatFullDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { CreditSummary } from '../../types'

interface Props {
  summary: CreditSummary
  /** this calendar month's card activity */
  month: { charged: number; paid: number }
  currency: string
  onPayBill: () => void
}

export default function CreditCardPanel({ summary, month, currency, onPayBill }: Props) {
  const outstanding = summary.outstanding
  const settled = Math.abs(outstanding) < 0.005
  const overpaid = outstanding < -0.005

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
          <CreditCard className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Credit card</h2>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {overpaid ? 'Credit balance on card' : 'Outstanding — still to pay'}
          </p>
          <p
            className={`truncate text-2xl font-bold tracking-tight ${
              settled
                ? 'text-emerald-600 dark:text-emerald-400'
                : overpaid
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-violet-700 dark:text-violet-300'
            }`}
          >
            {formatMoney(Math.abs(outstanding), currency)}
          </p>
        </div>
        {!settled && (
          <button
            onClick={onPayBill}
            className="shrink-0 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Pay bill
          </button>
        )}
      </div>

      {settled ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Check className="size-3.5" /> All settled — bill tallies
        </p>
      ) : overpaid ? (
        <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">
          You’ve paid more than you charged — this much sits as credit on the card.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500 dark:text-slate-400">Charged this month</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(month.charged, currency)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500 dark:text-slate-400">Paid this month</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(month.paid, currency)}</dd>
        </div>
        {summary.last_paid_on && summary.last_paid_amount !== null && (
          <div className="col-span-2 flex justify-between gap-2">
            <dt className="text-slate-500 dark:text-slate-400">Last payment</dt>
            <dd className="font-semibold tabular-nums">
              {formatMoney(summary.last_paid_amount, currency)}
              <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                · {formatFullDate(summary.last_paid_on)}
              </span>
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
