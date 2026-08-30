import { useQuery } from '@tanstack/react-query'
import type { ISODate } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Budget, Category, CreditSummary, Profile, RecurringRule, Transaction } from '../types'

async function throwing<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
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
      if (error) throw new Error(error.message)
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
