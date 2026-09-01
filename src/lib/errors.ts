/** Postgres/PostgREST codes meaning "the app expects schema this database
 *  doesn't have yet" — i.e. schema.sql has not been re-run after an update. */
const SCHEMA_DRIFT =
  /schema cache|column .* does not exist|function .* does not exist|PGRST202|PGRST204|42703|42883/i

export const SCHEMA_DRIFT_HELP =
  'Your database is missing a recent update. Open the Supabase SQL Editor, re-run supabase/schema.sql, then reload this page.'

export function isSchemaDrift(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return message === SCHEMA_DRIFT_HELP || SCHEMA_DRIFT.test(message)
}

/** Turn a raw backend error into something the person reading it can act on. */
export function describeError(message: string): string {
  if (SCHEMA_DRIFT.test(message)) return SCHEMA_DRIFT_HELP
  // note: duplicate-name errors stay raw so call sites can give a specific message
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return 'Cannot reach the server — check your connection. (A free Supabase project pauses when idle.)'
  }
  return message
}

export function errorText(err: unknown): string {
  return describeError(err instanceof Error ? err.message : String(err))
}
