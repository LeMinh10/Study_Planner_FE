import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePlanner } from '../contexts/PlannerContext'
import { SubjectForm } from '../components/SubjectForm'
import { PageHeading } from '../components/PlannerUI'
import { Icon } from '../components/Icon'

export function CreateSubjectPage() {
  const { data, dispatch, academicLoading, academicError, academicBusy, canManageSubjects, retryAcademic } = usePlanner()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const semesterId = params.get('semester') ?? data.selectedSemesterId
  const semester = data.semesters.find((item) => item.id === semesterId)

  return <div className="courses-page course-create-page">
    <Link to="/subjects" className="student-back-link"><Icon name="chevron-left" size={15} />Về các môn học</Link>
    <PageHeading eyebrow="KHÔNG GIAN HỌC TẬP" title="Thêm môn học" description="Tạo không gian học tập cho một môn trong học kỳ của bạn." />
    {academicLoading ? <section className="courses-empty" role="status"><span className="courses-empty-icon"><Icon name="book" size={28} /></span><p>Đang tải thông tin học kỳ…</p></section>
      : academicError && !canManageSubjects ? <section className="courses-empty courses-error" role="alert"><h2>Chưa thể thêm môn học</h2><p>{academicError}</p><button className="button button-primary" disabled={academicBusy} onClick={retryAcademic}><Icon name="reset" size={16} />Thử lại</button></section>
      : !data.semesters.length ? <section className="courses-empty"><span className="courses-empty-icon"><Icon name="layers" size={28} /></span><h2>Bạn cần có học kỳ trước</h2><p>Tạo một học kỳ để bắt đầu thêm môn học.</p><Link to="/semesters" className="button button-primary">Quản lý học kỳ<Icon name="arrow-right" size={16} /></Link></section>
      : !semester ? <section className="courses-empty" role="alert"><h2>Không tìm thấy học kỳ</h2><p>Học kỳ đã chọn không còn tồn tại. Hãy chọn lại từ danh sách môn học.</p><Link to="/subjects" className="button button-secondary">Về các môn học</Link></section>
      : <div className="course-create-layout">
        <section className="course-create-form" aria-label="Thông tin môn học mới">
          <SubjectForm defaultSemesterId={semester.id} onCancel={() => navigate('/subjects')} onSaved={(id) => {
            dispatch({ type: 'select-semester', id })
            navigate('/subjects', { replace: true, state: { subjectCreated: true } })
          }} />
        </section>
      </div>}
  </div>
}
