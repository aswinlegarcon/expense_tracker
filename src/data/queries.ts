import { useQuery } from '@tanstack/react-query'
import type { ISODate } from '../lib/dates'
import { describeError } from '../lib/errors'
import { round2 } from '../lib/money'
import { supabase } from '../lib/supabase'
import { outflowTypeOf, type MovableKind } from '../lib/txKinds'
import type { Budget, Category, CreditSummary, HoldingSummary, Profile, RecurringRule, Transaction } from '../types'

/** Schema version this app needs for investments and funds (see schema_version() in schema.sql). */
export const REQUIRED_SCHEMA = 3

async function throwing<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(describeError(error.message))
  return data as T
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => throwing<Profile>(supabase.from('profiles').select('*').single()),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () =>
      throwing<Category[]>(
        supabase.from('categories').select('*').order('kind').order('sort_order').order('name'),
      ),
  })
}

/** Transactions in [from, to] inclusive, newest first. */
export function useTransactions(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: ['tx', from, to],
    queryFn: () =>
      throwing<Transaction[]>(
        supabase
          .from('transactions')
          .select('*')
          .gte('occurred_on', from)
          .lte('occurred_on', to)
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5000),
      ),
  })
}

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => throwing<Budget[]>(supabase.from('budgets').select('*')),
  })
}

/** Card balance across all history — a date window would not tally. */
export function useCreditSummary() {
  return useQuery({
    queryKey: ['credit'],
    queryFn: async (): Promise<CreditSummary> => {
      const { data, error } = await supabase.rpc('credit_summary')
      if (error) throw new Error(describeError(error.message))
      const row = (Array.isArray(data) ? data[0] : data) as CreditSummary | undefined
      return (
        row ?? {
          outstanding: 0,
          lifetime_charged: 0,
          lifetime_paid: 0,
          last_paid_on: null,
          last_paid_amount: null,
        }
      )
    },
  })
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () =>
      throwing<RecurringRule[]>(
        supabase.from('recurring_rules').select('*').order('next_occurrence'),
      ),
  })
}

/** The database's schema version. Databases from before versioning existed have no
 *  schema_version() function, which is reported as 0 rather than as an error. */
export function useSchemaVersion() {
  return useQuery({
    queryKey: ['schema-version'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('schema_version')
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') return 0
        throw new Error(describeError(error.message))
      }
      return typeof data === 'number' ? data : 0
    },
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/** True only once the database is known to support investments and funds; while the
 *  version is loading or unknown (offline) the new features stay hidden. */
export function useHasHoldings(): boolean {
  const { data } = useSchemaVersion()
  return (data ?? 0) >= REQUIRED_SCHEMA
}

/** Every investment and fund category, totalled over all history. */
export function useHoldings() {
  const enabled = useHasHoldings()
  return useQuery({
    queryKey: ['holdings'],
    enabled,
    queryFn: () => throwing<HoldingSummary[]>(supabase.rpc('holdings_summary')),
  })
}

/** What move_category would re-label, using the same filter as the database function. */
export async function previewMove(
  categoryId: string,
  target: MovableKind,
): Promise<{ count: number; total: number | null }> {
  const { data, count, error } = await supabase
    .from('transactions')
    .select('amount', { count: 'exact' })
    .eq('category_id', categoryId)
    .in('type', ['expense', 'investment', 'fund_deposit'])
    .neq('type', outflowTypeOf(target))
    .limit(1000)
  if (error) throw new Error(describeError(error.message))
  const rows = (data ?? []) as { amount: number }[]
  const n = count ?? rows.length
  // a response holds at most 1000 rows; only report a total that covers every entry
  return { count: n, total: rows.length === n ? round2(rows.reduce((sum, r) => sum + r.amount, 0)) : null }
}
