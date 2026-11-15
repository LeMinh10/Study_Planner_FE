import type { Subject } from '../types/planner'

export const cheDoNhiemVu: Record<string, string> = {
  all: 'Tất cả nhiệm vụ', today: 'Đến hạn hôm nay', upcoming: 'Đến hạn trong 7 ngày',
  overdue: 'Đã quá hạn', undated: 'Chưa đặt hạn', inbox: 'Việc cá nhân', completed: 'Đã hoàn thành',
}
export const khoangDaHoanThanh = { today: 'Hôm nay', yesterday: 'Hôm qua', last7: '7 ngày gần đây' }

export function layCheDo(params: URLSearchParams) {
  const value = params.get('view')
  if (value === 'done') return 'completed'
  return value && value in cheDoNhiemVu ? value : 'all'
}
export function layPhamVi(params: URLSearchParams, subjects: Subject[]) {
  const monHoc = params.get('subject') ?? ''
  const hocKy = params.get('semester') ?? subjects.find(s => s.id === monHoc)?.semesterId ?? ''
  return { hocKy, monHoc }
}
export function taoTruyVanNhiemVu(params: URLSearchParams, page: number, search: string, scope: { hocKy: string; monHoc: string }) {
  const view = layCheDo(params)
  const sort = view === 'completed' ? 'completed' : params.get('sort') ?? (params.get('view') === 'priority' ? 'priority' : 'due')
  const query = new URLSearchParams({ cheDo: view, trang: String(page), kichThuocTrang: '20', sapXep: sort })
  if (view === 'completed') {
    const period = params.get('donePeriod') ?? ''
    const day = params.get('doneDay') ?? ''
    if (Object.hasOwn(khoangDaHoanThanh, period)) query.set('khoangHoanThanh', period)
    else if (period === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(day)) query.set('ngayHoanThanh', day)
  }
  if (view !== 'inbox') {
    if (scope.hocKy) query.set('maHocKy', scope.hocKy)
    if (scope.monHoc) query.set('maMonHoc', scope.monHoc)
  }
  if (search.trim()) query.set('tuKhoa', search.trim())
  for (const [param, field] of [['priority', 'mucDoUuTien'], ['type', 'loai'], ['status', 'trangThai']]) {
    const value = params.get(param)
    if (value) query.set(field, value)
  }
  return query.toString()
}
