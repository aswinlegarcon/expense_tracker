import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until the two VITE_SUPABASE_* env vars are provided (repo secrets in CI,
 *  .env.local for dev). The app shows a setup notice instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// The placeholder client is never called: App gates all data UI behind
// isSupabaseConfigured, so a missing config can't produce network calls.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // No email-link flows and hash routing in use: never let supabase-js touch location.hash
    detectSessionInUrl: false,
  },
})
