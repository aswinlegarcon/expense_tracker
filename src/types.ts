/** Expense and income categories describe money out and money in. Investment and
 *  fund categories are holdings: money you keep rather than spend. Each investment
 *  category is a bucket you invest into; each fund (e.g. Emergency fund) has a
 *  running balance. */
export type CategoryKind = 'expense' | 'income' | 'investment' | 'fund'

/** Only `expense` is spending. Every other outflow is a transfer and is excluded
 *  from spending totals, charts and budgets:
 *  - `card_payment` settles the credit-card bill — the purchases were already
 *    counted when charged, so counting the bill too would double-count.
 *  - `investment` moves money into an investment category.
 *  - `fund_deposit` / `fund_withdrawal` move money into / out of a fund. */
export type TxType = 'expense' | 'income' | 'card_payment' | 'investment' | 'fund_deposit' | 'fund_withdrawal'

/** Types a recurring rule may post. */
export type RecurringType = 'expense' | 'income' | 'investment' | 'fund_deposit'

/** How an outflow was paid: 'cash' means the money left immediately (cash, UPI,
 *  debit); 'credit' means it was charged to the card and leaves at bill time. */
export type PaymentMethod = 'cash' | 'credit'

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface Profile {
  id: string
  currency: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  kind: CategoryKind
  icon: string
  color: string
  is_archived: boolean
  sort_order: number
  /** Holdings only: amount held before tracking began. Absent until the
   *  database is on schema version 3. */
  opening_balance?: number
}

export interface Transaction {
  id: string
  user_id: string
  type: TxType
  amount: number
  category_id: string | null
  payment_method: PaymentMethod
  /** yyyy-MM-dd */
  occurred_on: string
  note: string
  recurring_rule_id: string | null
  created_at: string
}

export interface CreditSummary {
  /** Charged to the card minus bill payments; 0 means fully settled. */
  outstanding: number
  lifetime_charged: number
  lifetime_paid: number
  last_paid_on: string | null
  last_paid_amount: number | null
}

/** One investment or fund category, totalled over all history. */
export interface HoldingSummary {
  category_id: string
  kind: 'investment' | 'fund'
  name: string
  icon: string
  color: string
  is_archived: boolean
  opening_balance: number
  /** investments + fund deposits */
  deposited: number
  /** fund withdrawals */
  withdrawn: number
  /** opening + deposited − withdrawn. For investments: amount invested (cost), not market value. */
  balance: number
  last_activity: string | null
}

export interface Budget {
  id: string
  user_id: string
  /** null = overall monthly budget */
  category_id: string | null
  amount: number
}

export interface RecurringRule {
  id: string
  user_id: string
  type: RecurringType
  amount: number
  category_id: string | null
  payment_method: PaymentMethod
  note: string
  frequency: Frequency
  /** yyyy-MM-dd; carries the anchor day-of-month */
  start_date: string
  /** yyyy-MM-dd */
  next_occurrence: string
  end_date: string | null
  is_active: boolean
}
