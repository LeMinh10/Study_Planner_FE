import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationHref } from '../api/notifications'
import { useNotifications } from '../hooks/useNotifications'
import { Icon } from './Icon'
import './notifications.css'

export function NotificationBell() {
  const c = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const unread = c.inbox?.tongChuaDoc ?? 0
  const rows = c.inbox?.danhSach ?? []
  const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: c.inbox?.muiGio ?? 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function dismissOutside(event: Event) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('focusin', dismissOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('focusin', dismissOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return <div className="student-notifications" ref={containerRef}>
    <button ref={buttonRef} type="button" className={'student-notification-bell' + (open ? ' active' : '')} aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} title="Thông báo" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
      <Icon name="bell" size={21} />
      {unread > 0 && <span className="student-notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div ref={panelRef} id={panelId} className="student-notification-popup" role="dialog" aria-labelledby={panelId + '-title'} tabIndex={-1}>
      <div className="student-notification-heading"><h2 id={panelId + '-title'}>Thông báo</h2><button type="button" className="icon-button" aria-label="Đóng thông báo" onClick={close}><Icon name="close" size={17} /></button></div>
      <div className="notification-toolbar"><div role="group" aria-label="Lọc thông báo"><button type="button" disabled={c.saving} aria-pressed={!c.unreadOnly} onClick={() => c.filter(false)}>Tất cả</button><button type="button" disabled={c.saving} aria-pressed={c.unreadOnly} onClick={() => c.filter(true)}>Chưa đọc</button></div><button type="button" className="notification-read-all" disabled={!unread || c.loading || c.saving} onClick={() => { void c.mark() }}>Đọc tất cả</button></div>
      {c.error && <div className="notification-error" role="alert"><p>{c.error}</p><button type="button" disabled={c.loading || c.saving} onClick={c.reload}>Thử lại</button></div>}
      {c.loading && <p className="notification-loading" role="status">{c.inbox ? 'Đang cập nhật…' : 'Đang tải thông báo…'}</p>}
      {rows.length ? <ul className="student-notification-list">{rows.map((item) => <li key={item.ma}>
        <button type="button" disabled={c.saving} className={'student-notification-item' + (!item.ngayDoc ? ' notification-unread' : '')} onClick={() => { void c.mark(item).then(ok => { if (ok) { close(); navigate(notificationHref(item)) } }) }}>
          <span className={'student-notification-kind' + (item.quaHan ? ' overdue' : '')}>{item.tieuDe}{!item.ngayDoc && <span className="notification-unread-dot" aria-label="Chưa đọc" />}</span>
          <strong>{item.tenNhiemVu}</strong>
          {(item.tenMonHoc || item.tenHocKy) && <small>{[item.tenMonHoc, item.tenHocKy].filter(Boolean).join(' · ')}</small>}
          {item.hanHieuLuc && <small>Hạn {date(item.hanHieuLuc)}</small>}
          <small>{item.daHoanThanh ? 'Đã hoàn thành · ' : ''}{date(item.ngayPhat)}</small>
        </button>
      </li>)}</ul> : !c.loading && !c.error && <div className="student-notification-empty"><Icon name="bell" size={26} /><p>{c.unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}</p></div>}
      {c.inbox && c.inbox.tongSo > c.inbox.kichThuocTrang && <nav className="notification-pagination" aria-label="Trang thông báo"><button type="button" disabled={c.page <= 1 || c.loading || c.saving} onClick={() => c.turnPage(c.page - 1)}>Trước</button><span>{c.page}/{Math.ceil(c.inbox.tongSo / c.inbox.kichThuocTrang)}</span><button type="button" disabled={c.page * c.inbox.kichThuocTrang >= c.inbox.tongSo || c.loading || c.saving} onClick={() => c.turnPage(c.page + 1)}>Sau</button></nav>}
    </div>}
  </div>
}
