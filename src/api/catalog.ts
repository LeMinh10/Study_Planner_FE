import { ApiError, apiRequest, record } from './client'

export interface TemplateSemester { ma: number; ten: string; thuTu: number; phienBan: number; soMonHoc: number; tongTinChi: number }
export interface TemplateCourse { ma: number; maHocKyMau: number; tenHocKy: string; kyHieu: string; ten: string; soTinChi: number; phienBan: number }
export interface CatalogPage { danhSach: TemplateCourse[]; trang: number; kichThuocTrang: number; tongSo: number }
export type SemesterInput = Pick<TemplateSemester, 'ten' | 'thuTu'> & { phienBan?: number }
export type CourseInput = Pick<TemplateCourse, 'maHocKyMau' | 'kyHieu' | 'ten' | 'soTinChi'> & { phienBan?: number }
const base = '/admin/catalog'
const int = (value: unknown, min = 1): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= 2147483647
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
function invalid(): never { throw new ApiError('Dữ liệu danh mục chưa hợp lệ. Vui lòng tải lại.') }
export function parseSemester(value: unknown): TemplateSemester {
  const row = record(value)
  if (!int(row.ma) || !text(row.ten) || !int(row.thuTu) || row.thuTu > 100 || !int(row.phienBan) || !int(row.soMonHoc, 0) || !int(row.tongTinChi, 0)) invalid()
  return row as unknown as TemplateSemester
}
export function parseCourse(value: unknown): TemplateCourse {
  const row = record(value)
  if (!int(row.ma) || !int(row.maHocKyMau) || !text(row.tenHocKy) || !text(row.ten) || typeof row.kyHieu !== 'string' || !/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(row.kyHieu) || !int(row.soTinChi) || row.soTinChi > 30 || !int(row.phienBan)) invalid()
  return row as unknown as TemplateCourse
}
export async function listTemplateSemesters(token: string, signal?: AbortSignal) {
  const rows = await apiRequest(base + '/semesters', { token, signal })
  if (!Array.isArray(rows)) invalid()
  const parsed = rows.map(parseSemester)
  if (new Set(parsed.map(row => row.ma)).size !== parsed.length) invalid()
  return parsed
}
export async function listTemplateCourses(token: string, semester: string, keyword: string, page: number, signal?: AbortSignal): Promise<CatalogPage> {
  if (!int(page) || (semester && (!/^[1-9]\d*$/.test(semester) || !int(Number(semester))))) invalid()
  const q = new URLSearchParams({ trang: String(page), tuKhoa: keyword.trim() })
  if (semester) q.set('maHocKyMau', semester)
  const body = record(await apiRequest(base + '/courses?' + q, { token, signal }))
  if (body.trang !== page || body.kichThuocTrang !== 20 || !int(body.tongSo, 0) || !Array.isArray(body.danhSach) || body.danhSach.length > 20 || body.danhSach.length > body.tongSo) invalid()
  const rows = body.danhSach.map(parseCourse)
  if (new Set(rows.map(row => row.ma)).size !== rows.length || (semester && rows.some(row => String(row.maHocKyMau) !== semester))) invalid()
  return { danhSach: rows, trang: page, kichThuocTrang: 20, tongSo: body.tongSo }
}
export async function saveTemplateSemester(token: string, input: SemesterInput, id?: number) {
  if (!text(input.ten.trim()) || !int(input.thuTu) || input.thuTu > 100 || (id !== undefined && (!int(id) || !int(input.phienBan)))) invalid()
  return parseSemester(await apiRequest(base + '/semesters' + (id ? '/' + id : ''), { token, method: id ? 'PUT' : 'POST', body: { ...input, ten: input.ten.trim() } }))
}
export async function saveTemplateCourse(token: string, input: CourseInput, id?: number) {
  const code = input.kyHieu.trim().toUpperCase()
  if (!text(input.ten.trim()) || !/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(code) || !int(input.maHocKyMau) || !int(input.soTinChi) || input.soTinChi > 30 || (id !== undefined && (!int(id) || !int(input.phienBan)))) invalid()
  return parseCourse(await apiRequest(base + '/courses' + (id ? '/' + id : ''), { token, method: id ? 'PUT' : 'POST', body: { ...input, kyHieu: code, ten: input.ten.trim() } }))
}
export async function deleteTemplate(token: string, kind: 'semesters' | 'courses', id: number, version: number) {
  if (!int(id) || !int(version)) invalid()
  await apiRequest(base + '/' + kind + '/' + id + '?phienBan=' + version, { token, method: 'DELETE' })
}
