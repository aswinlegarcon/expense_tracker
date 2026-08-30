/** Categories only ever describe money in or money out. */
export type CategoryKind = 'expense' | 'income'

/** `card_payment` settles the credit-card bill. It moves money out of your bank
 *  but is NOT spending — the spending was already recorded when each item was
 *  charged to the card, so counting it again would double-count. It is excluded
 *  from every total, chart and budget, and only reduces the card's outstanding. */
export type TxType = CategoryKind | 'card_payment'

/** How an expense was paid: 'cash' means the money left immediately (cash, UPI,
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
  type: CategoryKind
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
