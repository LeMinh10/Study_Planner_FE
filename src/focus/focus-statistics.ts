export interface FocusTotals { soPhien: number; soPomodoro: number; tongMiliGiay: number }
export interface FocusByTask extends FocusTotals { maNhiemVu: number | null; tieuDe: string }
export interface FocusStatistics {
  tuNgay: string; denNgay: string; muiGio: string; tongHop: FocusTotals
  theoNgay: (FocusTotals & { ngay: string })[]
  theoNhiemVu: FocusByTask[]
}
export const focusColors = ['#4e6bff', '#42b6a0', '#edb752', '#9981df', '#e7848d', '#acb7ca']
export function focusDistribution(rows: FocusByTask[]) {
  const result = rows.slice(0, 5)
  if (rows.length > 5) result.push({ maNhiemVu: null, tieuDe: 'Các mục khác', soPhien: rows.slice(5).reduce((n, x) => n + x.soPhien, 0),
    soPomodoro: rows.slice(5).reduce((n, x) => n + x.soPomodoro, 0), tongMiliGiay: rows.slice(5).reduce((n, x) => n + x.tongMiliGiay, 0) })
  return result
}
export function focusGradient(rows: FocusByTask[]) {
  const total = rows.reduce((n, row) => n + row.tongMiliGiay, 0)
  if (total <= 0) return '#edf0f6'
  let position = 0
  return 'conic-gradient(' + rows.map((row, index) => {
    const from = position; position += row.tongMiliGiay / total * 100
    return `${focusColors[index % focusColors.length]} ${from}% ${position}%`
  }).join(', ') + ')'
}
