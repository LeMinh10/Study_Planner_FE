import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

function positionMenu(trigger: HTMLElement, panel: HTMLElement) {
  panel.style.position = 'fixed'
  panel.style.right = 'auto'
  panel.style.maxHeight = `${window.innerHeight - 24}px`
  panel.style.overflowY = 'auto'
  const anchor = trigger.getBoundingClientRect()
  const bounds = panel.getBoundingClientRect()
  const below = anchor.bottom + 6
  const above = anchor.top - bounds.height - 6
  const top = below + bounds.height <= window.innerHeight - 12 ? below : above >= 12 ? above : Math.max(12, window.innerHeight - bounds.height - 12)
  panel.style.top = `${top}px`
  panel.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))}px`
}

export function ActionMenu({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function position() {
      const trigger = ref.current?.querySelector('summary')
      if (ref.current?.open && trigger && panelRef.current) positionMenu(trigger, panelRef.current)
    }
    function close(event: PointerEvent) { if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open') }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && ref.current?.open) {
        event.preventDefault()
        ref.current.removeAttribute('open')
        ref.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', position)
      document.removeEventListener('scroll', position, true)
    }
  }, [])
  return <details ref={ref} className={'action-menu ' + className} onToggle={(event) => {
    if (event.currentTarget.open) {
      document.querySelectorAll<HTMLDetailsElement>('details.action-menu[open]').forEach((menu) => { if (menu !== event.currentTarget) menu.removeAttribute('open') })
      const trigger = event.currentTarget.querySelector('summary')
      if (trigger && panelRef.current) positionMenu(trigger, panelRef.current)
    }
  }}><summary aria-label={label} title={label}><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg></summary><div ref={panelRef} className="action-menu-items" onDragStart={(event) => { event.preventDefault(); event.stopPropagation() }} onClick={(event) => {
    const target = event.target as Element
    if (!target.closest('[data-menu-keep-open]') && target.closest('button, a')) ref.current?.removeAttribute('open')
  }}>{children}</div></details>
}
