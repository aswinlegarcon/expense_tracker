import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Normalize to the bare origin: people paste the REST/auth endpoint or add a
// trailing slash, which makes every API path resolve wrong ("Invalid path
// specified in request URL"). supabase.co and the local CLI always serve from
// the origin root, so the origin is the correct client URL in all our cases.
function toOrigin(u: string | undefined): string | undefined {
  if (!u) return undefined
  try {
    return new URL(u).origin
  } catch {
    return undefined
  }
}
const url = toOrigin(rawUrl)

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
