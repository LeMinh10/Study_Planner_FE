import { useCallback, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { getUser } from '../api/admin'
import { ApiError } from '../api/client'
import { AccountStatusButton } from './AccountStatusButton'
import { useAdminResource } from './useAdminResource'

export function StudentDetailsPage() {
  const { studentId = '' } = useParams()
  const { search } = useLocation()
  const [message, setMessage] = useState('')
  const load = useCallback((token: string, signal: AbortSignal) => getUser(token, studentId, signal), [studentId])
  const { data: student, loading, error, reload } = useAdminResource(load)
  const notFound = error instanceof ApiError && [400, 404].includes(error.status)

  return <section className="admin-student-details-page" aria-labelledby="student-details-title">
    <Link to={'/admin/students' + search} className="admin-back-link"><Icon name="chevron-left" size={16} />Quay lại danh sách</Link>
    <div className="admin-page-heading"><span className="admin-label">QUẢN LÝ TÀI KHOẢN</span><h1 id="student-details-title">{notFound ? 'Không tìm thấy sinh viên' : student?.role === 'admin' ? 'Chi tiết tài khoản' : 'Chi tiết sinh viên'}</h1></div>
    {message && <p className="admin-feedback" role="status">{message}</p>}
    {loading && <p className="admin-table-message" role="status">Đang tải thông tin tài khoản…</p>}
    {error && <div className="admin-table-message"><p role="alert">{notFound ? 'Tài khoản không tồn tại hoặc đã bị xóa.' : error.message}</p>{!notFound && <button type="button" className="button button-secondary" onClick={reload}>Thử lại</button>}</div>}
    {student && <article className="admin-student-details">
      <div className="admin-student-summary">
        <span className="admin-avatar"><Icon name="user" size={22} /></span>
        <div><h2>{student.name}</h2><p>{student.role === 'admin' ? 'Quản trị viên' : student.studentId || 'Chưa cập nhật mã sinh viên'}</p></div>
      </div>
      <dl>
        <div><dt>Mã tài khoản</dt><dd>{student.id}</dd></div>
        <div><dt>Họ và tên</dt><dd>{student.name}</dd></div>
        <div><dt>Email</dt><dd>{student.email}</dd></div>
        <div><dt>Mã sinh viên</dt><dd>{student.studentId || 'Chưa cập nhật'}</dd></div>
        <div><dt>Trường</dt><dd>{student.schoolName || 'Chưa cập nhật'}</dd></div>
        <div><dt>Lớp</dt><dd>{student.className || 'Chưa cập nhật'}</dd></div>
        <div><dt>Ngành học</dt><dd>{student.major || 'Chưa cập nhật'}</dd></div>
        <div><dt>Vai trò</dt><dd>{student.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}</dd></div>
        <div><dt>Trạng thái</dt><dd><span className={'admin-status ' + student.status}>{student.status === 'active' ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></dd></div>
        <div><dt>Ngày tạo tài khoản</dt><dd>{new Date(student.createdAt).toLocaleString('vi-VN')}</dd></div>
        <div><dt>Cập nhật lần cuối</dt><dd>{new Date(student.updatedAt).toLocaleString('vi-VN')}</dd></div>
      </dl>
      <AccountStatusButton key={studentId} account={student} onUpdated={(message) => { setMessage(message); reload() }} />
    </article>}
  </section>
}
