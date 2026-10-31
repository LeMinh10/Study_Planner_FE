import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlanner } from '../contexts/PlannerContext'
import { Icon } from '../components/Icon'
import { ActionMenu } from '../components/ActionMenu'
import { EmptyState, PageHeading } from '../components/PlannerUI'
import { StudentTaskList } from '../components/StudentTasks'
import { SubjectEditor } from './AcademicPages'
import { completion, dateKey, deadline, vietnamToday } from '../utils/planner'
import { upcomingClasses } from '../utils/studentView'

export function SubjectDetailPage() {
  const { subjectId } = useParams()
  const { canMutate, data, dispatch, now, createTask, requestDelete } = usePlanner()
  const [editing, setEditing] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const subject = data.subjects.find((item) => item.id === subjectId)
  if (!subject) return <section className="empty-page"><h1>Không tìm thấy môn học</h1><p>Môn học có thể đã được xóa hoặc đường dẫn chưa đúng.</p><Link className="button button-primary" to="/subjects">Về các môn học<Icon name="arrow-right" size={16} /></Link></section>
  const semester = data.semesters.find((item) => item.id === subject.semesterId)!
  const tasks = data.tasks.filter((task) => task.subjectId === subject.id)
  const pending = tasks.filter((task) => task.status !== 'done').sort((a, b) => deadline(a) - deadline(b))
  const done = tasks.filter((task) => task.status === 'done')
  const upcoming = upcomingClasses(data, now, subject.id, 3)

  return <>
    <Link to="/subjects" className="student-back-link"><Icon name="chevron-left" size={15} />Các môn học của tôi</Link>
    {subject.semesterId !== data.selectedSemesterId && <div className="inline-notice">Môn học này thuộc {semester.name}.<button className="text-button" onClick={() => dispatch({ type: 'select-semester', id: subject.semesterId })}>Xem học kỳ này<Icon name="arrow-right" size={14} /></button></div>}
    <div className={'subject-detail-heading ' + subject.color}><span className="subject-detail-book"><Icon name="book" size={34} /></span><PageHeading eyebrow={subject.code + ' · ' + semester.name} title={subject.name} description={subject.teacher ? 'Giảng viên: ' + subject.teacher + ' · ' + subject.credits + ' tín chỉ' : subject.credits + ' tín chỉ'}><button className="button button-primary" onClick={() => createTask(subject.id)}><Icon name="plus" size={17} />Thêm nhiệm vụ</button><ActionMenu label="Tùy chọn môn học"><button onClick={() => { if (canMutate) setEditing(true) }}><Icon name="edit" size={15} />Sửa thông tin môn</button><button className="danger-text" onClick={() => requestDelete('subject', subject.id)}><Icon name="trash" size={15} />Xóa môn học</button></ActionMenu></PageHeading></div>
    <div className="subject-room-grid"><div><section className="subject-room-tasks"><div className="student-section-heading"><div><h2>Nhiệm vụ</h2></div><div className="segmented-control" role="group" aria-label="Xem nhiệm vụ trong môn"><button className={!showDone ? 'active' : ''} aria-pressed={!showDone} onClick={() => setShowDone(false)}>Cần làm <span>{pending.length}</span></button><button className={showDone ? 'active' : ''} aria-pressed={showDone} onClick={() => setShowDone(true)}>Đã xong <span>{done.length}</span></button></div></div>{(showDone ? done : pending).length ? <StudentTaskList tasks={showDone ? done : pending} showSubject={false} /> : <div className="paper-panel"><EmptyState title={showDone ? 'Chưa có nhiệm vụ hoàn thành' : 'Không có nhiệm vụ cần làm'} /></div>}</section>
      <div className="subject-room-progress"><Icon name="leaf" size={19} /><div><strong>{done.length}/{tasks.length} nhiệm vụ đã xong</strong><progress max="100" value={completion(tasks)} aria-label="Tiến độ môn học" /></div><span>{completion(tasks)}%</span></div>
    </div><aside className="subject-room-aside"><section className="subject-next-lessons"><div className="student-section-heading"><h2>Buổi học sắp tới</h2><Link to="/calendar" className="icon-button" aria-label="Xem lịch của tôi"><Icon name="calendar" size={18} /></Link></div>{upcoming.length ? upcoming.map((occurrence) => <article key={occurrence.slot.id + dateKey(occurrence.date)}><span>{dateKey(occurrence.date) === dateKey(vietnamToday(new Date(now))) ? 'Hôm nay' : occurrence.date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span><strong>{occurrence.slot.start} — {occurrence.slot.end}</strong><p>{occurrence.slot.title}</p><small>{occurrence.slot.room || 'Chưa có địa điểm'}</small></article>) : <p className="subject-no-lessons">Chưa có lịch học tiếp theo cho môn này.</p>}<Link to="/schedule" className="student-aside-link">Sắp xếp thời khóa biểu<Icon name="arrow-right" size={14} /></Link></section><details className="subject-info-details"><summary>Thông tin môn học<Icon name="book" size={16} /></summary><dl><div><dt>Giảng viên</dt><dd>{subject.teacher || 'Chưa cập nhật'}</dd></div><div><dt>Số tín chỉ</dt><dd>{subject.credits}</dd></div><div><dt>Học kỳ</dt><dd>{semester.name}</dd></div></dl><button className="text-button" onClick={() => { if (canMutate) setEditing(true) }}>Chỉnh sửa thông tin<Icon name="edit" size={14} /></button></details></aside></div>
    {editing && <SubjectEditor subject={subject} onClose={() => setEditing(false)} />}
  </>
}
