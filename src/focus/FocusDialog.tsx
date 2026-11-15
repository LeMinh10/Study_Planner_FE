import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'

export function FocusDialog({ title, children, close, busy = false, className = '' }: {
  title: string; children: ReactNode; close: () => void; busy?: boolean; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog className={'focus-dialog ' + className} ref={ref} onCancel={event => { if (busy) event.preventDefault(); else close() }} aria-label={title}>
    <header><h2>{title}</h2><button type="button" className="focus-icon" disabled={busy} aria-label="Đóng" onClick={close}><Icon name="close" size={19} /></button></header>{children}
  </dialog>
}
