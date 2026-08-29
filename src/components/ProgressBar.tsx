interface Props {
  /** 0..1+; values over 1 render full and red */
  ratio: number
  color?: string
}

export default function ProgressBar({ ratio, color }: Props) {
  const over = ratio > 1
  const warn = !over && ratio > 0.85
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${
          over ? 'bg-red-500' : warn ? 'bg-amber-500' : color ? '' : 'bg-emerald-500'
        }`}
        style={{
          width: `${Math.min(100, ratio * 100)}%`,
          ...(color && !over && !warn ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  )
}
