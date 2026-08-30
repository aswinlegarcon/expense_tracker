import { supabase } from './supabase'
import type { Budget, Category, Profile, RecurringRule, Transaction } from '../types'

/** PostgREST caps responses at 1000 rows — paginate to get everything. */
async function fetchAll<T>(table: string, orderCol: string): Promise<T[]> {
  const page = 1000
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderCol)
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    out.push(...(data as T[]))
    if (!data || data.length < page) break
  }
  return out
}

// RFC-4180 quoting; leading ' guards against spreadsheet formula injection.
function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replaceAll('"', '""')}"`
  return s
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportTransactionsCSV(categories: Category[]) {
  const tx = await fetchAll<Transaction>('transactions', 'occurred_on')
  const catById = new Map(categories.map((c) => [c.id, c]))
  const header = 'date,type,category,paid_with,amount,note,recurring'
  const rows = tx.map((t) =>
    [
      csvCell(t.occurred_on),
      csvCell(t.type === 'card_payment' ? 'card bill payment' : t.type),
      csvCell(t.category_id ? (catById.get(t.category_id)?.name ?? '') : ''),
      csvCell(t.type === 'expense' ? t.payment_method : ''),
      csvCell(t.amount),
      csvCell(t.note),
      csvCell(t.recurring_rule_id ? 'yes' : ''),
    ].join(','),
  )
  download(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join('\r\n'), 'text/csv')
  return tx.length
}

export interface BackupFile {
  app: 'expense-tracker'
  version: 1
  exported_at: string
  currency: string
  categories: Pick<Category, 'name' | 'kind' | 'icon' | 'color' | 'is_archived' | 'sort_order'>[]
  transactions: {
    type: string
    amount: number
    occurred_on: string
    note: string
    payment_method: string
    category: string | null // name; ids don't survive account moves
    category_kind: string
  }[]
  budgets: { category: string | null; amount: number }[]
  recurring_rules: {
    type: string
    amount: number
    category: string | null
    payment_method: string
    note: string
    frequency: string
    start_date: string
    next_occurrence: string
    end_date: string | null
    is_active: boolean
  }[]
}

export async function exportBackupJSON(profile: Profile | undefined) {
  const [categories, transactions, budgets, rules] = await Promise.all([
    fetchAll<Category>('categories', 'created_at'),
    fetchAll<Transaction>('transactions', 'occurred_on'),
    fetchAll<Budget>('budgets', 'created_at'),
    fetchAll<RecurringRule>('recurring_rules', 'created_at'),
  ])
  const catById = new Map(categories.map((c) => [c.id, c]))
  const name = (id: string | null) => (id ? (catById.get(id)?.name ?? null) : null)

  const backup: BackupFile = {
    app: 'expense-tracker',
    version: 1,
    exported_at: new Date().toISOString(),
    currency: profile?.currency ?? 'INR',
    categories: categories.map(({ name, kind, icon, color, is_archived, sort_order }) => ({
      name,
      kind,
      icon,
      color,
      is_archived,
      sort_order,
    })),
    transactions: transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      occurred_on: t.occurred_on,
      note: t.note,
      payment_method: t.payment_method,
      category: name(t.category_id),
      category_kind: t.type,
    })),
    budgets: budgets.map((b) => ({ category: name(b.category_id), amount: b.amount })),
    recurring_rules: rules.map((r) => ({
      type: r.type,
      amount: r.amount,
      category: name(r.category_id),
      payment_method: r.payment_method,
      note: r.note,
      frequency: r.frequency,
      start_date: r.start_date,
      next_occurrence: r.next_occurrence,
      end_date: r.end_date,
      is_active: r.is_active,
    })),
  }
  download(
    `expense-tracker-backup-${backup.exported_at.slice(0, 10)}.json`,
    JSON.stringify(backup, null, 2),
    'application/json',
  )
  return transactions.length
}

/** Additive restore, intended for a fresh account. No dedupe of transactions. */
export async function importBackupJSON(file: File): Promise<{ transactions: number; categories: number }> {
  const parsed = JSON.parse(await file.text()) as BackupFile
  if (parsed.app !== 'expense-tracker' || !Array.isArray(parsed.transactions)) {
    throw new Error('Not an expense-tracker backup file')
  }

  if (parsed.categories.length) {
    const { error } = await supabase
      .from('categories')
      .upsert(parsed.categories, { onConflict: 'user_id,kind,name', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }

  const { data: cats, error: catErr } = await supabase.from('categories').select('*')
  if (catErr) throw new Error(catErr.message)
  const idByKey = new Map((cats as Category[]).map((c) => [`${c.kind}:${c.name}`, c.id]))

  // Backups written before cash/credit tracking have no payment_method — treat as cash.
  const txRows = parsed.transactions.map((t) => ({
    type: t.type,
    amount: t.amount,
    occurred_on: t.occurred_on,
    note: t.note ?? '',
    payment_method: t.type === 'expense' && t.payment_method === 'credit' ? 'credit' : 'cash',
    category_id: t.category ? (idByKey.get(`${t.type}:${t.category}`) ?? null) : null,
  }))
  for (let i = 0; i < txRows.length; i += 500) {
    const { error } = await supabase.from('transactions').insert(txRows.slice(i, i + 500))
    if (error) throw new Error(error.message)
  }

  for (const b of parsed.budgets ?? []) {
    const category_id = b.category ? (idByKey.get(`expense:${b.category}`) ?? null) : null
    if (b.category && !category_id) continue
    await supabase.from('budgets').upsert({ category_id, amount: b.amount }, { onConflict: 'user_id,category_id' })
  }

  const ruleRows = (parsed.recurring_rules ?? []).map((r) => ({
    type: r.type,
    amount: r.amount,
    category_id: r.category ? (idByKey.get(`${r.type}:${r.category}`) ?? null) : null,
    payment_method: r.type === 'expense' && r.payment_method === 'credit' ? 'credit' : 'cash',
    note: r.note ?? '',
    frequency: r.frequency,
    start_date: r.start_date,
    next_occurrence: r.next_occurrence,
    end_date: r.end_date,
    is_active: r.is_active,
  }))
  if (ruleRows.length) {
    const { error } = await supabase.from('recurring_rules').insert(ruleRows)
    if (error) throw new Error(error.message)
  }

  return { transactions: txRows.length, categories: parsed.categories.length }
}
