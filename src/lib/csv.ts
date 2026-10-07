import { supabase } from './supabase'
import { TYPE_META, canUseCredit, kindOfType } from './txKinds'
import type { Budget, Category, CategoryKind, Profile, RecurringRule, Transaction, TxType } from '../types'

const KINDS: readonly CategoryKind[] = ['expense', 'income', 'investment', 'fund']
const TX_TYPES: readonly TxType[] = ['expense', 'income', 'card_payment', 'investment', 'fund_deposit', 'fund_withdrawal']
const HOLDING_TYPES: readonly string[] = ['investment', 'fund_deposit', 'fund_withdrawal']

function validKind(k: unknown): CategoryKind | null {
  return KINDS.includes(k as CategoryKind) ? (k as CategoryKind) : null
}

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
      csvCell(TYPE_META[t.type]?.label ?? t.type),
      csvCell(t.category_id ? (catById.get(t.category_id)?.name ?? '') : ''),
      csvCell(canUseCredit(t.type) ? t.payment_method : ''),
      csvCell(t.amount),
      csvCell(t.note),
      csvCell(t.recurring_rule_id ? 'yes' : ''),
    ].join(','),
  )
  download(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join('\r\n'), 'text/csv')
  return tx.length
}

/** Version 2 adds investment/fund kinds, opening balances, and a category_kind that is
 *  the category's real kind (version 1 wrote the transaction type there). */
export interface BackupFile {
  app: 'expense-tracker'
  version: 1 | 2
  exported_at: string
  currency: string
  categories: (Pick<Category, 'name' | 'kind' | 'icon' | 'color' | 'is_archived' | 'sort_order'> & {
    opening_balance?: number
  })[]
  transactions: {
    type: string
    amount: number
    occurred_on: string
    note: string
    payment_method: string
    category: string | null // name; ids don't survive account moves
    category_kind: string | null
  }[]
  budgets: { category: string | null; category_kind?: string | null; amount: number }[]
  recurring_rules: {
    type: string
    amount: number
    category: string | null
    category_kind?: string | null
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
  const kind = (id: string | null) => (id ? (catById.get(id)?.kind ?? null) : null)

  const backup: BackupFile = {
    app: 'expense-tracker',
    version: 2,
    exported_at: new Date().toISOString(),
    currency: profile?.currency ?? 'INR',
    categories: categories.map(({ name, kind, icon, color, is_archived, sort_order, opening_balance }) => ({
      name,
      kind,
      icon,
      color,
      is_archived,
      sort_order,
      opening_balance: opening_balance ?? 0,
    })),
    transactions: transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      occurred_on: t.occurred_on,
      note: t.note,
      payment_method: t.payment_method,
      category: name(t.category_id),
      category_kind: kind(t.category_id),
    })),
    budgets: budgets.map((b) => ({ category: name(b.category_id), category_kind: kind(b.category_id), amount: b.amount })),
    recurring_rules: rules.map((r) => ({
      type: r.type,
      amount: r.amount,
      category: name(r.category_id),
      category_kind: kind(r.category_id),
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

/** Additive restore, intended for a fresh account. No dedupe of transactions.
 *  Reads version 1 and 2 backups. */
export async function importBackupJSON(file: File): Promise<{ transactions: number; categories: number }> {
  const parsed = JSON.parse(await file.text()) as BackupFile
  if (parsed.app !== 'expense-tracker' || !Array.isArray(parsed.transactions)) {
    throw new Error('Not an expense-tracker backup file')
  }
  const unknownType = parsed.transactions.find((t) => !TX_TYPES.includes(t.type as TxType))
  if (unknownType) throw new Error(`Unknown transaction type "${unknownType.type}" in backup`)

  // Check before writing anything: a database without investments and funds would
  // reject those rows halfway through, leaving a partial import behind.
  const { data: version, error: versionErr } = await supabase.rpc('schema_version')
  const dbVersion = versionErr ? 0 : typeof version === 'number' ? version : 0
  const needsHoldings =
    parsed.categories.some((c) => c.kind === 'investment' || c.kind === 'fund' || (c.opening_balance ?? 0) > 0) ||
    parsed.transactions.some((t) => HOLDING_TYPES.includes(t.type)) ||
    (parsed.recurring_rules ?? []).some((r) => HOLDING_TYPES.includes(r.type))
  if (needsHoldings && dbVersion < 3) {
    throw new Error(
      'This backup includes investments or funds. Re-run supabase/schema.sql in your Supabase SQL Editor first, then import again.',
    )
  }

  // Every row carries the same keys, and missing ones fall back to column defaults
  // (never NULL), so a mixed batch can't trip a NOT NULL constraint.
  if (parsed.categories.length) {
    const rows = parsed.categories
      .filter((c) => validKind(c.kind))
      .map((c) => ({
        name: c.name,
        kind: c.kind,
        icon: c.icon,
        color: c.color,
        is_archived: c.is_archived ?? false,
        sort_order: c.sort_order ?? 0,
        ...(dbVersion >= 3 ? { opening_balance: c.opening_balance ?? 0 } : {}),
      }))
    const { error } = await supabase
      .from('categories')
      .upsert(rows, { onConflict: 'user_id,kind,name', ignoreDuplicates: true, defaultToNull: false })
    if (error) throw new Error(error.message)
  }

  const { data: cats, error: catErr } = await supabase.from('categories').select('*')
  if (catErr) throw new Error(catErr.message)
  const byKey = new Map((cats as Category[]).map((c) => [`${c.kind}:${c.name}`, c]))

  // A category that already existed (e.g. a seeded "Emergency fund") keeps its own
  // settings, but picks up the backup's opening balance if it has none yet.
  if (dbVersion >= 3) {
    for (const c of parsed.categories) {
      const existing = byKey.get(`${c.kind}:${c.name}`)
      if (existing && (c.opening_balance ?? 0) > 0 && (existing.opening_balance ?? 0) === 0) {
        const { error } = await supabase
          .from('categories')
          .update({ opening_balance: c.opening_balance })
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
      }
    }
  }

  /** Version 2 records the category's real kind; version 1 wrote the type there. */
  const categoryId = (name: string | null, recordedKind: string | null | undefined, type: TxType) => {
    if (!name) return null
    const k = validKind(recordedKind) ?? kindOfType(type)
    return k ? (byKey.get(`${k}:${name}`)?.id ?? null) : null
  }
  const paymentMethod = (type: TxType, method: string | undefined) =>
    canUseCredit(type) && method === 'credit' ? 'credit' : 'cash'

  const txRows = parsed.transactions.map((t) => {
    const type = t.type as TxType
    return {
      type,
      amount: t.amount,
      occurred_on: t.occurred_on,
      note: t.note ?? '',
      payment_method: paymentMethod(type, t.payment_method),
      category_id: categoryId(t.category, t.category_kind, type),
    }
  })
  for (let i = 0; i < txRows.length; i += 500) {
    const { error } = await supabase.from('transactions').insert(txRows.slice(i, i + 500), { defaultToNull: false })
    if (error) throw new Error(error.message)
  }

  for (const b of parsed.budgets ?? []) {
    const category_id = b.category ? categoryId(b.category, b.category_kind ?? 'expense', 'expense') : null
    if (b.category && !category_id) continue
    await supabase.from('budgets').upsert({ category_id, amount: b.amount }, { onConflict: 'user_id,category_id' })
  }

  const ruleRows = (parsed.recurring_rules ?? []).map((r) => {
    const type = r.type as TxType
    return {
      type,
      amount: r.amount,
      category_id: categoryId(r.category, r.category_kind, type),
      payment_method: paymentMethod(type, r.payment_method),
      note: r.note ?? '',
      frequency: r.frequency,
      start_date: r.start_date,
      next_occurrence: r.next_occurrence,
      end_date: r.end_date,
      is_active: r.is_active,
    }
  })
  if (ruleRows.length) {
    const { error } = await supabase.from('recurring_rules').insert(ruleRows, { defaultToNull: false })
    if (error) throw new Error(error.message)
  }

  return { transactions: txRows.length, categories: parsed.categories.length }
}
