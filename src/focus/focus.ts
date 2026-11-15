import { mocDauNgay } from '../hoc-tap/lich'
import { congNgay, ngay } from '../hoc-tap/time'

export interface FocusRecord {
  ma: number
  maNhiemVu: number | null
  maPhienTuHoc: number | null
  tieuDe: string
  cheDo: 'Pomodoro' | 'Stopwatch'
  trangThai: 'Running' | 'Paused' | 'Completed' | 'Discarded'
  mucTieuGiay: number
  soMiliGiayDaHoc: number
  batDau: string
  batDauDoan: string | null
  ketThuc: string | null
  ghiChu: string | null
  nhapThuCong: boolean
}
export interface FocusState {
  hienTai: FocusRecord | null
  lichSu: FocusRecord[]
  tongQuan: { pomoHomNay: number; miliGiayHomNay: number; tongPomo: number; tongMiliGiay: number }
  trang: number
  tongSo: number
  thoiDiemMayChu: string
  muiGio: string
  maPhienDangHocCu?: number | null
}
// Cộng đoạn đang chạy vào thời gian đã lưu; khoảng tạm dừng không tăng và Pomodoro dừng ở mục tiêu.
export function focusElapsed(record: FocusRecord, now: number) {
  const elapsed = record.soMiliGiayDaHoc + (record.trangThai === 'Running' && record.batDauDoan
    ? Math.max(0, now - Date.parse(record.batDauDoan)) : 0)
  return Math.max(0, record.cheDo === 'Pomodoro' ? Math.min(elapsed, record.mucTieuGiay * 1000) : elapsed)
}
export function clockText(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
export function durationText(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60000)
  if (!minutes) return Math.floor(milliseconds / 1000) + ' giây'
  return minutes >= 60 ? `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}` : minutes + ' phút'
}
export function isPersonal(task: { maHocKy: number | null; maMonHoc: number | null }) {
  return task.maHocKy == null && task.maMonHoc == null
}

export function focusTimeline(records: FocusRecord[], current: FocusRecord, now: number, zone: string) {
  const today = ngay(now, zone), dayStart = mocDauNgay(today, zone), dayEnd = mocDauNgay(congNgay(today, 1), zone)
  const dayHours = (dayEnd - dayStart) / 3600000, currentHour = (now - dayStart) / 3600000
  const formatter = new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const blocks = [...records.filter(row => row.ma !== current.ma), current].flatMap(row => {
    const start = Date.parse(row.batDau), end = row.ketThuc ? Date.parse(row.ketThuc) : now
    if (start >= dayEnd || end < dayStart) return []
    return [{ row, start: (Math.max(start, dayStart) - dayStart) / 3600000, end: (Math.min(end, dayEnd) - dayStart) / 3600000 }]
  })
  let first = Math.max(0, Math.floor(Math.min(currentHour - 1, ...blocks.map(block => block.start))))
  const last = Math.min(dayHours, Math.max(first + 4, Math.ceil(Math.max(currentHour + 1, ...blocks.map(block => block.end)))))
  if (last - first < 4) first = Math.max(0, last - 4)
  const step = Math.max(1, Math.ceil((last - first) / 5))
  const ticks = Array.from({ length: Math.floor((last - first) / step) + 1 }, (_, i) => first + i * step)
  if (ticks.at(-1) !== last) ticks.push(last)
  return { first, last, ticks, currentHour, blocks, label: (hour: number) => hour === dayHours ? '24:00' : formatter.format(new Date(dayStart + hour * 3600000)) }
}
