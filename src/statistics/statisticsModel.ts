export interface StatisticsTask {
  ma: number
  maHocKy: number | null
  maMonHoc: number | null
  maNhiemVuCha: number | null
  trangThai: 'NotStarted' | 'InProgress' | 'Completed'
  hanHieuLuc: string | null
  ngayHoanThanh: string | null
  coNhiemVuCon: boolean
}
export interface StatisticsFilter { semesterId: string; subjectId: string }

export function filterStatistics(tasks: readonly StatisticsTask[], filter: StatisticsFilter) {
  return tasks.filter(task => {
    if (task.maNhiemVuCha !== null || String(task.maHocKy) !== filter.semesterId) return false
    if (filter.subjectId !== 'all' && (filter.subjectId === 'unassigned' ? task.maMonHoc !== null : String(task.maMonHoc) !== filter.subjectId)) return false
    return true
  })
}

export function summarizeStatistics(tasks: readonly StatisticsTask[], now: number) {
  const result = { total: tasks.length, completed: 0, inProgress: 0, notStarted: 0, overdue: 0,
    onTime: 0, late: 0, completedUndated: 0, completedUnknown: 0 }
  for (const task of tasks) {
    if (task.trangThai === 'Completed') {
      result.completed++
      if (!task.hanHieuLuc) result.completedUndated++
      else if (!task.ngayHoanThanh) result.completedUnknown++
      else if (Date.parse(task.ngayHoanThanh) <= Date.parse(task.hanHieuLuc)) result.onTime++
      else result.late++
    } else {
      if (task.trangThai === 'InProgress') result.inProgress++
      else result.notStarted++
      if (task.hanHieuLuc && Date.parse(task.hanHieuLuc) < now) result.overdue++
    }
  }
  const eligible = result.onTime + result.late
  return { ...result, completionRate: result.total ? Math.round(result.completed / result.total * 100) : 0,
    onTimeRate: eligible ? Math.round(result.onTime / eligible * 100) : null }
}
