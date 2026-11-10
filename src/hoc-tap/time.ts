export function ngay(value: string | number | Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}
export function congNgay(value: string, days: number) {
  const date = new Date(value + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function dauTuan(value: string) { return congNgay(value, -((new Date(value + 'T12:00:00Z').getUTCDay() + 6) % 7)) }
const formatters = new Map<string, Intl.DateTimeFormat>()
export function gioNhap(value: string | null, zone: string) {
  if (!value) return ''
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    formatters.set(zone, formatter)
  }
  const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
export function utc(value: string, zone: string): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Ngày và giờ chưa hợp lệ.')
  const base = Date.parse(value + ':00Z')
  const found: string[] = []
  for (let offset = -840; offset <= 840; offset += 15) {
    const candidate = new Date(base - offset * 60000).toISOString()
    if (gioNhap(candidate, zone) === value) found.push(candidate)
  }
  if (found.length !== 1) throw new Error('Giờ đã chọn không xác định được trong múi giờ tài khoản. Hãy chọn giờ khác.')
  return found[0]
}
export function hienGio(value: string | null, zone: string) {
  return value ? new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Chưa đặt hạn'
}
export function thoiDiemGui(value: string, original: string | null, zone: string) {
  return value === gioNhap(original, zone) ? original : utc(value, zone)
}
export function doiKhoang(value: string, direction: number, mode: string, days: number) {
  if (mode !== 'month') return congNgay(value, direction * days)
  const date = new Date(value.slice(0, 8) + '01T12:00:00Z')
  date.setUTCMonth(date.getUTCMonth() + direction)
  return date.toISOString().slice(0, 10)
}
export function trongKhoang(start: string, end: string | null, from: number, to: number) {
  if (!end) return Date.parse(start) >= from && Date.parse(start) < to
  return Date.parse(start) < to && Date.parse(end) > from
}
export const trangThai: Record<string, string> = { NotStarted: 'Chưa bắt đầu', InProgress: 'Đang thực hiện', Completed: 'Đã hoàn thành', Planned: 'Đã lên lịch', Missed: 'Đã bỏ lỡ', Cancelled: 'Đã hủy' }
export const uuTien: Record<string, string> = { High: 'Cao', Medium: 'Trung bình', Low: 'Thấp' }
export const loaiViec: Record<string, string> = { Assignment: 'Bài tập', Exam: 'Thi / kiểm tra', Revision: 'Ôn tập', Personal: 'Việc cá nhân' }
export const thu = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
