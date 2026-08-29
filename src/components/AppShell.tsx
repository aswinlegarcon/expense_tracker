import { LayoutDashboard, Plus, ReceiptText, Settings, Target, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Route } from '../router'

const NAV: { route: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'transactions', label: 'Transactions', icon: ReceiptText },
  { route: 'budgets', label: 'Budgets', icon: Target },
  { route: 'settings', label: 'Settings', icon: Settings },
]

interface Props {
  route: Route
  onNavigate: (r: Route) => void
  onQuickAdd?: () => void
  children: ReactNode
}

export default function AppShell({ route, onNavigate, onQuickAdd, children }: Props) {
  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Wallet className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Expenses</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => onNavigate(r)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                route === r
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </nav>
        {onQuickAdd && (
          <div className="p-4">
            <button
              onClick={onQuickAdd}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Plus className="size-5" /> Add transaction
            </button>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Wallet className="size-4.5" />
          </span>
          <span className="text-base font-bold tracking-tight">Expenses</span>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex items-stretch">
          {NAV.slice(0, 2).map((item) => (
            <TabButton key={item.route} {...item} active={route === item.route} onNavigate={onNavigate} />
          ))}
          {/* FAB slot keeps spacing symmetric */}
          <div className="flex flex-1 items-center justify-center">
            {onQuickAdd && (
              <button
                onClick={onQuickAdd}
                aria-label="Add transaction"
                className="-mt-6 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
              >
                <Plus className="size-7" />
              </button>
            )}
          </div>
          {NAV.slice(2).map((item) => (
            <TabButton key={item.route} {...item} active={route === item.route} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function TabButton({
  route,
  label,
  icon: Icon,
  active,
  onNavigate,
}: (typeof NAV)[number] & { active: boolean; onNavigate: (r: Route) => void }) {
  return (
    <button
      onClick={() => onNavigate(route)}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
        active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon className="size-5.5" />
      {label}
    </button>
  )
}
