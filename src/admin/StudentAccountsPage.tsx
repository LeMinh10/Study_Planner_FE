import { useState } from 'react'
import { Icon } from '../components/Icon'

interface StudentAccount {
  id: string
  name: string
  email: string
  studentId: string
  status: 'active' | 'locked'
  createdAt: string
}

const emptyStudents: StudentAccount[] = []

export function StudentAccountsPage({ students = emptyStudents }: { students?: readonly StudentAccount[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const search = query.trim().toLocaleLowerCase('vi')
  const filtered = students.filter((student) =>
    (status === 'all' || student.status === status) &&
    `${student.name} ${student.email} ${student.studentId}`.toLocaleLowerCase('vi').includes(search),
  )
  const filtering = search !== '' || status !== 'all'

  return <section className="admin-students" aria-labelledby="admin-students-title">
    <div className="admin-page-heading"><span className="admin-label">QUẢN LÝ SINH VIÊN</span><h1 id="admin-students-title">Tài khoản sinh viên</h1><p>Theo dõi danh sách và trạng thái tài khoản sinh viên.</p></div>
    <div className="admin-stats" aria-label="Thống kê tài khoản">
      <article><span className="admin-stat-icon"><Icon name="user" size={21} /></span><div><p>Tổng tài khoản</p><strong>{students.length}</strong></div></article>
      <article><span className="admin-stat-icon active"><Icon name="check" size={21} /></span><div><p>Đang hoạt động</p><strong>{students.filter((student) => student.status === 'active').length}</strong></div></article>
      <article><span className="admin-stat-icon locked"><Icon name="pause" size={21} /></span><div><p>Đã khóa</p><strong>{students.filter((student) => student.status === 'locked').length}</strong></div></article>
    </div>
    <section className="admin-students-panel" aria-labelledby="admin-list-title">
      <div className="admin-list-heading"><h2 id="admin-list-title">Danh sách sinh viên</h2><span>{filtered.length} tài khoản</span></div>
      <div className="admin-filters">
        <label className="admin-search"><Icon name="search" size={18} /><span className="sr-only">Tìm tài khoản sinh viên</span><input type="search" placeholder="Tìm tên, email hoặc mã sinh viên…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="admin-status-filter"><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option></select></label>
      </div>
      <div className="admin-table-container">
        <table className="admin-students-table">
          <caption className="sr-only">Danh sách tài khoản sinh viên</caption>
          <thead><tr><th scope="col">Sinh viên</th><th scope="col">Email</th><th scope="col">Mã sinh viên</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th></tr></thead>
          <tbody>{filtered.length ? filtered.map((student) => <tr key={student.id}><td>{student.name}</td><td>{student.email}</td><td>{student.studentId || '—'}</td><td><span className={'admin-status ' + student.status}>{student.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}</span></td><td>{new Date(student.createdAt).toLocaleDateString('vi-VN')}</td></tr>) : <tr><td colSpan={5}><div className="admin-empty-state"><span><Icon name={filtering ? 'search' : 'user'} size={30} /></span><h3>{filtering ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản sinh viên'}</h3><p>{filtering ? 'Thử từ khóa khác hoặc thay đổi bộ lọc trạng thái.' : 'Danh sách tài khoản sinh viên sẽ hiển thị tại đây khi có dữ liệu.'}</p>{filtering && <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setStatus('all') }}>Xóa bộ lọc</button>}</div></td></tr>}</tbody>
        </table>
      </div>
    </section>
  </section>
}
