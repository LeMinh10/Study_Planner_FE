import type { NhiemVu, SuKien } from '../../hoc-tap/types'
import { congNgay, ngay } from '../../hoc-tap/time'
import { defaultPriorityConfig } from '../../priority/rules'
import type { PriorityConfig } from '../../priority/rules'

export interface TodayEvent extends SuKien { maHocKy: number | null }
export interface TodayCalendar { muiGio: string; suKien: TodayEvent[] }
const day = 24 * 60 * 60 * 1000
const importance: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
export const urgencyLabels = ['Đã quá hạn', 'Đến hạn trong 24 giờ', 'Còn trên 1 đến 3 ngày', 'Còn trên 3 đến 7 ngày', 'Còn trên 7 ngày', 'Chưa có hạn']
export function dueAt(task: NhiemVu) { return task.hanHieuLuc ? Date.parse(task.hanHieuLuc) : Infinity }
export function isDone(task: NhiemVu) { return task.trangThai === 'Completed' }
export function urgency(task: NhiemVu, now: number) {
  const remaining = dueAt(task) - now
  if (!Number.isFinite(remaining)) return 5
  if (remaining < 0) return 0
  if (remaining <= day) return 1
  if (remaining <= 3 * day) return 2
  if (remaining <= 7 * day) return 3
  return 4
}
export function recommend(tasks: NhiemVu[], now: number, config: PriorityConfig = defaultPriorityConfig) {
  return tasks.filter(task => !isDone(task) && !task.coNhiemVuCon)
    .map(task => ({ task, group: urgency(task, now) }))
    .sort(({ task: a, group: groupA }, { task: b, group: groupB }) => {
      // Cấu hình quản trị phân xử trong cùng nhóm. Nhóm gấp hơn luôn đứng trước.
      if (groupA !== groupB) return groupA - groupB
      for (const criterion of config.tieuChi) {
        const difference = criterion === 'Deadline' ? (dueAt(a) === dueAt(b) ? 0 : dueAt(a) < dueAt(b) ? -1 : 1)
          : criterion === 'Importance' ? importance[a.mucDoUuTien] - importance[b.mucDoUuTien]
          : Number(b.trangThai === 'InProgress') - Number(a.trangThai === 'InProgress')
        if (difference) return difference
      }
      return a.ma - b.ma
    })
}
export function priorityReasons(task: NhiemVu, now: number, config: PriorityConfig = defaultPriorityConfig) {
  const group = urgency(task, now)
  const reasons = [urgencyLabels[group]]
  if (config.tieuChi.includes('Importance') && task.mucDoUuTien === 'High') reasons.push('Mức quan trọng cao')
  if (config.tieuChi.includes('InProgress') && task.trangThai === 'InProgress') reasons.push('Đang thực hiện')
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
