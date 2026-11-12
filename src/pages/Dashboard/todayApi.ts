import { ApiError, record } from '../../api/client'
import { goi } from '../../hoc-tap/api'
import type { NhiemVu, Trang } from '../../hoc-tap/types'
import type { TodayCalendar, TodayEvent } from './todayModel'

function invalid(): never { throw new ApiError('Dữ liệu Hôm nay từ máy chủ chưa đúng định dạng. Vui lòng thử tải lại.') }
function integer(value: unknown, minimum = 0): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum }
function nullableId(value: unknown) { return value === null || integer(value, 1) }
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}
export function parseTask(value: unknown): NhiemVu {
  const body = record(value)
  if (!integer(body.ma, 1) || !nullableId(body.maHocKy) || !nullableId(body.maMonHoc) || !nullableId(body.maNhiemVuCha) ||
    typeof body.tieuDe !== 'string' || !(body.moTa === null || typeof body.moTa === 'string') ||
    !['Assignment', 'Exam', 'Revision', 'Personal'].includes(String(body.loai)) || !['High', 'Medium', 'Low'].includes(String(body.mucDoUuTien)) ||
    !['NotStarted', 'InProgress', 'Completed'].includes(String(body.trangThai)) || !integer(body.tienDo) || body.tienDo > 100 || typeof body.coNhiemVuCon !== 'boolean' ||
    ![body.hanHoanThanh, body.hanHieuLuc, body.batDauSuKien, body.ketThucSuKien].every((value) => value === null || timestamp(value)) ||
    !nullableId(body.maNhiemVuNguonHan)) return invalid()
  return body as unknown as NhiemVu
}
export function parseCalendar(value: unknown): TodayCalendar {
  const body = record(value)
  if (typeof body.muiGio !== 'string' || !Array.isArray(body.suKien)) return invalid()
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: body.muiGio }) } catch { return invalid() }
  const events = body.suKien.map((value): TodayEvent => {
    const event = record(value)
    if (typeof event.ma !== 'string' || !integer(event.maNguon, 1) || !nullableId(event.maHocKy) || !nullableId(event.maMonHoc) ||
      !['LichHoc', 'SuKien', 'HanNhiemVu', 'PhienTuHoc', 'GioRanh'].includes(String(event.loai)) || typeof event.tieuDe !== 'string' ||
      !timestamp(event.batDau) || !(event.ketThuc === null || timestamp(event.ketThuc)) ||
      (typeof event.ketThuc === 'string' && Date.parse(event.ketThuc) <= Date.parse(String(event.batDau)))) return invalid()
    return event as unknown as TodayEvent
  })
  if (new Set(events.map((event) => event.ma)).size !== events.length) return invalid()
  return { muiGio: body.muiGio, suKien: events }
}
export async function loadTodayTasks(token: string, signal: AbortSignal) {
  // BE's default list omits completed tasks and returns roots. Ask for leaves and
  // all pending states, plus completed leaves due today in the account timezone.
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    const results = await Promise.allSettled(['NotStarted', 'InProgress', 'Completed'].map(async (status) => {
      const tasks: NhiemVu[] = []
      let version: number | undefined
      for (let page = 1; ; page++) {
        signal.throwIfAborted()
        const query = new URLSearchParams({ chiLa: 'true', trangThai: status, cheDo: status === 'Completed' ? 'today' : 'all', kichThuocTrang: '100', trang: String(page), sapXep: 'due' })
        const result = await goi<Trang<unknown>>(token, '/tasks?' + query, { signal })
        if (version !== undefined && version !== result.phienBan) throw new ApiError('Dữ liệu vừa thay đổi. Vui lòng tải lại.', 409, 'TODAY_VERSION_CHANGED')
        version = result.phienBan
        const body = record(result.duLieu)
        if (!Array.isArray(body.danhSach) || body.trang !== page || !integer(body.kichThuocTrang, 1) || body.kichThuocTrang > 100 || !integer(body.tongSo) || body.danhSach.length > body.kichThuocTrang) return invalid()
        const rows = body.danhSach.map(parseTask)
        if (rows.some((task) => task.trangThai !== status || task.coNhiemVuCon)) return invalid()
        tasks.push(...rows)
        if (tasks.length > body.tongSo || (!rows.length && tasks.length < body.tongSo)) return invalid()
        if (tasks.length === body.tongSo) break
      }
      return { tasks, version: version! }
    }))
    signal.throwIfAborted()
    const failure = results.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') {
      if (attempt === 0 && failure.reason instanceof ApiError && failure.reason.code === 'TODAY_VERSION_CHANGED') continue
      throw failure.reason
    }
    const groups = results.map((result) => (result as PromiseFulfilledResult<{ tasks: NhiemVu[]; version: number }>).value)
    const tasks = groups.flatMap((group) => group.tasks)
    if (groups.some((group) => group.version !== groups[0].version) || new Set(tasks.map((task) => task.ma)).size !== tasks.length) {
      if (attempt === 0) continue
      throw new ApiError('Dữ liệu thay đổi trong khi tải. Vui lòng thử lại.', 409, 'TODAY_VERSION_CHANGED')
    }
    return tasks
  }
}
export async function loadTodayCalendar(token: string, now: number, signal: AbortSignal) {
  // A padded UTC range includes today and the following week in every IANA zone.
  // The BE expands recurring classes, date bounds and study sessions for us.
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  const query = new URLSearchParams({ tu: new Date(start.getTime() - 86400000).toISOString(), den: new Date(start.getTime() + 9 * 86400000).toISOString() })
  return parseCalendar((await goi<unknown>(token, '/calendar?' + query, { signal })).duLieu)
}
