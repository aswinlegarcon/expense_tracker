import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Native <dialog>: bottom sheet on mobile, centered modal on sm+. */
export default function Sheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // click on the backdrop (the dialog element itself) closes
        if (e.target === ref.current) onClose()
      }}
      className="m-0 max-h-[92dvh] w-full max-w-full self-end justify-self-center overflow-y-auto rounded-t-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/45 open:flex open:flex-col sm:self-center sm:max-w-md sm:rounded-2xl dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{open && children}</div>
    </dialog>
  )
}
