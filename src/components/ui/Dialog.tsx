import { useEffect, useRef, type ReactNode } from "react"

export function Dialog({
  titleId,
  onClose,
  children,
}: {
  titleId: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-ink/50 sm:p-8"
    >
      {children}
    </dialog>
  )
}
