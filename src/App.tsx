import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import SignInPage from './auth/SignInPage'
import AppShell from './components/AppShell'
import SetupNotice from './components/SetupNotice'
import Sheet from './components/Sheet'
import { ToastProvider, useToast } from './components/Toast'
import { ensureBootstrap } from './data/bootstrap'
import { useCategories, useProfile } from './data/queries'
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
  const currency = profile?.currency ?? 'INR'

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
      {route === 'dashboard' && <DashboardPage currency={currency} />}
      {route === 'transactions' && <TransactionsPage currency={currency} />}
      {route === 'budgets' && <BudgetsPage currency={currency} />}
      {route === 'settings' && <SettingsPage currency={currency} />}

      <Sheet open={quickAdd} onClose={() => setQuickAdd(false)} title="Add transaction">
        <TransactionForm categories={categories} onDone={() => setQuickAdd(false)} />
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
