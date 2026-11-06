import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlanner } from '../contexts/PlannerContext'
import { Icon } from '../components/Icon'
import { ActionMenu } from '../components/ActionMenu'
import { PageHeading } from '../components/PlannerUI'
import type { Subject } from '../types/planner'
import { formatDate } from '../utils/planner'
import { SubjectEditor } from './SubjectEditor'
import { SemesterEditor } from './AcademicEditors'

export function SubjectsPage() {
  const { data, dispatch, canManageSubjects, canManageSemesters, academicLoading, academicError, academicBusy, retryAcademic, requestDelete } = usePlanner()
  const [editing, setEditing] = useState<Subject | undefined>()
  const [addingSemester, setAddingSemester] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(location.state?.subjectCreated === true ? 'Đã thêm môn học vào học kỳ.' : '')
  const semester = data.semesters.find((item) => item.id === data.selectedSemesterId)
  const allSubjects = data.subjects.filter((subject) => subject.semesterId === semester?.id)
  const keyword = search.trim().toLocaleLowerCase('vi')
  const subjects = allSubjects.filter((subject) => `${subject.name} ${subject.code} ${subject.teacher}`.toLocaleLowerCase('vi').includes(keyword))
    .sort((a, b) => sort === 'credits' ? b.credits - a.credits || a.name.localeCompare(b.name, 'vi') : a.name.localeCompare(b.name, 'vi'))
  const credits = allSubjects.reduce((sum, subject) => sum + subject.credits, 0)

  function addSubject() { if (canManageSubjects && semester) navigate('/subjects/new?' + new URLSearchParams({ semester: semester.id })) }

  return <div className="courses-page">
    <PageHeading title="Các môn học">
      <Link to="/semesters" className="button button-secondary"><Icon name="layers" size={16} />Quản lý học kỳ</Link>
      <button className="button button-primary" disabled={!canManageSubjects || !semester} onClick={addSubject}><Icon name="plus" size={17} />Thêm môn học</button>
    </PageHeading>

    <section className="courses-semester" aria-label="Tổng quan học kỳ">
      <span className="courses-semester-icon"><Icon name="layers" size={23} /></span>
      <div className="courses-semester-choice">
        <label className="sr-only" htmlFor="courses-semester">Học kỳ đang xem</label>
        <select id="courses-semester" value={data.selectedSemesterId} disabled={academicLoading || !data.semesters.length} onChange={(event) => dispatch({ type: 'select-semester', id: event.target.value })}>
          {!data.semesters.length && <option value="">Chưa có học kỳ</option>}
          {data.semesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <span>{semester ? `${formatDate(semester.startDate, true)} — ${formatDate(semester.endDate, true)}` : 'Tạo học kỳ để bắt đầu thêm môn học'}</span>
      </div>
      <dl className="courses-totals" aria-label="Thống kê môn trong học kỳ">
        <div><dt>Môn học</dt><dd>{academicLoading || academicError ? '—' : allSubjects.length}</dd></div>
        <div><dt>Tổng tín chỉ</dt><dd>{academicLoading || academicError ? '—' : credits}</dd></div>
      </dl>
    </section>

    {notice && <div className="courses-success" role="status"><Icon name="check" size={17} />{notice}<button className="icon-button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><Icon name="close" size={15} /></button></div>}

    <div className="courses-toolbar">
      <label className="courses-search"><Icon name="search" size={18} /><input type="search" name="courseSearch" aria-label="Tìm môn học" placeholder="Tìm tên môn, mã môn hoặc giảng viên…" value={search} onChange={(event) => setSearch(event.target.value)} disabled={academicLoading || !!academicError} /></label>
      <div className="courses-toolbar-options">
        <label className="courses-sort"><span>Sắp xếp</span><select aria-label="Sắp xếp môn học" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Tên A – Z</option><option value="credits">Tín chỉ nhiều nhất</option></select></label>
        <div className="courses-view" role="group" aria-label="Kiểu hiển thị môn học">
          <button aria-label="Hiển thị dạng thẻ" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="overview" size={17} /></button>
          <button aria-label="Hiển thị dạng danh sách" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={18} /></button>
        </div>
      </div>
    </div>

    {academicLoading ? <div className="courses-loading" role="status"><span className="sr-only">Đang tải danh sách môn học…</span><div className="courses-grid" aria-hidden="true">{[0, 1, 2].map((key) => <div className="course-skeleton" key={key}><i /><span /><span /><span /></div>)}</div></div>
      : academicError ? <section className="courses-empty courses-error" role="alert"><span className="courses-empty-icon"><Icon name="reset" size={28} /></span><h2>Chưa tải được môn học</h2><p>{academicError}</p><button className="button button-primary" disabled={academicBusy} onClick={retryAcademic}><Icon name="reset" size={16} />Thử lại</button></section>
      : !semester ? <section className="courses-empty"><span className="courses-empty-icon"><Icon name="layers" size={30} /></span><h2>Bắt đầu với một học kỳ</h2><p>Tạo học kỳ đầu tiên, sau đó thêm những môn bạn sẽ học.</p><button className="button button-primary" disabled={!canManageSemesters} onClick={() => setAddingSemester(true)}><Icon name="plus" size={17} />Thêm học kỳ</button></section>
      : !subjects.length ? <section className="courses-empty"><span className="courses-empty-icon"><Icon name={keyword ? 'search' : 'book'} size={30} /></span><h2>{keyword ? 'Không tìm thấy môn học' : 'Học kỳ này chưa có môn học'}</h2><p>{keyword ? 'Thử tìm bằng tên, mã môn hoặc giảng viên khác.' : `Thêm môn đầu tiên vào ${semester.name} để bắt đầu sắp xếp việc học.`}</p>{keyword ? <button className="button button-secondary" onClick={() => setSearch('')}>Xóa tìm kiếm</button> : <button className="button button-primary" disabled={!canManageSubjects} onClick={addSubject}><Icon name="plus" size={17} />Thêm môn học</button>}</section>
      : <>
        <div className="courses-result-count" role="status">{keyword ? `${subjects.length} kết quả cho “${search.trim()}”` : `${subjects.length} môn học trong học kỳ`}</div>
        <div className={`courses-grid${view === 'list' ? ' courses-list' : ''}`}>
          {subjects.map((subject) => <article className={`course-card ${subject.color}`} key={subject.id} style={subject.colorHex ? { '--course-color': subject.colorHex } as CSSProperties : undefined}>
            <div className="course-card-top"><span className="course-card-icon"><Icon name="book" size={23} /></span><span className="course-card-code">{subject.code || 'Chưa có mã môn'}</span>
              <ActionMenu label={`Tùy chọn môn ${subject.name}`}><button disabled={!canManageSubjects} onClick={() => { setNotice(''); setEditing(subject) }}><Icon name="edit" size={15} />Chỉnh sửa môn học</button><button disabled={!canManageSubjects} className="danger-text" onClick={() => requestDelete('subject', subject.id)}><Icon name="trash" size={15} />Xóa môn học</button></ActionMenu>
            </div>
            <div className="course-card-main"><h2><Link to={`/tasks?subject=${subject.id}`}>{subject.name}</Link></h2><p className={!subject.teacher ? 'course-teacher-empty' : ''}><Icon name="user" size={15} /><span>{subject.teacher || 'Chưa cập nhật giảng viên'}</span></p></div>
            <div className="course-card-footer"><span className="course-credits"><Icon name="layers" size={14} />{subject.credits ? `${subject.credits} tín chỉ` : 'Chưa có tín chỉ'}</span><Link to={`/tasks?subject=${subject.id}`} aria-label={`Xem môn ${subject.name}`}>Xem môn học<Icon name="arrow-right" size={16} /></Link></div>
          </article>)}
          {!keyword && view === 'grid' && <button className="course-add-card" disabled={!canManageSubjects} onClick={addSubject}><span><Icon name="plus" size={25} /></span><strong>Thêm môn học</strong></button>}
        </div>
      </>}

    {editing !== undefined && <SubjectEditor subject={editing} onClose={() => setEditing(undefined)} onSaved={() => setNotice('Đã cập nhật môn học.')} />}
    {addingSemester && <SemesterEditor semester={null} onClose={() => setAddingSemester(false)} />}
  </div>
}
