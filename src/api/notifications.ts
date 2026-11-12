import { apiRequest, ApiError, record } from './client'

export interface NotificationItem {
  ma: number; maNhiemVu: number; tieuDe: string; tenNhiemVu: string; noiDung: string
  hanHieuLuc: string | null; maHocKy: number | null; tenHocKy: string | null
  maMonHoc: number | null; tenMonHoc: string | null; quaHan: boolean; daHoanThanh: boolean
  ngayPhat: string; ngayDoc: string | null
}
export interface NotificationInbox {
  danhSach: NotificationItem[]; trang: number; kichThuocTrang: number; tongSo: number
  tongChuaDoc: number; muiGio: string; docDenLuc: string
}
function invalid(): never { throw new ApiError('Dữ liệu thông báo chưa hợp lệ. Vui lòng thử lại.') }
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min
const timestamp = (v: unknown): v is string => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
const nullableId = (v: unknown) => v === null || integer(v, 1)
const nullableText = (v: unknown) => v === null || typeof v === 'string'
export function parseInbox(value: unknown): NotificationInbox {
  const body = record(value)
  if (!Array.isArray(body.danhSach) || !integer(body.trang, 1) || !integer(body.kichThuocTrang, 1) || body.kichThuocTrang > 50 ||
    !integer(body.tongSo) || !integer(body.tongChuaDoc) || !timestamp(body.docDenLuc) || typeof body.muiGio !== 'string' ||
    body.danhSach.length > body.kichThuocTrang || body.danhSach.length > body.tongSo) return invalid()
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: body.muiGio }) } catch { return invalid() }
  const rows = body.danhSach.map((value) => {
    const row = record(value)
    if (!integer(row.ma, 1) || !integer(row.maNhiemVu, 1) || !nullableId(row.maHocKy) || !nullableId(row.maMonHoc) ||
      ![row.tieuDe, row.tenNhiemVu, row.noiDung].every(x => typeof x === 'string') || ![row.tenHocKy, row.tenMonHoc].every(nullableText) ||
      !(row.hanHieuLuc === null || timestamp(row.hanHieuLuc)) || !timestamp(row.ngayPhat) ||
      !(row.ngayDoc === null || timestamp(row.ngayDoc)) || typeof row.quaHan !== 'boolean' || typeof row.daHoanThanh !== 'boolean') return invalid()
    return row as unknown as NotificationItem
  })
  if (new Set(rows.map(x => x.ma)).size !== rows.length) return invalid()
  return { ...body, danhSach: rows } as unknown as NotificationInbox
}
export async function loadNotifications(token: string, unread: boolean, page: number, signal?: AbortSignal) {
  if (!integer(page, 1)) return invalid()
  const q = new URLSearchParams({ chuaDoc: String(unread), trang: String(page), kichThuocTrang: '20' })
  const inbox = parseInbox(await apiRequest('/notifications?' + q, { token, signal }))
  if (inbox.trang !== page) return invalid()
  return inbox
}
export async function readNotification(token: string, item: NotificationItem) {
  if (!integer(item.ma, 1) || !timestamp(item.ngayPhat)) return invalid()
  await apiRequest(`/notifications/${item.ma}/read`, { method: 'PATCH', token, body: { ngayPhat: item.ngayPhat } })
}
export async function readAllNotifications(token: string, cutoff: string) {
  if (!timestamp(cutoff)) return invalid()
  await apiRequest('/notifications/read-all', { method: 'POST', token, body: { docDenLuc: cutoff } })
}
export function notificationHref(item: NotificationItem) {
  const q = new URLSearchParams({ task: String(item.maNhiemVu) })
  if (item.maHocKy) q.set('semester', String(item.maHocKy))
  if (item.maMonHoc) q.set('subject', String(item.maMonHoc))
  if (item.daHoanThanh) q.set('view', 'completed')
  return '/tasks?' + q
}
