import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { listUsers } from '../api/admin'
import { AccountStatusButton } from './AccountStatusButton'
import { useAdminResource } from './useAdminResource'

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const number = Number(value)
  return value && /^\d+$/.test(value) && Number.isSafeInteger(number) && number >= 1 && number <= maximum ? number : fallback
}

export function StudentAccountsPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('TuKhoa') || ''
  const page = positiveInteger(params.get('Trang'), 1, 2147483647)
  const pageSize = positiveInteger(params.get('KichThuocTrang'), 20, 100)
  const status = params.get('DangHoatDong') === 'true' ? 'active' : params.get('DangHoatDong') === 'false' ? 'locked' : 'all'
  const role = params.get('VaiTro') === 'Student' ? 'sinhvien' : params.get('VaiTro') === 'Admin' ? 'admin' : undefined
  const createdFrom = params.get('TaoTu') || undefined
  const createdTo = params.get('TaoDen') || undefined
  const [message, setMessage] = useState('')
  const load = useCallback((token: string, signal: AbortSignal) => listUsers(token, { search: query, page, pageSize, isActive: status === 'all' ? undefined : status === 'active', role, createdFrom, createdTo, signal }), [query, page, pageSize, status, role, createdFrom, createdTo])
  const { data, loading, error, reload } = useAdminResource(load)
  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || pageSize)))
  const filtering = query.trim() !== '' || status !== 'all' || !!role || !!createdFrom || !!createdTo
  const listSearch = params.toString() ? '?' + params.toString() : ''

  useEffect(() => {
    if (data && page > pages) setParams((previous) => { const next = new URLSearchParams(previous); next.set('Trang', String(pages)); return next }, { replace: true })
  }, [data, page, pages, setParams])

  function changeFilter(key: string, value: string) {
    setMessage('')
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      next.set('Trang', '1')
      return next
    }, { replace: true })
  }
  function changePage(nextPage: number) {
    setParams((previous) => { const next = new URLSearchParams(previous); next.set('Trang', String(nextPage)); return next })
  }
  function updated(message: string) { setMessage(message); reload() }

  return <section className="admin-students" aria-labelledby="admin-students-title">
    <div className="admin-page-heading"><h1 id="admin-students-title" className="admin-label admin-students-heading">QUẢN LÝ TÀI KHOẢN SINH VIÊN</h1></div>
    {message && <p className="admin-feedback" role="status">{message}</p>}
    <section className="admin-students-panel" aria-labelledby="admin-list-title">
      <div className="admin-list-heading"><h2 id="admin-list-title">Danh sách tài khoản</h2><span>{data ? `${data.total} tài khoản` : loading ? 'Đang tải…' : '—'}</span></div>
      <div className="admin-filters">
        <label className="admin-search"><Icon name="search" size={18} /><span className="sr-only">Tìm tài khoản sinh viên</span><input type="search" placeholder="Tìm tên, email hoặc mã sinh viên…" maxLength={200} value={query} onChange={(event) => changeFilter('TuKhoa', event.target.value)} /></label>
        <label className="admin-status-filter"><span>Trạng thái</span><select value={status} onChange={(event) => changeFilter('DangHoatDong', event.target.value === 'all' ? '' : String(event.target.value === 'active'))}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="locked">Đã vô hiệu hóa</option></select></label>
      </div>
      {(role || createdFrom || createdTo) && <div className="admin-filter-chips">
        {role && <span>{role === 'sinhvien' ? 'Sinh viên' : 'Quản trị viên'}<button type="button" aria-label="Bỏ lọc vai trò" onClick={() => changeFilter('VaiTro', '')}><Icon name="close" size={12} /></button></span>}
        {(createdFrom || createdTo) && <span>Ngày đăng ký: {createdFrom ? new Date(createdFrom).toLocaleDateString('vi-VN') : '…'} – {createdTo ? new Date(createdTo).toLocaleDateString('vi-VN') : '…'}<button type="button" aria-label="Bỏ lọc ngày đăng ký" onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.delete('TaoTu'); next.delete('TaoDen'); next.set('Trang', '1'); return next }, { replace: true })}><Icon name="close" size={12} /></button></span>}
      </div>}
      <div className="admin-table-container" aria-busy={loading}>
        <table className="admin-students-table">
          <caption className="sr-only">Danh sách tài khoản người dùng</caption>
          <thead><tr><th scope="col">Họ và tên</th><th scope="col">Email</th><th scope="col">Mã sinh viên</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7}><p className="admin-table-message" role="status">Đang tải danh sách tài khoản…</p></td></tr>
            : error ? <tr><td colSpan={7}><div className="admin-table-message"><p role="alert">{error.message}</p><button type="button" className="button button-secondary" onClick={reload}>Thử lại</button></div></td></tr>
            : data?.items.length ? data.items.map((student) => <tr key={student.id}>
              <td>{student.name}</td><td>{student.email}</td><td>{student.studentId || '—'}</td><td>{student.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}</td>
              <td><span className={'admin-status ' + student.status}>{student.status === 'active' ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></td>
              <td>{new Date(student.createdAt).toLocaleDateString('vi-VN')}</td>
              <td><div className="admin-account-actions"><Link to={`/admin/students/${student.id}${listSearch}`} className="admin-detail-button" aria-label={`Xem chi tiết ${student.role === 'admin' ? 'tài khoản' : 'sinh viên'} ${student.name}`}>Xem chi tiết<Icon name="chevron-right" size={14} /></Link><AccountStatusButton account={student} onUpdated={updated} /></div></td>
            </tr>) : <tr><td colSpan={7}><div className="admin-empty-state"><span><Icon name={filtering ? 'search' : 'user'} size={30} /></span><h3>{filtering ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản'}</h3><p>{filtering ? 'Thử từ khóa khác hoặc thay đổi bộ lọc trạng thái.' : 'Danh sách tài khoản sẽ hiển thị tại đây khi có dữ liệu.'}</p>{filtering && <button type="button" className="button button-secondary" onClick={() => { setMessage(''); setParams({}) }}>Xóa bộ lọc</button>}</div></td></tr>}</tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <label className="admin-page-size">Số tài khoản mỗi trang<select value={pageSize} onChange={(event) => changeFilter('KichThuocTrang', event.target.value)}>{[...new Set([5, 10, 20, 50, 100, pageSize])].sort((a, b) => a - b).map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <span>{data ? `Trang ${data.page}/${pages} · ${data.total} tài khoản` : `Trang ${page}`}</span>
        <div><button type="button" aria-label="Trang trước" disabled={loading || !!error || page <= 1} onClick={() => changePage(page - 1)}><Icon name="chevron-left" size={16} />Trước</button><button type="button" aria-label="Trang sau" disabled={loading || !!error || !data || page >= pages} onClick={() => changePage(page + 1)}>Sau<Icon name="chevron-right" size={16} /></button></div>
      </div>
    </section>
  </section>
}
