import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import type { StudentAccount } from './studentAccounts'

export function StudentDetailsPage({ students = [] }: { students?: readonly StudentAccount[] }) {
  const { studentId } = useParams()
  const student = students.find((account) => account.id === studentId)

  return <section className="admin-student-details-page" aria-labelledby="student-details-title">
    <Link to="/admin/students" className="admin-back-link"><Icon name="chevron-left" size={16} />Quay lại danh sách</Link>
    <div className="admin-page-heading"><span className="admin-label">QUẢN LÝ SINH VIÊN</span><h1 id="student-details-title">{student ? 'Chi tiết sinh viên' : 'Không tìm thấy sinh viên'}</h1></div>
    {student ? <article className="admin-student-details">
      <div className="admin-student-summary">
        <span className="admin-avatar"><Icon name="user" size={22} /></span>
        <div><h2>{student.name}</h2><p>{student.studentId || 'Chưa cập nhật mã sinh viên'}</p></div>
      </div>
      <dl>
        <div><dt>Họ và tên</dt><dd>{student.name}</dd></div>
        <div><dt>Email</dt><dd>{student.email}</dd></div>
        <div><dt>Mã sinh viên</dt><dd>{student.studentId || 'Chưa cập nhật'}</dd></div>
        <div><dt>Trường</dt><dd>{student.schoolName || 'Chưa cập nhật'}</dd></div>
        <div><dt>Lớp</dt><dd>{student.className || 'Chưa cập nhật'}</dd></div>
        <div><dt>Trạng thái</dt><dd><span className={'admin-status ' + student.status}>{student.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}</span></dd></div>
        <div><dt>Ngày tạo tài khoản</dt><dd>{new Date(student.createdAt).toLocaleDateString('vi-VN')}</dd></div>
      </dl>
    </article> : <p className="admin-student-not-found">Sinh viên không có trong danh sách tài khoản hiện tại.</p>}
  </section>
}
