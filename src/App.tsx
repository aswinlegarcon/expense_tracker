import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import SignInPage from './auth/SignInPage'
import AppShell from './components/AppShell'
import SetupNotice from './components/SetupNotice'
import Sheet from './components/Sheet'
import { ToastProvider, useToast } from './components/Toast'
import { ensureBootstrap } from './data/bootstrap'
import { useCategories, useCreditSummary, useProfile } from './data/queries'
import { isSchemaDrift } from './lib/errors'
import BudgetsPage from './features/budgets/BudgetsPage'
import DashboardPage from './features/dashboard/DashboardPage'
import SettingsPage from './features/settings/SettingsPage'
import TransactionsPage from './features/transactions/TransactionsPage'
import TransactionForm from './features/transactions/TransactionForm'
import { isSupabaseConfigured } from './lib/supabase'
import { useHashRoute } from './router'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="size-8 animate-spin text-emerald-600" />
    </div>
  )
}

function AuthedApp({ session }: { session: Session }) {
  const [route, navigate] = useHashRoute()
  const [quickAdd, setQuickAdd] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()
  const bootstrappedFor = useRef<string | null>(null)

  const { data: profile } = useProfile()
  const { data: categories = [] } = useCategories()
  const creditQuery = useCreditSummary()
  // `error` is only set once retries are exhausted, and React Query pauses
  // retries when it thinks the network is down — so check the first failure too.
  const creditError = creditQuery.error ?? creditQuery.failureReason
  const currency = profile?.currency ?? 'INR'

  // The app can ship ahead of the database (schema.sql not re-run yet). Say so
  // loudly here instead of letting it surface as a cryptic save failure later.
  const schemaOutOfDate = isSchemaDrift(creditError)

  useEffect(() => {
    const uid = session.user.id
    if (bootstrappedFor.current === uid) return
    bootstrappedFor.current = uid
    ensureBootstrap(uid)
      .then((posted) => {
        qc.invalidateQueries()
        if (posted > 0) toast(`Posted ${posted} recurring transaction${posted === 1 ? '' : 's'}`)
      })
      .catch(() => {
        // non-fatal: queries surface their own errors
      })
  }, [session, qc, toast])

  return (
    <AppShell route={route} onNavigate={navigate} onQuickAdd={() => setQuickAdd(true)}>
      {schemaOutOfDate && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Database update needed.</span> Re-run{' '}
            <code className="font-mono text-xs">supabase/schema.sql</code> in your Supabase SQL Editor, then reload.
            Saving changes will fail until you do.
          </p>
        </div>
      )}
      {route === 'dashboard' && <DashboardPage currency={currency} />}
      {route === 'transactions' && <TransactionsPage currency={currency} />}
      {route === 'budgets' && <BudgetsPage currency={currency} />}
      {route === 'settings' && <SettingsPage currency={currency} />}

      <Sheet open={quickAdd} onClose={() => setQuickAdd(false)} title="Add transaction">
        <TransactionForm categories={categories} currency={currency} onDone={() => setQuickAdd(false)} />
      </Sheet>
    </AppShell>
  )
}

function Gate() {
  const { session } = useAuth()
  if (session === undefined) return <Splash />
  if (!session) return <SignInPage />
  return <AuthedApp session={session} />
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  )
}
