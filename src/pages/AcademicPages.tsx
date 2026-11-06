import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '../contexts/PlannerContext'
import { EmptyState, PageHeading } from '../components/PlannerUI'
import { Icon } from '../components/Icon'
import { ActionMenu } from '../components/ActionMenu'
import type { Semester } from '../types/planner'
import { completion, formatDate } from '../utils/planner'
import { SemesterEditor } from './AcademicEditors'
export { SubjectsPage } from './SubjectsPage'
export { SubjectEditor } from './SubjectEditor'

export function SemestersPage() {
  const { canManageSemesters, data, dispatch, requestDelete } = usePlanner()
  const [editing, setEditing] = useState<Semester | null | undefined>()
  return <>
    <Link to="/subjects" className="student-back-link"><Icon name="chevron-left" size={15} />Về các môn học của tôi</Link>
    <PageHeading title="Học kỳ"><button disabled={!canManageSemesters} className="button button-primary" onClick={() => { if (canManageSemesters) setEditing(null) }}><Icon name="plus" size={17} />Thêm học kỳ</button></PageHeading>
    <div className="semester-grid">{data.semesters.map((semester) => {
      const subjects = data.subjects.filter((subject) => subject.semesterId === semester.id)
      const tasks = data.tasks.filter((task) => subjects.some((subject) => subject.id === task.subjectId))
      const selected = data.selectedSemesterId === semester.id
      return <article className={`paper-panel semester-card${selected ? ' selected-semester' : ''}`} key={semester.id}><div className="semester-card-top"><span className="subject-symbol sage"><Icon name="layers" size={23} /></span>{selected && <span className="status-badge status-done">Đang xem</span>}<ActionMenu label={`Tùy chọn ${semester.name}`}><button disabled={!canManageSemesters} onClick={() => { if (canManageSemesters) setEditing(semester) }}><Icon name="edit" size={15} />Chỉnh sửa học kỳ</button><button disabled={!canManageSemesters} className="danger-text" onClick={() => requestDelete('semester', semester.id)}><Icon name="trash" size={15} />Xóa học kỳ</button></ActionMenu></div><h2>{semester.name}</h2><p className="muted">{formatDate(semester.startDate, true)} — {formatDate(semester.endDate, true)}</p><div className="semester-metrics"><span><strong>{subjects.length}</strong> môn học</span><span><strong>{subjects.reduce((sum, subject) => sum + subject.credits, 0)}</strong> tín chỉ</span><span><strong>{tasks.length}</strong> nhiệm vụ</span></div><div className="semester-progress"><span>Hoàn thành nhiệm vụ <strong>{completion(tasks)}%</strong></span><progress max="100" value={completion(tasks)} aria-label={`Tiến độ ${semester.name}`} /></div><button className={`button ${selected ? 'button-secondary' : 'button-primary'}`} disabled={selected} onClick={() => dispatch({ type: 'select-semester', id: semester.id })}>{selected ? 'Học kỳ đang chọn' : 'Chọn học kỳ này'}<Icon name="arrow-right" size={16} /></button></article>
    })}</div>
    {!data.semesters.length && <section className="paper-panel"><EmptyState title="Chưa có học kỳ" description="Học kỳ sẽ hiển thị khi có dữ liệu." /></section>}
    {editing !== undefined && <SemesterEditor semester={editing} onClose={() => setEditing(undefined)} />}
  </>
}
