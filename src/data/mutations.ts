import { useMutation, useQueryClient } from '@tanstack/react-query'
import { describeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { CategoryKind, Frequency, PaymentMethod, TxType } from '../types'

function useInvalidating<TArgs>(keys: string[][], fn: (args: TArgs) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  })
}

async function run(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p
  if (error) throw new Error(describeError(error.message))
}

// ---------- transactions ----------

export interface TxInput {
  type: TxType
  amount: number
  category_id: string | null
  payment_method: PaymentMethod
  occurred_on: string
  note: string
}

// Any transaction write can move the card balance, so refresh it alongside ['tx'].
const TX_KEYS = [['tx'], ['credit']]

export function useAddTransaction() {
  return useInvalidating(TX_KEYS, (input: TxInput) => run(supabase.from('transactions').insert(input)))
}

export function useUpdateTransaction() {
  return useInvalidating(TX_KEYS, ({ id, ...input }: TxInput & { id: string }) =>
    run(supabase.from('transactions').update(input).eq('id', id)),
  )
}

export function useDeleteTransaction() {
  return useInvalidating(TX_KEYS, (id: string) => run(supabase.from('transactions').delete().eq('id', id)))
}

// ---------- categories ----------

export interface CategoryInput {
  name: string
  kind: CategoryKind
  icon: string
  color: string
}

export function useAddCategory() {
  return useInvalidating([['categories']], (input: CategoryInput) =>
    run(supabase.from('categories').insert(input)),
  )
}

export function useUpdateCategory() {
  return useInvalidating(
    [['categories'], ['tx']],
    ({ id, ...patch }: Partial<CategoryInput> & { id: string; is_archived?: boolean }) =>
      run(supabase.from('categories').update(patch).eq('id', id)),
  )
}

// ---------- budgets ----------

export function useUpsertBudget() {
  return useInvalidating([['budgets']], (input: { category_id: string | null; amount: number }) =>
    run(supabase.from('budgets').upsert(input, { onConflict: 'user_id,category_id' })),
  )
}

export function useDeleteBudget() {
  return useInvalidating([['budgets']], (id: string) => run(supabase.from('budgets').delete().eq('id', id)))
}

// ---------- recurring rules ----------

export interface RecurringInput {
  type: CategoryKind
  amount: number
  category_id: string | null
  payment_method: PaymentMethod
  note: string
  frequency: Frequency
  start_date: string
  next_occurrence: string
  end_date: string | null
  is_active: boolean
}

export function useAddRecurring() {
  return useInvalidating([['recurring']], (input: RecurringInput) =>
    run(supabase.from('recurring_rules').insert(input)),
  )
}

export function useUpdateRecurring() {
  return useInvalidating([['recurring']], ({ id, ...patch }: Partial<RecurringInput> & { id: string }) =>
    run(supabase.from('recurring_rules').update(patch).eq('id', id)),
  )
}

export function useDeleteRecurring() {
  return useInvalidating([['recurring'], ['tx']], (id: string) =>
    run(supabase.from('recurring_rules').delete().eq('id', id)),
  )
}

// ---------- profile ----------

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: { currency: string }) => {
      const { data: userData } = await supabase.auth.getUser()
      const id = userData.user?.id
      if (!id) throw new Error('Not signed in')
      await run(supabase.from('profiles').update(patch).eq('id', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
