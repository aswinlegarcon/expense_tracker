import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import SignInPage from './auth/SignInPage'
import AppShell from './components/AppShell'
import SetupNotice from './components/SetupNotice'
import { isSupabaseConfigured } from './lib/supabase'
import { useHashRoute } from './router'

const PLACEHOLDER: Record<string, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  budgets: 'Budgets',
  settings: 'Settings',
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="size-8 animate-spin text-emerald-600" />
    </div>
  )
}

function Gate() {
  const { session } = useAuth()
  const [route, navigate] = useHashRoute()

  if (session === undefined) return <Splash />
  if (!session) return <SignInPage />

  return (
    <AppShell route={route} onNavigate={navigate}>
      <h1 className="text-2xl font-bold tracking-tight">{PLACEHOLDER[route]}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Coming soon.</p>
    </AppShell>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
