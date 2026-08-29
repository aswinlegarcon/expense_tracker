import { addDays, addMonths, format, parseISO, startOfMonth, subDays } from 'date-fns'

/** The only place `Date` meets strings. All dates elsewhere are yyyy-MM-dd strings. */

export type ISODate = string // yyyy-MM-dd

/** Local-timezone today. NEVER use toISOString(): before 05:30 IST it returns yesterday. */
export function todayISO(): ISODate {
  return format(new Date(), 'yyyy-MM-dd')
}

/** First day of the month `offset` months away from the month containing `from` (default: today). */
export function monthStartISO(offset = 0, from?: ISODate): ISODate {
  const base = from ? parseISO(from) : new Date()
  return format(startOfMonth(addMonths(base, offset)), 'yyyy-MM-dd')
}

/** yyyy-MM key of an ISO date */
export function monthKey(d: ISODate): string {
  return d.slice(0, 7)
}

export function formatDay(d: ISODate): string {
  const today = todayISO()
  if (d === today) return 'Today'
  if (d === format(subDays(parseISO(today), 1), 'yyyy-MM-dd')) return 'Yesterday'
  return format(parseISO(d), 'EEE, d MMM')
}

/** Accepts yyyy-MM or yyyy-MM-dd */
export function formatMonth(m: string): string {
  return format(parseISO(m.length === 7 ? `${m}-01` : m), 'MMMM yyyy')
}

export function formatShortMonth(m: string): string {
  return format(parseISO(`${m}-01`), 'MMM')
}

export function formatFullDate(d: ISODate): string {
  return format(parseISO(d), 'd MMM yyyy')
}

export function addDaysISO(d: ISODate, days: number): ISODate {
  return format(addDays(parseISO(d), days), 'yyyy-MM-dd')
}

/** Last day of the month that starts at `monthStart`. */
export function monthEndISO(monthStart: ISODate): ISODate {
  return addDaysISO(monthStartISO(1, monthStart), -1)
}
