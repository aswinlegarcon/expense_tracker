import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  /** undefined = still loading, null = signed out */
  session: Session | null | undefined
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: undefined, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Keep this callback synchronous — awaiting supabase calls inside it
    // deadlocks the auth lock. Follow-up work happens in effects keyed on session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
