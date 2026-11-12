import type { NhiemVu, SuKien } from '../../hoc-tap/types'
import { congNgay, ngay } from '../../hoc-tap/time'

export interface TodayEvent extends SuKien { maHocKy: number | null }
export interface TodayCalendar { muiGio: string; suKien: TodayEvent[] }
export const priorityPolicy = [
  'Xét độ gấp trước: quá hạn → còn tối đa 6 giờ → 24 giờ → 3 ngày → 7 ngày → xa hơn → chưa có hạn.',
  'Trong cùng nhóm độ gấp: hạn sớm hơn đứng trước; cùng hạn mới xét mức quan trọng Cao → Trung bình → Thấp.',
  'Nếu vẫn bằng nhau, ưu tiên việc đang làm; cuối cùng dùng mã nhiệm vụ để giữ thứ tự ổn định.',
]
const hour = 3600000
const importance: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
export const urgencyLabels = ['Đã quá hạn', 'Cần xử lý trong 6 giờ', 'Đến hạn trong 24 giờ', 'Đến hạn trong 3 ngày', 'Đến hạn trong 7 ngày', 'Có thể chuẩn bị sớm', 'Chưa có hạn']
export function dueAt(task: NhiemVu) { return task.hanHieuLuc ? Date.parse(task.hanHieuLuc) : Infinity }
export function isDone(task: NhiemVu) { return task.trangThai === 'Completed' }
export function urgency(task: NhiemVu, now: number) {
  const remaining = dueAt(task) - now
  return !Number.isFinite(remaining) ? 6 : remaining < 0 ? 0 : remaining <= 6 * hour ? 1 : remaining <= 24 * hour ? 2 : remaining <= 72 * hour ? 3 : remaining <= 168 * hour ? 4 : 5
}
export function recommend(tasks: NhiemVu[], now: number) {
  return tasks.filter((task) => !isDone(task) && !task.coNhiemVuCon).map((task) => ({ task, group: urgency(task, now) }))
    .sort((a, b) => a.group - b.group ||
      (dueAt(a.task) === dueAt(b.task) ? 0 : dueAt(a.task) < dueAt(b.task) ? -1 : 1) ||
      importance[a.task.mucDoUuTien] - importance[b.task.mucDoUuTien] ||
      Number(b.task.trangThai === 'InProgress') - Number(a.task.trangThai === 'InProgress') || a.task.ma - b.task.ma)
}
export function priorityReasons(task: NhiemVu, now: number) {
  const group = urgency(task, now)
  const reasons = [urgencyLabels[group]]
  if (task.mucDoUuTien === 'High') reasons.push('Mức quan trọng cao')
  if (task.trangThai === 'InProgress') reasons.push('Đang thực hiện')
  if (task.maNhiemVuNguonHan !== null && task.maNhiemVuNguonHan !== task.ma) reasons.push('Dùng hạn kế thừa từ nhiệm vụ cha')
  return reasons
}
export function taskInScope(task: NhiemVu, semester: string) {
  return task.maHocKy === null || String(task.maHocKy) === semester
}
export function eventInScope(event: TodayEvent, semester: string) {
  return event.maHocKy === null || String(event.maHocKy) === semester
}
export function dailyTasks(tasks: NhiemVu[], now: number, zone: string) {
  const today = ngay(now, zone)
  return tasks.filter((task) => task.hanHieuLuc && ngay(task.hanHieuLuc, zone) === today).sort((a, b) => dueAt(a) - dueAt(b) || a.ma - b.ma)
}
export function agenda(events: TodayEvent[], now: number, zone: string) {
  const today = ngay(now, zone)
  return events.filter((event) => event.loai !== 'GioRanh' && event.loai !== 'HanNhiemVu' && event.trangThai !== 'Cancelled' &&
    ngay(event.batDau, zone) <= today && ngay(event.ketThuc ? Date.parse(event.ketThuc) - 1 : event.batDau, zone) >= today)
    .sort((a, b) => Date.parse(a.batDau) - Date.parse(b.batDau) || a.ma.localeCompare(b.ma))
}
export function nextClass(events: TodayEvent[], now: number, zone: string) {
  const end = congNgay(ngay(now, zone), 7)
  return events.filter((event) => event.loai === 'LichHoc' && event.ketThuc && Date.parse(event.ketThuc) > now && ngay(event.batDau, zone) < end)
    .sort((a, b) => Date.parse(a.batDau) - Date.parse(b.batDau) || a.ma.localeCompare(b.ma))[0]
}
export function taskHref(task: NhiemVu) {
  const query = new URLSearchParams({ task: String(task.ma) })
  if (task.maHocKy) query.set('semester', String(task.maHocKy))
  if (task.maMonHoc) query.set('subject', String(task.maMonHoc))
  if (isDone(task)) query.set('view', 'completed')
  return '/tasks?' + query
}
