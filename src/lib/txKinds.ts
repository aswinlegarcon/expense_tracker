import type { CategoryKind, TxType } from '../types'

/** Single source of truth for how each transaction type behaves. Code elsewhere
 *  should ask these helpers rather than test `type === 'expense' ? … : …`, which
 *  silently misfiles every type that isn't expense or income. */

/** Types that may be charged to the credit card. Must match the database check
 *  `transactions_credit_outflow_check` and the "charged" filter in `credit_summary()`. */
const CREDIT_TYPES: ReadonlySet<TxType> = new Set<TxType>(['expense', 'investment', 'fund_deposit'])

export function canUseCredit(type: TxType): boolean {
  return CREDIT_TYPES.has(type)
}

/** Money leaving your bank account, as opposed to coming in. */
export function isOutflow(type: TxType): boolean {
  return type !== 'income' && type !== 'fund_withdrawal'
}

/** The category kind a transaction type is filed under (card bills have none). */
export function kindOfType(type: TxType): CategoryKind | null {
  switch (type) {
    case 'expense':
    case 'income':
    case 'investment':
      return type
    case 'fund_deposit':
    case 'fund_withdrawal':
      return 'fund'
    case 'card_payment':
      return null
  }
}

/** Kinds a category can be moved between (income never moves). */
export type MovableKind = 'expense' | 'investment' | 'fund'

export function isMovableKind(kind: CategoryKind): kind is MovableKind {
  return kind !== 'income'
}

/** The type a category's money-out entries take in each kind — mirrors move_category(). */
export function outflowTypeOf(kind: MovableKind): TxType {
  return kind === 'fund' ? 'fund_deposit' : kind
}

export function signOf(type: TxType): '+' | '−' {
  return isOutflow(type) ? '−' : '+'
}

interface TypeMeta {
  /** readable name, also used in CSV export */
  label: string
  /** amount colour; literal class strings so Tailwind's scanner keeps them */
  amountClass: string
  /** small badge shown next to the category name in lists */
  chip?: { text: string; className: string }
}

const INVEST_CHIP = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
const FUND_CHIP = 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'

export const TYPE_META: Record<TxType, TypeMeta> = {
  expense: { label: 'expense', amountClass: 'text-red-600 dark:text-red-400' },
  income: { label: 'income', amountClass: 'text-emerald-600 dark:text-emerald-400' },
  card_payment: { label: 'card bill payment', amountClass: 'text-violet-600 dark:text-violet-400' },
  investment: {
    label: 'investment',
    amountClass: 'text-indigo-600 dark:text-indigo-400',
    chip: { text: 'Invest', className: INVEST_CHIP },
  },
  fund_deposit: {
    label: 'fund deposit',
    amountClass: 'text-sky-600 dark:text-sky-400',
    chip: { text: 'Deposit', className: FUND_CHIP },
  },
  fund_withdrawal: {
    label: 'fund withdrawal',
    amountClass: 'text-sky-600 dark:text-sky-400',
    chip: { text: 'Withdrawal', className: FUND_CHIP },
  },
}

/** Ready-made holdings for the "create one for me" shortcuts and fresh installs. */
export const STARTER_HOLDINGS = {
  investment: { name: 'Investments', icon: '📊', color: '#7c3aed' },
  fund: { name: 'Emergency fund', icon: '🛟', color: '#0d9488' },
} as const
