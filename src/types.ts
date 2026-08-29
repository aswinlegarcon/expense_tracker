export type TxType = 'expense' | 'income'
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
  kind: TxType
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
  /** yyyy-MM-dd */
  occurred_on: string
  note: string
  recurring_rule_id: string | null
  created_at: string
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
  type: TxType
  amount: number
  category_id: string | null
  note: string
  frequency: Frequency
  /** yyyy-MM-dd; carries the anchor day-of-month */
  start_date: string
  /** yyyy-MM-dd */
  next_occurrence: string
  end_date: string | null
  is_active: boolean
}
