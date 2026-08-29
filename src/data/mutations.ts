import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Frequency, TxType } from '../types'

function useInvalidating<TArgs>(keys: string[][], fn: (args: TArgs) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  })
}

async function run(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p
  if (error) throw new Error(error.message)
}

// ---------- transactions ----------

export interface TxInput {
  type: TxType
  amount: number
  category_id: string | null
  occurred_on: string
  note: string
}

export function useAddTransaction() {
  return useInvalidating([['tx']], (input: TxInput) => run(supabase.from('transactions').insert(input)))
}

export function useUpdateTransaction() {
  return useInvalidating([['tx']], ({ id, ...input }: TxInput & { id: string }) =>
    run(supabase.from('transactions').update(input).eq('id', id)),
  )
}

export function useDeleteTransaction() {
  return useInvalidating([['tx']], (id: string) => run(supabase.from('transactions').delete().eq('id', id)))
}

// ---------- categories ----------

export interface CategoryInput {
  name: string
  kind: TxType
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
  type: TxType
  amount: number
  category_id: string | null
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
