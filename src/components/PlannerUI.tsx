import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { usePlanner } from '../contexts/PlannerContext'
import type { PlannerTask } from '../types/planner'
import { formatDate, statusLabels, taskStatus } from '../utils/planner'

export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <p className="overline">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="intro-description">{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</div>
}
export function Modal({ title, children, onClose, wide = false, side = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; side?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => { dialog?.close(); document.body.style.overflow = previous }
  }, [])
  return <dialog ref={ref} className={`session-dialog${wide ? ' wide-dialog' : ''}${side ? ' side-dialog' : ''}`} aria-labelledby="active-dialog-title" onCancel={onClose} onClick={(event) => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}><div className="dialog-heading"><h2 id="active-dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Đóng hộp thoại" onClick={onClose}><Icon name="close" /></button></div>{children}</dialog>
}
export function FormActions({ onClose, label = 'Lưu thay đổi' }: { onClose: () => void; label?: string }) {
  return <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Hủy</button><button type="submit" className="button button-primary">{label}<Icon name="check" size={16} /></button></div>
}
export function EmptyState({ title = 'Chưa có dữ liệu', description, children }: { title?: string; description?: string; children?: ReactNode }) {
  return <div className="empty-state"><h3>{title}</h3>{description && <p>{description}</p>}{children}</div>
}
export function StatusBadge({ task }: { task: PlannerTask }) {
  const { now } = usePlanner()
  const status = taskStatus(task, now)
  return <span className={`status-badge status-${status}`}><i />{statusLabels[status]}</span>
}
export function SubjectBadge({ id }: { id: string }) {
  const { data } = usePlanner()
  const subject = data.subjects.find((item) => item.id === id)
  return <span className={`subject-tag ${subject?.color ?? 'sage'}`}>{subject?.name ?? 'Môn học đã xóa'}</span>
}
export function TaskRows({ tasks, showReason = false }: { tasks: PlannerTask[]; showReason?: boolean }) {
  const { openTask, now } = usePlanner()
  return <div className="compact-task-list">{tasks.map((task, index) => <button key={task.id} className="compact-task-row" onClick={() => openTask(task)}><span className="task-order">{String(index + 1).padStart(2, '0')}</span><span className="compact-task-main"><strong>{task.title}</strong><span><SubjectBadge id={task.subjectId} />{showReason ? <span>{taskStatus(task, now) === 'overdue' ? 'Đã quá hạn' : 'Hạn nộp'} · {formatDate(task.dueDate)} {task.dueTime}</span> : <span>{task.subtasks.length ? `${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length} nhiệm vụ nhỏ` : `Hạn ${formatDate(task.dueDate)}`}</span>}</span></span><StatusBadge task={task} /><Icon name="chevron-right" size={16} /></button>)}</div>
}
export function NoSubjectsNotice() {
  return <div className="inline-notice">Chưa có dữ liệu môn học. <Link to="/subjects">Đến môn học <Icon name="arrow-right" size={14} /></Link></div>
}
export function CalendarNav() {
  return <nav className="student-calendar-nav" aria-label="Lịch và thời khóa biểu"><NavLink to="/calendar"><Icon name="calendar" size={16} />Lịch của tôi</NavLink><NavLink to="/schedule"><Icon name="clock" size={16} />Thời khóa biểu</NavLink></nav>
}
export function ConfirmDelete() {
  const { confirmation, closeConfirmation, canMutate } = usePlanner()
  if (!confirmation) return null
  return <Modal title={confirmation.title} onClose={closeConfirmation}><p className="confirm-description">{confirmation.message}</p><div className="dialog-actions"><button className="button button-secondary" onClick={closeConfirmation}>Giữ lại</button><button className="button button-danger" onClick={() => { if (canMutate) confirmation.confirm() }}>Xác nhận xóa</button></div></Modal>
}
