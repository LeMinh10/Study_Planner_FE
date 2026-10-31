import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '../contexts/PlannerContext'
import { EmptyState, FormActions, Modal, PageHeading } from '../components/PlannerUI'
import { Icon } from '../components/Icon'
import { ActionMenu } from '../components/ActionMenu'
import { closestTask, taskDueLabel, upcomingClasses } from '../utils/studentView'
import type { Semester, Subject, SubjectColor } from '../types/planner'
import { completion, dateKey, formatDate, slotsOverlap, vietnamToday } from '../utils/planner'

export function SemestersPage() {
  const { canMutate, data, dispatch, requestDelete } = usePlanner()
  const [editing, setEditing] = useState<Semester | null | undefined>()
  return <>
    <Link to="/subjects" className="student-back-link"><Icon name="chevron-left" size={15} />Về các môn học của tôi</Link>
    <PageHeading title="Học kỳ"><button className="button button-primary" onClick={() => { if (canMutate) setEditing(null) }}><Icon name="plus" size={17} />Thêm học kỳ</button></PageHeading>
    <div className="semester-grid">{data.semesters.map((semester) => {
      const subjects = data.subjects.filter((subject) => subject.semesterId === semester.id)
      const tasks = data.tasks.filter((task) => subjects.some((subject) => subject.id === task.subjectId))
      const selected = data.selectedSemesterId === semester.id
      return <article className={`paper-panel semester-card${selected ? ' selected-semester' : ''}`} key={semester.id}><div className="semester-card-top"><span className="subject-symbol sage"><Icon name="layers" size={23} /></span>{selected && <span className="status-badge status-done">Đang xem</span>}<ActionMenu label={`Tùy chọn ${semester.name}`}><button onClick={() => { if (canMutate) setEditing(semester) }}><Icon name="edit" size={15} />Chỉnh sửa học kỳ</button><button className="danger-text" onClick={() => requestDelete('semester', semester.id)}><Icon name="trash" size={15} />Xóa học kỳ</button></ActionMenu></div><h2>{semester.name}</h2><p className="muted">{formatDate(semester.startDate, true)} — {formatDate(semester.endDate, true)}</p><div className="semester-metrics"><span><strong>{subjects.length}</strong> môn học</span><span><strong>{subjects.reduce((sum, subject) => sum + subject.credits, 0)}</strong> tín chỉ</span><span><strong>{tasks.length}</strong> nhiệm vụ</span></div><div className="semester-progress"><span>Hoàn thành nhiệm vụ <strong>{completion(tasks)}%</strong></span><progress max="100" value={completion(tasks)} aria-label={`Tiến độ ${semester.name}`} /></div><button className={`button ${selected ? 'button-secondary' : 'button-primary'}`} disabled={selected} onClick={() => dispatch({ type: 'select-semester', id: semester.id })}>{selected ? 'Học kỳ đang chọn' : 'Chọn học kỳ này'}<Icon name="arrow-right" size={16} /></button></article>
    })}</div>
    {!data.semesters.length && <section className="paper-panel"><EmptyState title="Chưa có học kỳ" description="Học kỳ sẽ hiển thị khi có dữ liệu." /></section>}
    {editing !== undefined && <SemesterEditor semester={editing} onClose={() => setEditing(undefined)} />}
  </>
}

function SemesterEditor({ semester, onClose }: { semester: Semester | null; onClose: () => void }) {
  const { canMutate, data, dispatch } = usePlanner()
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canMutate) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const startDate = String(form.get('startDate'))
    const endDate = String(form.get('endDate'))
    if (!name || endDate < startDate) { setError('Tên học kỳ không được trống; ngày kết thúc phải từ ngày bắt đầu trở đi.'); return }
    if (data.semesters.some((item) => item.id !== semester?.id && item.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) { setError('Tên học kỳ này đã được sử dụng.'); return }
    dispatch({ type: 'save-semester', value: { id: semester?.id ?? crypto.randomUUID(), name, startDate, endDate } })
    onClose()
  }
  return <Modal title={semester ? 'Chỉnh sửa học kỳ' : 'Thêm học kỳ'} onClose={onClose}><form className="session-form" onSubmit={submit}><label>Tên học kỳ<input name="name" defaultValue={semester?.name} maxLength={100} placeholder="Học kỳ I · 2026–2027" required autoFocus /></label><div className="form-grid"><label>Ngày bắt đầu<input type="date" name="startDate" defaultValue={semester?.startDate ?? dateKey(vietnamToday())} required /></label><label>Ngày kết thúc<input type="date" name="endDate" defaultValue={semester?.endDate} required /></label></div><p className="field-hint">Lịch học định kỳ chỉ xuất hiện trong khoảng ngày của học kỳ.</p>{error && <p className="form-error" role="alert">{error}</p>}<FormActions onClose={onClose} /></form></Modal>
}

export function SubjectsPage() {
  const { canMutate, data, tasks, now, requestDelete } = usePlanner()
  const [editing, setEditing] = useState<Subject | null | undefined>()
  const [search, setSearch] = useState('')
  const subjects = data.subjects.filter((subject) => subject.semesterId === data.selectedSemesterId && (subject.name + ' ' + subject.code).toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
  return <>
    <PageHeading title="Môn học"><Link to="/semesters" className="button button-secondary"><Icon name="layers" size={16} />Học kỳ của tôi</Link><button className="button button-primary" onClick={() => { if (canMutate) setEditing(null) }}><Icon name="plus" size={17} />Thêm môn học</button></PageHeading>
    {!data.semesters.length && <div className="inline-notice">Chưa có dữ liệu học kỳ. <Link to="/semesters">Xem học kỳ <Icon name="arrow-right" size={14} /></Link></div>}
    <div className="subject-study-toolbar"><label className="table-search"><Icon name="search" size={17} /><input type="search" placeholder="Tìm tên hoặc mã môn học" value={search} aria-label="Tìm môn học" onChange={(event) => setSearch(event.target.value)} /></label><span>{subjects.length} môn trong học kỳ này</span></div>
    {subjects.length ? <div className="subject-study-grid">{subjects.map((subject) => {
      const related = tasks.filter((task) => task.subjectId === subject.id)
      const pending = related.filter((task) => task.status !== 'done')
      const next = upcomingClasses(data, now, subject.id, 1)[0]
      const nearestTask = closestTask(related, now)
      return <article className={'subject-study-card ' + subject.color} key={subject.id}>
        <div className="subject-study-card-top"><span className="subject-symbol"><Icon name="book" size={23} /></span><span className="subject-code">{subject.code}</span><ActionMenu label={'Tùy chọn môn ' + subject.name}><button onClick={() => { if (canMutate) setEditing(subject) }}><Icon name="edit" size={15} />Chỉnh sửa thông tin</button><button className="danger-text" onClick={() => requestDelete('subject', subject.id)}><Icon name="trash" size={15} />Xóa môn học</button></ActionMenu></div>
        <h2><Link to={'/subjects/' + subject.id}>{subject.name}</Link></h2><p className="subject-study-teacher">{subject.teacher || 'Giảng viên chưa cập nhật'}</p>
        <div className="subject-next-class"><span>Buổi học tiếp theo</span>{next ? <><strong>{next.date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })} · {next.slot.start}</strong><small>{next.slot.room || 'Chưa có địa điểm'}</small></> : <strong>Chưa có lịch tiếp theo</strong>}</div>
        <div className="subject-study-work"><span><strong>{pending.length}</strong> nhiệm vụ còn lại</span>{nearestTask && <span>Hạn gần nhất: {taskDueLabel(nearestTask, now)}</span>}</div>
        <div className="subject-study-progress"><progress max="100" value={completion(related)} aria-label={'Tiến độ môn ' + subject.name} /><span>{related.filter((task) => task.status === 'done').length}/{related.length} nhiệm vụ đã xong</span></div>
        <Link to={'/subjects/' + subject.id} className="subject-enter">Vào môn học<Icon name="arrow-right" size={16} /></Link>
      </article>
    })}</div> : <section className="paper-panel"><EmptyState title={search.trim() ? 'Không tìm thấy môn học' : 'Chưa có môn học'} description={search.trim() ? 'Tìm bằng tên hoặc mã môn học khác.' : undefined} /></section>}
    {editing !== undefined && <SubjectEditor subject={editing} onClose={() => setEditing(undefined)} />}
  </>
}

export function SubjectEditor({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const { canMutate, data, dispatch } = usePlanner()
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canMutate) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const code = String(form.get('code')).trim().toLocaleUpperCase('vi')
    const semesterId = String(form.get('semesterId'))
    if (!name || !code || !data.semesters.some((semester) => semester.id === semesterId)) { setError('Nhập tên, mã môn và chọn học kỳ.'); return }
    if (data.subjects.some((item) => item.id !== subject?.id && item.semesterId === semesterId && item.code.toLocaleLowerCase('vi') === code.toLocaleLowerCase('vi'))) { setError('Mã môn học đã tồn tại trong học kỳ này.'); return }
    if (subject && semesterId !== subject.semesterId) {
      const semester = data.semesters.find((item) => item.id === semesterId)!
      const inSemester = (date: string | undefined) => !date || (date >= semester.startDate && date <= semester.endDate)
      const ownSlots = data.schedule.filter((slot) => slot.subjectId === subject.id && inSemester(slot.date))
      const targetSlots = data.schedule.filter((slot) => data.subjects.some((item) => item.id === slot.subjectId && item.semesterId === semesterId) && inSemester(slot.date))
      if (ownSlots.some((slot) => targetSlots.some((target) => slotsOverlap(slot, target)))) { setError('Chuyển môn học sẽ làm trùng thời khóa biểu ở học kỳ mới. Hãy điều chỉnh lịch học trước.'); return }
    }
    dispatch({ type: 'save-subject', value: { id: subject?.id ?? crypto.randomUUID(), semesterId, name, code, credits: Number(form.get('credits')), teacher: String(form.get('teacher')).trim(), color: String(form.get('color')) as SubjectColor } })
    onClose()
  }
  return <Modal title={subject ? 'Chỉnh sửa môn học' : 'Thêm môn học'} onClose={onClose}><form className="session-form" onSubmit={submit}><label>Tên môn học<input name="name" defaultValue={subject?.name} maxLength={100} required autoFocus /></label><div className="form-grid"><label>Mã môn<input name="code" defaultValue={subject?.code} maxLength={30} required /></label><label>Số tín chỉ<input name="credits" type="number" min="1" max="30" step="1" defaultValue={subject?.credits ?? 3} required /></label></div><label>Học kỳ<select name="semesterId" defaultValue={subject?.semesterId ?? data.selectedSemesterId}>{data.semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.name}</option>)}</select></label><label>Giảng viên<input name="teacher" defaultValue={subject?.teacher} maxLength={100} /></label><label>Màu nhận diện<select name="color" defaultValue={subject?.color ?? 'sage'}><option value="sage">Xanh lá</option><option value="clay">Cam đất</option><option value="lavender">Tím nhạt</option><option value="blue">Xanh dương</option></select></label>{subject && <p className="field-hint">Chuyển học kỳ sẽ chuyển cả nhiệm vụ và thời khóa biểu của môn học sang học kỳ mới.</p>}{error && <p className="form-error" role="alert">{error}</p>}<FormActions onClose={onClose} /></form></Modal>
}
