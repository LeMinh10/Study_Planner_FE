import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { useAdminResource } from './useAdminResource'
import './learning.css'

interface Page<T> { danhSach: T[]; trang: number; kichThuocTrang: number; tongSo: number }
interface Task { ma: number; maSinhVien: number; hoTen: string; maSoSinhVien: string | null; maHocKy: number | null; tenHocKy: string | null; maMonHoc: number | null; tenMonHoc: string | null; maNhiemVuCha: number | null; tieuDe: string; trangThai: string; mucDoUuTien: string; tienDo: number; hanHieuLuc: string | null; ngayHoanThanh: string | null; coBuocNho: boolean }
interface Summary { tongNhiemVu: number; hoanThanh: number; dangLam: number; chuaBatDau: number; quaHan: number; soSinhVienCoNhiemVu: number; kiemTraLuc: string }
interface Scope { ma: number; ten: string; maHocKy: number | null }
interface Student { ma: number; hoTen: string; maSoSinhVien: string | null; dangHoatDong: boolean; muiGio: string; hocKy: Scope[]; monHoc: Scope[] }
interface Session { ma: number; maNhiemVu: number; tieuDeNhiemVu: string; batDauDuKien: string; ketThucDuKien: string; trangThai: string }
interface Focus { soPhien: number; tongMiliGiay: number; bamGioMiliGiay: number; nhapTayMiliGiay: number }
const statuses: Record<string, string> = { NotStarted: 'Chưa bắt đầu', InProgress: 'Đang thực hiện', Completed: 'Hoàn thành', Planned: 'Đã lên lịch', Missed: 'Bỏ lỡ', Cancelled: 'Đã hủy' }
const priority: Record<string, string> = { Low: 'Thấp', Medium: 'Vừa', High: 'Cao' }
const root = '/admin/learning'
function positive(value: string | null) { return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647 ? Number(value) : undefined }
function when(value: string | null, zone = 'Asia/Ho_Chi_Minh') { return value ? new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa đặt hạn' }
function duration(ms: number) { return `${Math.floor(ms / 3600000)} giờ ${Math.floor(ms / 60000) % 60} phút` }

export function AdminLearningPage() {
  const [params, setParams] = useSearchParams()
  const studentId = positive(params.get('student'))
  const page = positive(params.get('page')) ?? 1
  const semester = positive(params.get('semester'))
  const course = positive(params.get('course'))
  const status = Object.keys(statuses).slice(0, 3).includes(params.get('status') ?? '') ? params.get('status')! : ''
  const search = (params.get('q') ?? '').slice(0, 200)
  const overdue = params.get('overdue') === 'true'
  const children = params.get('children') === 'true'
  const query = new URLSearchParams({ Trang: String(page), KichThuocTrang: '20', GomBuocNho: String(children) })
  if (studentId) query.set('MaSinhVien', String(studentId))
  if (semester) query.set('MaHocKy', String(semester))
  if (course) query.set('MaMonHoc', String(course))
  if (search.trim()) query.set('TuKhoa', search.trim())
  if (status) query.set('TrangThai', status)
  if (overdue) query.set('ChiQuaHan', 'true')
  const queryText = query.toString()
  // Hồ sơ/phạm vi chỉ tải lại khi đổi sinh viên. Đổi bộ lọc nhiệm vụ không làm
  // biến mất các ô chọn môn/học kỳ trong lúc chờ máy chủ trả danh sách mới.
  const loadStudent = useCallback(async (token: string, signal: AbortSignal) => {
    const value = studentId ? await apiRequest(`${root}/students/${studentId}`, { token, signal }) as Student : null
    if (value && (!Array.isArray(value.hocKy) || !Array.isArray(value.monHoc) || typeof value.muiGio !== 'string')) throw new Error('Thông tin học tập máy chủ trả về chưa hợp lệ.')
    return value
  }, [studentId])
  const studentResource = useAdminResource(loadStudent)
  const student = studentResource.data
  const load = useCallback(async (token: string, signal: AbortSignal) => {
    const [summary, tasks] = await Promise.all([
      apiRequest(`${root}/summary?${queryText}`, { token, signal }) as Promise<Summary>,
      apiRequest(`${root}/tasks?${queryText}`, { token, signal }) as Promise<Page<Task>>,
    ])
    validateLearningData(summary, tasks)
    return { summary, tasks }
  }, [queryText])
  const resource = useAdminResource(load)
  const data = resource.data
  const zone = student?.muiGio ?? 'Asia/Ho_Chi_Minh'
  function change(key: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); if (key === 'semester') next.delete('course'); return next }, { replace: true })
  }
  const totalPages = Math.max(1, Math.ceil((data?.tasks.tongSo ?? 0) / 20))
  return <section className="admin-learning">
    <header className="learning-heading"><div className="admin-page-heading"><h1>{student ? `Học tập · ${student.hoTen}` : 'Theo dõi học tập'}</h1><p>Nhiệm vụ học tập có gắn học kỳ hoặc môn học; loại Cá nhân được giữ riêng cho sinh viên.</p></div>{studentId && <Link className="admin-detail-button" to="/admin/learning">Tất cả sinh viên</Link>}</header>
    {student && <p className="learning-scope">{student.maSoSinhVien || `Tài khoản #${studentId}`} · {student.dangHoatDong ? 'Tài khoản đang mở' : 'Tài khoản đã khóa'} · <Link to={`/admin/students/${studentId}`}>Thông tin tài khoản</Link></p>}
    <div className="learning-filters">
      <label>Tìm nhiệm vụ hoặc sinh viên<input type="search" aria-label="Tìm nhiệm vụ hoặc sinh viên" placeholder="Tên nhiệm vụ, họ tên, mã sinh viên…" maxLength={200} value={search} onChange={e => change('q', e.target.value)} /></label>
      <label>Trạng thái<select value={status} onChange={e => change('status', e.target.value)}><option value="">Tất cả</option>{['NotStarted', 'InProgress', 'Completed'].map(key => <option key={key} value={key}>{statuses[key]}</option>)}</select></label>
      {student && <><label>Học kỳ<select aria-label="Học kỳ" value={semester ?? ''} onChange={e => change('semester', e.target.value)}><option value="">Tất cả học kỳ</option>{student.hocKy.map(s => <option key={s.ma} value={s.ma}>{s.ten}</option>)}</select></label><label>Môn học<select aria-label="Môn học" value={course ?? ''} onChange={e => change('course', e.target.value)}><option value="">Tất cả môn học</option>{student.monHoc.filter(c => !semester || c.maHocKy === semester).map(c => <option key={c.ma} value={c.ma}>{c.ten}</option>)}</select></label></>}
      <label className="learning-check"><input type="checkbox" checked={overdue} onChange={e => change('overdue', e.target.checked ? 'true' : '')} />Chỉ quá hạn</label>
      <label className="learning-check"><input type="checkbox" checked={children} onChange={e => change('children', e.target.checked ? 'true' : '')} />Gồm bước nhỏ</label>
      <button type="button" className="admin-detail-button" onClick={() => setParams(studentId ? { student: String(studentId) } : {})}>Xóa bộ lọc</button>
    </div>
    {resource.error && <div role="alert" className="learning-feedback">{resource.error.message}<button type="button" onClick={resource.reload}>Thử lại</button></div>}
    {studentResource.error && <div role="alert" className="learning-feedback">{studentResource.error.message}<button type="button" onClick={studentResource.reload}>Thử lại hồ sơ</button></div>}
    {resource.loading && <p role="status" className="learning-feedback">Đang tải dữ liệu học tập…</p>}
    {data && <>
      <div className="learning-metrics">{[['Nhiệm vụ', data.summary.tongNhiemVu], ['Hoàn thành', data.summary.hoanThanh], ['Đang thực hiện', data.summary.dangLam], ['Chưa bắt đầu', data.summary.chuaBatDau], ['Quá hạn', data.summary.quaHan], ['Sinh viên có nhiệm vụ', data.summary.soSinhVienCoNhiemVu]].map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}</div>
      <p className="learning-note">{children ? 'Đang đếm cả nhiệm vụ chính và bước nhỏ.' : 'Thống kê nhiệm vụ chính; tiến độ đã tổng hợp từ các bước nhỏ.'} Số liệu theo bộ lọc đang chọn, cập nhật lúc {when(data.summary.kiemTraLuc, zone)}.</p>
      <section className="learning-panel"><div className="learning-panel-heading"><h2>Nhiệm vụ học tập</h2><span>{data.tasks.tongSo} nhiệm vụ</span></div><div className="admin-table-container"><table className="admin-students-table"><thead><tr><th>Nhiệm vụ</th><th>Sinh viên</th><th>Môn / học kỳ</th><th>Trạng thái</th><th>Tiến độ</th><th>Hạn hoàn thành</th></tr></thead><tbody>{data.tasks.danhSach.map(task => <tr key={task.ma}><td><strong>{task.tieuDe}</strong><small>{task.maNhiemVuCha ? `Bước nhỏ của #${task.maNhiemVuCha}` : task.coBuocNho ? 'Có bước nhỏ' : 'Nhiệm vụ chính'} · Quan trọng {priority[task.mucDoUuTien]?.toLowerCase()}</small></td><td><Link to={`/admin/learning?student=${task.maSinhVien}`}>{task.hoTen}</Link><small>{task.maSoSinhVien || `#${task.maSinhVien}`}</small></td><td>{task.tenMonHoc ?? 'Việc chung học kỳ'}<small>{task.tenHocKy}</small></td><td>{statuses[task.trangThai]}</td><td><progress max={100} value={task.tienDo} aria-label={`Tiến độ ${task.tieuDe}`} /><span>{task.tienDo}%</span></td><td className={task.trangThai !== 'Completed' && task.hanHieuLuc && Date.parse(task.hanHieuLuc) < Date.parse(data.summary.kiemTraLuc) ? 'learning-overdue' : ''}>{when(task.hanHieuLuc, zone)}</td></tr>)}</tbody></table>{!data.tasks.danhSach.length && <p className="learning-empty">Không có nhiệm vụ học tập phù hợp.</p>}</div><div className="admin-pagination"><span>Trang {page}/{totalPages}</span><div><button type="button" disabled={page <= 1} onClick={() => change('page', String(page - 1))}>Trước</button><button type="button" disabled={page >= totalPages} onClick={() => change('page', String(page + 1))}>Sau</button></div></div></section>
    </>}
    {studentId && student && <StudentStudy key={studentId} studentId={studentId} zone={zone} />}
  </section>
}

function StudentStudy({ studentId, zone }: { studentId: number; zone: string }) {
  const [range, setRange] = useState(() => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const first = new Date(Date.parse(today + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10)
    return { from: first, to: today }
  })
  const [page, setPage] = useState(1)
  // Hai ô ngày là ngày địa phương của sinh viên. Chuyển thành mốc ISO có múi giờ
  // trước khi gọi API, không lấy múi giờ của máy admin làm mốc thống kê.
  const interval = localDateRange(range.from, range.to, zone)
  const intervalKey = interval ? new URLSearchParams(interval).toString() : ''
  const load = useCallback(async (token: string, signal: AbortSignal) => {
    if (!intervalKey) throw new Error('Chọn ngày hợp lệ, từ ngày không sau đến ngày; tối đa 92 ngày lịch.')
    const [sessions, focus] = await Promise.all([
      apiRequest(`${root}/students/${studentId}/sessions?${intervalKey}&trang=${page}`, { token, signal }) as Promise<Page<Session>>,
      apiRequest(`${root}/students/${studentId}/focus-summary?${intervalKey}`, { token, signal }) as Promise<Focus>,
    ])
    if (!Array.isArray(sessions.danhSach) || !Number.isSafeInteger(sessions.tongSo) ||
      ['soPhien', 'tongMiliGiay', 'bamGioMiliGiay', 'nhapTayMiliGiay'].some(k => !Number.isSafeInteger(focus[k as keyof Focus]) || focus[k as keyof Focus] < 0)) throw new Error('Số liệu kế hoạch hoặc thời gian học chưa hợp lệ.')
    return { sessions, focus }
  }, [intervalKey, studentId, page])
  const resource = useAdminResource(load)
  const data = resource.data
  return <section className="learning-panel"><div className="learning-panel-heading"><h2>Kế hoạch & thời gian học</h2></div>
    <div className="learning-filters"><label>Từ ngày<input type="date" value={range.from} onChange={e => { setRange({ ...range, from: e.target.value }); setPage(1) }} /></label><label>Đến hết ngày<input type="date" value={range.to} onChange={e => { setRange({ ...range, to: e.target.value }); setPage(1) }} /></label><span className="learning-note">Múi giờ: {zone}</span></div>
    {resource.loading && <p role="status" className="learning-feedback">Đang tải kế hoạch…</p>}{resource.error && <div role="alert" className="learning-feedback">{resource.error.message}<button type="button" onClick={resource.reload}>Thử lại</button></div>}
    {data && <><div className="learning-metrics learning-study-metrics"><article><span>Thực học đã ghi nhận</span><strong>{duration(data.focus.tongMiliGiay)}</strong></article><article><span>Bấm giờ</span><strong>{duration(data.focus.bamGioMiliGiay)}</strong></article><article><span>Nhập thủ công</span><strong>{duration(data.focus.nhapTayMiliGiay)}</strong></article><article><span>Phiên đã hoàn thành</span><strong>{data.focus.soPhien}</strong></article></div><p className="learning-note">Thực học tính các bản ghi đã hoàn thành, kết thúc trong khoảng ngày và gắn nhiệm vụ học tập. Kế hoạch bên dưới là thời gian dự kiến. Hoàn thành phiên học không tự đồng nghĩa hoàn thành nhiệm vụ.</p><div className="admin-table-container"><table className="admin-students-table"><thead><tr><th>Nhiệm vụ</th><th>Bắt đầu dự kiến</th><th>Kết thúc dự kiến</th><th>Trạng thái phiên</th></tr></thead><tbody>{data.sessions.danhSach.map(session => <tr key={session.ma}><td>{session.tieuDeNhiemVu}</td><td>{when(session.batDauDuKien, zone)}</td><td>{when(session.ketThucDuKien, zone)}</td><td>{statuses[session.trangThai]}</td></tr>)}</tbody></table>{!data.sessions.danhSach.length && <p className="learning-empty">Chưa có phiên tự học trong khoảng ngày.</p>}</div><div className="admin-pagination"><span>{data.sessions.tongSo} phiên · Trang {page}/{Math.max(1, Math.ceil(data.sessions.tongSo / 20))}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><button type="button" disabled={page * 20 >= data.sessions.tongSo} onClick={() => setPage(page + 1)}>Sau</button></div></div></>}
  </section>
}

export function localDateRange(from: string, to: string, zone: string): { tu: string; den: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return null
  function midnight(date: string) {
    const target = Date.parse(date + 'T00:00:00Z')
    if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== date) return NaN
    let guess = target
    const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]))
      const actual = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
      const adjustment = target - actual
      if (!adjustment) return guess
      guess += adjustment
    }
    return NaN
  }
  try {
    const start = midnight(from)
    if (new Date(Date.parse(to + 'T00:00:00Z')).toISOString().slice(0, 10) !== to) return null
    const next = new Date(Date.parse(to + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
    const end = midnight(next)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 93 * 86400000) return null
    return { tu: new Date(start).toISOString(), den: new Date(end).toISOString() }
  } catch { return null }
}

// Không biến lỗi hợp đồng API thành bảng rỗng hoặc những số 0 có vẻ hợp lệ.
// Kiểm tra dữ liệu tại ranh giới mạng để giao diện hiển thị lỗi và cho thử lại.
export function validateLearningData(summary: Summary, tasks: Page<Task>) {
  if (!summary || !tasks || !Array.isArray(tasks.danhSach) || !Number.isSafeInteger(tasks.tongSo) || tasks.tongSo < 0 ||
    !Number.isSafeInteger(tasks.trang) || tasks.trang < 1 || !Number.isSafeInteger(tasks.kichThuocTrang) || tasks.kichThuocTrang < 1 || tasks.kichThuocTrang > 100 ||
    tasks.danhSach.length > tasks.kichThuocTrang || tasks.danhSach.length > tasks.tongSo ||
    ['tongNhiemVu', 'hoanThanh', 'dangLam', 'chuaBatDau', 'quaHan', 'soSinhVienCoNhiemVu'].some(k => !Number.isSafeInteger(summary[k as keyof Summary]) || Number(summary[k as keyof Summary]) < 0) ||
    !Number.isFinite(Date.parse(summary.kiemTraLuc)) || tasks.danhSach.some(t => !Number.isSafeInteger(t.ma) || t.ma < 1 || !Number.isSafeInteger(t.maSinhVien) || t.maSinhVien < 1 ||
      typeof t.tieuDe !== 'string' || typeof t.hoTen !== 'string' || !['NotStarted', 'InProgress', 'Completed'].includes(t.trangThai) ||
      !Number.isInteger(t.tienDo) || t.tienDo < 0 || t.tienDo > 100 || (t.hanHieuLuc !== null && !Number.isFinite(Date.parse(t.hanHieuLuc))))) throw new Error('Dữ liệu theo dõi học tập máy chủ trả về chưa hợp lệ.')
}
