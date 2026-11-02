import { useEffect, useId, useRef, useState } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import { formatDate } from '../utils/planner'
import { Icon } from './Icon'

export function NotificationBell() {
  const { data, alerts, openTask } = usePlanner()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const unread = alerts.filter((alert) => !data.readAlerts.includes(alert.key)).length

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
      {alerts.length ? <ul className="student-notification-list">{alerts.map((alert) => <li key={alert.key}>
        <button type="button" className="student-notification-item" onClick={() => { close(); openTask(alert.task) }}>
          <span className={'student-notification-kind' + (alert.overdue ? ' overdue' : '')}>{alert.overdue ? 'Quá hạn' : 'Sắp đến hạn'}</span>
          <strong>{alert.task.title}</strong>
          <small>Hạn {formatDate(alert.task.dueDate, true)} lúc {alert.task.dueTime}</small>
        </button>
      </li>)}</ul> : <div className="student-notification-empty"><Icon name="bell" size={26} /><p>Chưa có thông báo</p><small>Nhiệm vụ sắp đến hạn hoặc quá hạn sẽ hiển thị tại đây.</small></div>}
    </div>}
  </div>
}
