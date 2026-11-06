import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePlanner } from '../contexts/PlannerContext'
import type { Subject } from '../types/planner'
import { formatDate } from '../utils/planner'
import { Icon } from './Icon'
import { Modal } from './PlannerUI'
import { SubjectEditor } from '../pages/SubjectEditor'

export function SubjectInfoPanel({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { data, canManageSubjects, academicBusy, academicError, loadSubject, requestDelete, confirmation } = usePlanner()
  const [editing, setEditing] = useState(false)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ loading: true, error: '' })
  const [notice, setNotice] = useState('')
  const semester = data.semesters.find((item) => item.id === subject.semesterId)

  useEffect(() => {
    const controller = new AbortController()
    void loadSubject(subject.id, controller.signal).then(() => {
      if (!controller.signal.aborted) setState({ loading: false, error: '' })
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ loading: false, error: error instanceof Error ? error.message : 'Không tải được thông tin môn học.' })
    })
    return () => controller.abort()
  }, [subject.id, loadSubject, revision])

  if (confirmation) return null
  if (editing) return <SubjectEditor subject={subject} onClose={() => setEditing(false)} onSaved={() => setNotice('Đã cập nhật thông tin môn học.')} />

  return <Modal title="Thông tin môn" side onClose={onClose}>
    <div className={`subject-info-panel ${subject.color}`} style={subject.colorHex ? { '--course-color': subject.colorHex } as CSSProperties : undefined}>
      <div className="subject-info-identity"><span className="course-card-icon"><Icon name="book" size={28} /></span><div><span>{subject.code || 'Chưa có mã môn'}</span><h2>{subject.name}</h2></div></div>
      {state.loading && <p className="subject-info-status" role="status">Đang tải thông tin môn học…</p>}
      {state.error && <div className="subject-info-error" role="alert"><p>{state.error}</p><button className="button button-secondary" disabled={academicBusy} onClick={() => { setState({ loading: true, error: '' }); setRevision((value) => value + 1) }}><Icon name="reset" size={15} />Thử lại</button></div>}
      {academicError && !state.error && <p className="subject-info-error" role="alert">{academicError}</p>}
      {notice && <p className="subject-info-success" role="status"><Icon name="check" size={16} />{notice}</p>}
      <dl className="subject-info-fields">
        <div><dt><Icon name="code" size={16} />Mã môn</dt><dd>{subject.code || 'Chưa cập nhật'}</dd></div>
        <div><dt><Icon name="layers" size={16} />Số tín chỉ</dt><dd>{subject.credits ? `${subject.credits} tín chỉ` : 'Chưa cập nhật'}</dd></div>
        <div><dt><Icon name="user" size={16} />Giảng viên</dt><dd>{subject.teacher || 'Chưa cập nhật'}</dd></div>
        <div><dt><Icon name="calendar" size={16} />Học kỳ</dt><dd>{semester?.name ?? 'Chưa cập nhật'}</dd></div>
        {semester && <div><dt><Icon name="clock" size={16} />Thời gian</dt><dd>{formatDate(semester.startDate, true)} — {formatDate(semester.endDate, true)}</dd></div>}
      </dl>
      <div className="subject-info-actions"><button className="button button-primary" disabled={!canManageSubjects || state.loading || !!state.error} onClick={() => { setNotice(''); setEditing(true) }}><Icon name="edit" size={16} />Chỉnh sửa môn</button><button className="button button-secondary danger-text" disabled={!canManageSubjects || state.loading || !!state.error} onClick={() => requestDelete('subject', subject.id)}><Icon name="trash" size={16} />Xóa môn học</button></div>
    </div>
  </Modal>
}
