const formatters = new Map<string, Intl.NumberFormat>()
const compactFormatters = new Map<string, Intl.NumberFormat>()

// en-IN locale is deliberate: Indian digit grouping (₹1,23,456.78) for any currency.
function getFormatter(currency: string, compact = false): Intl.NumberFormat {
  const cache = compact ? compactFormatters : formatters
  let f = cache.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: compact ? 0 : 2,
      ...(compact ? { notation: 'compact' as const } : {}),
    })
    cache.set(currency, f)
  }
  return f
}

export function formatMoney(amount: number, currency = 'INR'): string {
  return getFormatter(currency).format(amount)
}

/** Whole-number display, e.g. for chart axis ticks: ₹1.2L / ₹20K */
export function formatMoneyCompact(amount: number, currency = 'INR'): string {
  return getFormatter(currency, true).format(amount)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
