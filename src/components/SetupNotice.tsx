import { Wrench } from 'lucide-react'

export default function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Wrench className="size-4" /> Backend not configured yet
        </div>
        <p>
          The app is deployed, but the <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> build secrets haven’t been set. Add them as GitHub
          Actions secrets (or in <code className="font-mono">.env.local</code> for local dev) and redeploy — see the
          README for the step-by-step Supabase setup.
        </p>
      </div>
    </div>
  )
}
