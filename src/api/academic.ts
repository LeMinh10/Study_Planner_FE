import type { Semester, Subject, SubjectColor } from '../types/planner'
import { ApiError, apiRequest, record } from './client'

// DTO contract: StudyPlanner.Application.Academic (BE).
export const subjectColors: Record<SubjectColor, string> = {
  sage: '#53A88C', clay: '#E58E73', lavender: '#A278C4', blue: '#72A8D6',
}
function invalid(): never { throw new ApiError('Dữ liệu học kỳ/môn học từ máy chủ chưa đúng hợp đồng. Vui lòng kiểm tra tích hợp API.') }
function unwrap(value: unknown) { const body = record(value); return record(body.data ?? body) }
function integer(value: unknown, min = 0): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min }
function id(value: unknown): string { return integer(value, 1) ? String(value) : invalid() }
function pathId(value: string) { if (!/^\d+$/.test(value)) return invalid(); return id(Number(value)) }
function text(value: unknown): string { return typeof value === 'string' ? value : invalid() }
function optionalText(value: unknown): string { return value == null ? '' : text(value) }
function date(value: unknown) { const result = text(value); return /^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(result)) ? result : invalid() }
export function parseSemester(value: unknown): Semester {
  const body = unwrap(value)
  const semester = { id: id(body.ma), name: text(body.ten), startDate: date(body.ngayBatDau), endDate: date(body.ngayKetThuc) }
  return semester.endDate >= semester.startDate ? semester : invalid()
}
export function parseSubject(value: unknown): Subject {
  const body = unwrap(value)
  const hex = optionalText(body.mauSac).toUpperCase()
  if (hex && !/^#[0-9A-F]{6}$/.test(hex)) return invalid()
  if (body.soTinChi != null && !integer(body.soTinChi, 1)) return invalid()
  // Keep arbitrary valid BE colors for a later edit; select the closest UI palette.
  const rgb = (color: string) => [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16))
  const distance = (color: string) => rgb(color).reduce((sum, channel, index) => sum + (channel - rgb(hex || subjectColors.sage)[index]) ** 2, 0)
  const color = (Object.keys(subjectColors) as SubjectColor[]).sort((a, b) => distance(subjectColors[a]) - distance(subjectColors[b]))[0]
  return { id: id(body.ma), semesterId: id(body.maHocKy), code: optionalText(body.kyHieu), name: text(body.ten), credits: body.soTinChi as number ?? 0, teacher: optionalText(body.giangVien), color, ...(hex ? { colorHex: hex } : {}) }
}
async function listAll<T>(token: string, path: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ Trang: String(page), KichThuocTrang: '100' })
    const body = unwrap(await apiRequest(path + '?' + query, { token, signal }))
    if (!Array.isArray(body.danhSach) || body.trang !== page || !integer(body.kichThuocTrang, 1) || body.kichThuocTrang > 100 || !integer(body.tongSo) || body.danhSach.length > body.kichThuocTrang || items.length + body.danhSach.length > body.tongSo) return invalid()
    items.push(...body.danhSach.map(parse))
    if (items.length >= body.tongSo) return items
    if (!body.danhSach.length) return invalid()
  }
}
export const listSemesters = (token: string, signal?: AbortSignal) => listAll(token, '/semesters', parseSemester, signal)
export async function listSubjects(token: string, semesterId: string, signal?: AbortSignal) {
  const items = await listAll(token, '/semesters/' + pathId(semesterId) + '/courses', parseSubject, signal)
  if (items.some((item) => item.semesterId !== semesterId)) return invalid()
  return items
}
export const getSubject = async (token: string, subjectId: string, signal?: AbortSignal) => parseSubject(await apiRequest('/courses/' + pathId(subjectId), { token, signal }))
export async function saveSemester(token: string, value: Semester) {
  return parseSemester(await apiRequest('/semesters' + (value.id ? '/' + pathId(value.id) : ''), { token, method: value.id ? 'PUT' : 'POST', body: { ten: value.name.trim(), ngayBatDau: value.startDate, ngayKetThuc: value.endDate } }))
}
export async function saveSubject(token: string, value: Subject) {
  const saved = parseSubject(await apiRequest(value.id ? '/courses/' + pathId(value.id) : '/semesters/' + pathId(value.semesterId) + '/courses', { token, method: value.id ? 'PUT' : 'POST', body: {
    ten: value.name.trim(), kyHieu: value.code.trim() || null, soTinChi: value.credits || null, giangVien: value.teacher.trim() || null, mauSac: value.colorHex ?? subjectColors[value.color],
  } }))
  if (saved.semesterId !== value.semesterId || (value.id && saved.id !== value.id)) return invalid()
  return saved
}
export type AcademicKind = 'semester' | 'subject'
const resourcePath = (kind: AcademicKind, resourceId: string) => (kind === 'semester' ? '/semesters/' : '/courses/') + pathId(resourceId)
export async function deletionPreview(token: string, kind: AcademicKind, resourceId: string) {
  const body = unwrap(await apiRequest(resourcePath(kind, resourceId) + '/deletion-preview', { token }))
  if (!integer(body.soBuoiHoc) || !integer(body.soNhiemVuBoLienKet) || (kind === 'semester' && !integer(body.soMonHoc))) return invalid()
  return { courses: kind === 'semester' ? body.soMonHoc as number : 0, sessions: body.soBuoiHoc, tasks: body.soNhiemVuBoLienKet }
}
export async function deleteAcademic(token: string, kind: AcademicKind, resourceId: string) {
  await apiRequest(resourcePath(kind, resourceId), { method: 'DELETE', token })
}
