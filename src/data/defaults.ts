import type { TxType } from '../types'

/** Mirrors the seed in supabase/schema.sql handle_new_user(); used as the
 *  client-side fallback when the account predates the SQL script. */
export const DEFAULT_CATEGORIES: { name: string; kind: TxType; icon: string; color: string; sort_order: number }[] = [
  { kind: 'expense', name: 'Food & Dining', icon: '🍽️', color: '#f97316', sort_order: 1 },
  { kind: 'expense', name: 'Groceries', icon: '🛒', color: '#84cc16', sort_order: 2 },
  { kind: 'expense', name: 'Transport', icon: '🚗', color: '#06b6d4', sort_order: 3 },
  { kind: 'expense', name: 'Rent & Home', icon: '🏠', color: '#8b5cf6', sort_order: 4 },
  { kind: 'expense', name: 'Utilities & Bills', icon: '💡', color: '#eab308', sort_order: 5 },
  { kind: 'expense', name: 'Shopping', icon: '🛍️', color: '#ec4899', sort_order: 6 },
  { kind: 'expense', name: 'Entertainment', icon: '🎬', color: '#f43f5e', sort_order: 7 },
  { kind: 'expense', name: 'Health', icon: '💊', color: '#10b981', sort_order: 8 },
  { kind: 'expense', name: 'Education', icon: '📚', color: '#3b82f6', sort_order: 9 },
  { kind: 'expense', name: 'Travel', icon: '✈️', color: '#14b8a6', sort_order: 10 },
  { kind: 'expense', name: 'Subscriptions', icon: '📺', color: '#6366f1', sort_order: 11 },
  { kind: 'expense', name: 'Other', icon: '📦', color: '#64748b', sort_order: 12 },
  { kind: 'income', name: 'Salary', icon: '💼', color: '#22c55e', sort_order: 1 },
  { kind: 'income', name: 'Freelance', icon: '💻', color: '#0ea5e9', sort_order: 2 },
  { kind: 'income', name: 'Investments', icon: '📈', color: '#a855f7', sort_order: 3 },
  { kind: 'income', name: 'Gifts', icon: '🎁', color: '#f59e0b', sort_order: 4 },
  { kind: 'income', name: 'Other Income', icon: '💰', color: '#64748b', sort_order: 5 },
]
