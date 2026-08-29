import { Download, FileJson, Loader2, LogOut, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useToast } from '../../components/Toast'
import { useUpdateProfile } from '../../data/mutations'
import { useCategories, useProfile } from '../../data/queries'
import { exportBackupJSON, exportTransactionsCSV, importBackupJSON } from '../../lib/csv'
import { getTheme, setTheme, type Theme } from '../../lib/theme'
import CategoryManager from './CategoryManager'
import RecurringManager from './RecurringManager'
import { useQueryClient } from '@tanstack/react-query'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function SettingsPage({ currency }: { currency: string }) {
  const { session, signOut } = useAuth()
  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const updateProfile = useUpdateProfile()
  const toast = useToast()
  const qc = useQueryClient()
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickTheme(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  async function onCurrency(next: string) {
    try {
      await updateProfile.mutateAsync({ currency: next })
      toast(`Currency set to ${next}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    }
  }

  async function guard(label: string, fn: () => Promise<void>) {
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Section title="Preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Currency</span>
            <select
              value={profile?.currency ?? currency}
              onChange={(e) => onCurrency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">Synced across your devices</span>
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Theme</span>
            <div className="grid grid-cols-3 rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => pickTheme(t)}
                  className={`rounded-md py-2 text-xs font-semibold capitalize ${
                    theme === t ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="mt-1 block text-xs text-slate-400">This device only</span>
          </div>
        </div>
      </Section>

      <Section title="Categories">
        <CategoryManager />
      </Section>

      <Section title="Recurring transactions">
        <RecurringManager currency={profile?.currency ?? currency} />
      </Section>

      <Section title="Your data">
        <div className="flex flex-wrap gap-2.5">
          <button
            disabled={busy !== null}
            onClick={() =>
              guard('csv', async () => {
                const n = await exportTransactionsCSV(categories)
                toast(`Exported ${n} transactions to CSV`)
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {busy === 'csv' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export CSV
          </button>
          <button
            disabled={busy !== null}
            onClick={() =>
              guard('json', async () => {
                const n = await exportBackupJSON(profile)
                toast(`Backup saved (${n} transactions)`)
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {busy === 'json' ? <Loader2 className="size-4 animate-spin" /> : <FileJson className="size-4" />}
            Download backup
          </button>
          <button
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {busy === 'import' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              void guard('import', async () => {
                const res = await importBackupJSON(file)
                qc.invalidateQueries()
                toast(`Imported ${res.transactions} transactions`)
              })
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Import is additive and meant for restoring a backup into a fresh account — it does not de-duplicate.
        </p>
      </Section>

      <Section title="Account">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{session?.user.email}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Signed in</p>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </Section>

      <p className="pb-2 text-center text-xs text-slate-300 dark:text-slate-600">
        Expense Tracker · data stored in your own Supabase project
      </p>
    </div>
  )
}
