import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface NoiDungXacNhan {
  tieuDe: string
  noiDung: ReactNode
  chiTiet?: { nhan: string; giaTri: number | string }[]
  luuY?: string
  nhanXacNhan?: string
  nhanDangXuLy?: string
  nguyHiem?: boolean
  khiXacNhan?: () => Promise<unknown>
}

export function HopXacNhan({ noiDung, ketThuc }: { noiDung: NoiDungXacNhan; ketThuc: (dongY: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const sending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleId = useId()
  const bodyId = useId()
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element?.showModal()
    cancel.current?.focus()
    return () => {
      element?.close()
      requestAnimationFrame(() => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() })
    }
  }, [])
  return <dialog ref={dialog} className="ht-dialog ht-confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} onCancel={event => {
    event.preventDefault()
    if (!sending.current) ketThuc(false)
  }}>
    <div className={'ht-confirm-icon' + (noiDung.nguyHiem ? ' ht-confirm-icon-danger' : '')} aria-hidden="true">{noiDung.nguyHiem ? '!' : '?'}</div>
    <header><h2 id={titleId}>{noiDung.tieuDe}</h2><button type="button" aria-label="Đóng xác nhận" disabled={busy} onClick={() => ketThuc(false)}>×</button></header>
    <div id={bodyId} className="ht-confirm-description">{noiDung.noiDung}</div>
    {!!noiDung.chiTiet?.length && <dl className="ht-confirm-impact">{noiDung.chiTiet.map(item => <div key={item.nhan}><dt>{item.nhan}</dt><dd>{item.giaTri}</dd></div>)}</dl>}
    {noiDung.luuY && <p className="ht-confirm-note">{noiDung.luuY}</p>}
    {error && <p role="alert" className="ht-error">{error}</p>}
    <footer>
      <button ref={cancel} type="button" disabled={busy} onClick={() => ketThuc(false)}>Hủy</button>
      <button type="button" className={noiDung.nguyHiem ? 'ht-confirm-delete' : 'ht-primary'} disabled={busy} onClick={async () => {
        if (sending.current) return
        sending.current = true
        setBusy(true); setError('')
        try {
          await noiDung.khiXacNhan?.()
          ketThuc(true)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác. Vui lòng thử lại.')
        } finally { sending.current = false; setBusy(false) }
      }}>{busy ? noiDung.nhanDangXuLy ?? 'Đang xử lý…' : noiDung.nhanXacNhan ?? 'Xác nhận'}</button>
    </footer>
  </dialog>
}

