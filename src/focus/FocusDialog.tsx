import { useLayoutEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Icon } from '../components/Icon'

export function FocusDialog({ title, children, close, busy = false, className = '', anchor }: {
  title: string; children: ReactNode; close: () => void; busy?: boolean; className?: string
  anchor?: RefObject<HTMLButtonElement | null>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    if (!anchor) return
    function place() {
      const trigger = anchor?.current
      if (!dialog || !trigger) return
      const rect = trigger.getBoundingClientRect()
      const inset = 12, gap = 6
      const below = window.innerHeight - rect.bottom - inset - gap
      const above = rect.top - inset - gap
      const flip = below < 385 && above > below
      const available = Math.max(below, above)
      dialog.style.maxHeight = Math.min(430, available < 245 ? window.innerHeight - inset * 2 : flip ? above : below) + 'px'
      const { width, height } = dialog.getBoundingClientRect()
      const left = rect.left + (rect.width - width) / 2
      const top = available < 245 ? (window.innerHeight - height) / 2 : flip ? rect.top - gap - height : rect.bottom + gap
      dialog.style.left = Math.max(inset, Math.min(left, window.innerWidth - width - inset)) + 'px'
      dialog.style.top = Math.max(inset, Math.min(top, window.innerHeight - height - inset)) + 'px'
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(dialog)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      for (const property of ['left', 'top', 'max-height']) dialog.style.removeProperty(property)
    }
  }, [anchor])
  return <dialog className={'focus-dialog ' + className + (anchor ? ' focus-dialog-anchored' : '')} ref={ref} aria-label={title}
    onCancel={event => { if (busy) event.preventDefault(); else close() }}
    onClick={event => {
      if (!anchor || busy || event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
    }}>
    {!anchor && <header><h2>{title}</h2><button type="button" className="focus-icon" disabled={busy} aria-label="Đóng" onClick={close}><Icon name="close" size={19} /></button></header>}
    {children}
  </dialog>
}
