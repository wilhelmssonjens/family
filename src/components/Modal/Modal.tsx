import { useEffect, useRef, useCallback, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClose: () => void
}

export function Modal({ children, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ y: number; scrollTop: number } | null>(null)
  const dragging = useRef(false)

  useEffect(() => {
    // Focus the sheet on mount for keyboard accessibility
    sheetRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap: keep Tab cycling within the modal
      if (e.key === 'Tab') {
        const el = sheetRef.current
        if (!el) return

        const focusable = el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === el) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = sheetRef.current
    if (!el) return
    touchStart.current = { y: e.touches[0].clientY, scrollTop: el.scrollTop }
    dragging.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current
    const el = sheetRef.current
    if (!start || !el) return

    const deltaY = e.touches[0].clientY - start.y

    // Only allow downward drag when scrolled to top
    if (start.scrollTop > 0) return
    if (deltaY <= 0) return

    dragging.current = true
    el.style.transform = `translateY(${deltaY}px)`
    el.style.transition = 'none'
  }, [])

  const handleTouchEnd = useCallback(() => {
    const start = touchStart.current
    const el = sheetRef.current
    if (!start || !el || !dragging.current) {
      touchStart.current = null
      dragging.current = false
      return
    }

    const currentY = el.getBoundingClientRect().top
    const originalY = window.innerHeight - el.offsetHeight
    const delta = currentY - originalY

    if (delta > el.offsetHeight * 0.25) {
      // Dismiss
      el.style.transition = 'transform 0.2s ease-out'
      el.style.transform = `translateY(100%)`
      setTimeout(onClose, 200)
    } else {
      // Snap back
      el.style.transition = 'transform 0.2s ease-out'
      el.style.transform = ''
    }

    touchStart.current = null
    dragging.current = false
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card-bg w-full max-h-[75dvh] sm:max-h-[90vh] overflow-y-auto
                   rounded-t-2xl sm:rounded-xl sm:max-w-md
                   animate-slide-up sm:animate-in shadow-lg
                   pb-[env(safe-area-inset-bottom)] outline-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-card-bg rounded-t-2xl z-10">
          <div className="w-10 h-1 rounded-full bg-text-secondary/30" />
        </div>
        {children}
      </div>
    </div>
  )
}
