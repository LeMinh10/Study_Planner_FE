import { apiRequest, ApiError, record } from './client'
import { goi } from '../hoc-tap/api'

export interface PlanningReminder {
  ma: number; loai: 'WeeklyReview' | 'AvailabilityExpiring'; tieuDe: string; noiDung: string
  duongDan: '/tasks?tab=planning' | '/tasks?tab=free'; ngayPhat: string; ngayDoc: string | null
}
export interface PlanningReminderInbox {
  danhSach: PlanningReminder[]; trang: number; kichThuocTrang: number; tongSo: number
  tongChuaDoc: number; muiGio: string; docDenLuc: string
}
const integer = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min
const timestamp = (value: unknown): value is string => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
function invalid(): never { throw new ApiError('Dữ liệu nhắc kế hoạch chưa hợp lệ. Hãy thử lại.') }
export function parsePlanningReminders(value: unknown): PlanningReminderInbox {
  const body = record(value)
  if (!Array.isArray(body.danhSach) || !integer(body.trang, 1) || !integer(body.kichThuocTrang, 1) || body.kichThuocTrang > 50 ||
    !integer(body.tongSo) || !integer(body.tongChuaDoc) || !timestamp(body.docDenLuc) || typeof body.muiGio !== 'string' ||
    body.danhSach.length > body.kichThuocTrang || body.danhSach.length > body.tongSo) return invalid()
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: body.muiGio }) } catch { return invalid() }
  const rows = body.danhSach.map(value => {
    const row = record(value)
    if (!integer(row.ma, 1) || !['WeeklyReview', 'AvailabilityExpiring'].includes(String(row.loai)) ||
      !['/tasks?tab=planning', '/tasks?tab=free'].includes(String(row.duongDan)) || !timestamp(row.ngayPhat) ||
      !(row.ngayDoc === null || timestamp(row.ngayDoc)) || ![row.tieuDe, row.noiDung].every(text => typeof text === 'string' && text.trim())) return invalid()
    return row as unknown as PlanningReminder
  })
  if (new Set(rows.map(row => row.ma)).size !== rows.length) return invalid()
  return { ...body, danhSach: rows } as unknown as PlanningReminderInbox
}
export async function loadPlanningReminders(token: string, unread: boolean, page: number, signal?: AbortSignal) {
  if (!integer(page, 1)) return invalid()
  const result = await goi<unknown>(token, '/planning-reminders?' + new URLSearchParams({ chuaDoc: String(unread), trang: String(page), kichThuocTrang: '10' }), { signal })
  const inbox = parsePlanningReminders(result.duLieu)
  if (inbox.trang !== page) return invalid()
  return inbox
}
export async function readPlanningReminder(token: string, item: PlanningReminder) {
  if (!integer(item.ma, 1) || !timestamp(item.ngayPhat)) return invalid()
  await apiRequest(`/planning-reminders/${item.ma}/read`, { method: 'PATCH', token, body: { ngayPhat: item.ngayPhat } })
}
// Chỉ đọc đến mốc danh sách đã tải; thông báo đến sau vẫn giữ trạng thái chưa đọc.
export async function readAllPlanningReminders(token: string, cutoff: string) {
  if (!timestamp(cutoff)) return invalid()
  await apiRequest('/planning-reminders/read-all', { method: 'POST', token, body: { docDenLuc: cutoff } })
}
