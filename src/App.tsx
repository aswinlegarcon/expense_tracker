import AppShell from './components/AppShell'
import { useHashRoute } from './router'

const PLACEHOLDER: Record<string, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  budgets: 'Budgets',
  settings: 'Settings',
}

export default function App() {
  const [route, navigate] = useHashRoute()

  return (
    <AppShell route={route} onNavigate={navigate}>
      <h1 className="text-2xl font-bold tracking-tight">{PLACEHOLDER[route]}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Coming soon.</p>
    </AppShell>
  )
}
