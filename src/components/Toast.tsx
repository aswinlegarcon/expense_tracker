import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: string
  tone: 'info' | 'error'
}

const Ctx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const push = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = nextId.current++
    setItems((cur) => [...cur, { id, text, tone }])
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
              t.tone === 'error' ? 'bg-red-600' : 'bg-slate-800 dark:bg-slate-700'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
