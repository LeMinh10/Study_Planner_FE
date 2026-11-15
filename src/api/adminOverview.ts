import { ApiError, apiRequest, record } from './client'

export interface RecentStudent { id: number; name: string; email: string; active: boolean; createdAt: string }
export interface AdminOverview {
  total: number; open: number; locked: number; recentCount: number
  from: string; to: string; students: RecentStudent[]
}
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const timestamp = (v: unknown): v is string => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
function invalid(): never { throw new ApiError('Dữ liệu tổng quan chưa hợp lệ. Vui lòng tải lại.') }
export function parseAdminOverview(value: unknown): AdminOverview {
  const body = record(value)
  if (!integer(body.tongSinhVien) || !integer(body.dangMo) || !integer(body.daKhoa) || !integer(body.moiTrong7Ngay) ||
    body.dangMo + body.daKhoa !== body.tongSinhVien || body.moiTrong7Ngay > body.tongSinhVien ||
    !timestamp(body.tuNgay) || !timestamp(body.denNgay) || Date.parse(body.tuNgay) >= Date.parse(body.denNgay) ||
    !Array.isArray(body.sinhVienMoi) || body.sinhVienMoi.length !== Math.min(5, body.tongSinhVien)) return invalid()
  const students = body.sinhVienMoi.map(value => {
    const row = record(value)
    if (!integer(row.ma) || row.ma < 1 || typeof row.hoTen !== 'string' || typeof row.email !== 'string' ||
      typeof row.dangHoatDong !== 'boolean' || !timestamp(row.ngayTao)) return invalid()
    return { id: row.ma, name: row.hoTen, email: row.email, active: row.dangHoatDong, createdAt: row.ngayTao }
  })
  if (new Set(students.map(row => row.id)).size !== students.length) return invalid()
  return { total: body.tongSinhVien, open: body.dangMo, locked: body.daKhoa, recentCount: body.moiTrong7Ngay, from: body.tuNgay, to: body.denNgay, students }
}
export async function loadAdminOverview(token: string, signal?: AbortSignal) {
  return parseAdminOverview(await apiRequest('/admin/overview', { token, signal }))
}
export function overviewStudentLink(filter: 'total' | 'open' | 'locked' | 'recent', data?: AdminOverview | null) {
  const query = new URLSearchParams({ VaiTro: 'Student' })
  if (filter === 'open' || filter === 'locked') query.set('DangHoatDong', String(filter === 'open'))
  if (filter === 'recent' && data) { query.set('TaoTu', data.from); query.set('TaoDen', data.to) }
  return '/admin/students?' + query
}
