import { todayISO } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { DEFAULT_CATEGORIES } from './defaults'

/** Runs once per session after sign-in. Idempotent and race-safe:
 *  - ensures the profile row exists (covers accounts created before schema.sql ran)
 *  - seeds default categories if the user has none (unique constraint absorbs races)
 *  - posts due recurring transactions atomically via RPC
 *  Returns the number of recurring transactions posted. */
export async function ensureBootstrap(userId: string): Promise<number> {
  await supabase.from('profiles').upsert({ id: userId }, { ignoreDuplicates: true })

  const { count } = await supabase.from('categories').select('id', { count: 'exact', head: true })
  if (count === 0) {
    // user_id is filled by the column default auth.uid(); never sent from the client
    await supabase
      .from('categories')
      .upsert(DEFAULT_CATEGORIES, { onConflict: 'user_id,kind,name', ignoreDuplicates: true })
  }

  const { data: posted } = await supabase.rpc('post_due_recurring', { p_today: todayISO() })
  return posted ?? 0
}
