import { ApiError, apiRequest, record } from '../api/client'
import type { StatisticsTask } from './statisticsModel'

export interface StatisticsSnapshot { tasks: StatisticsTask[] }
function invalid(): never { throw new ApiError('Dữ liệu tiến độ chưa hợp lệ. Vui lòng thử lại.') }
function integer(value: unknown, minimum = 0): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum }
function nullableId(value: unknown) { return value === null || integer(value, 1) }
function timestamp(value: unknown) { return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) }
function parseTask(value: unknown): StatisticsTask {
  const task = record(value)
  if (!integer(task.ma, 1) || !nullableId(task.maHocKy) || !nullableId(task.maMonHoc) || !nullableId(task.maNhiemVuCha) ||
    !['NotStarted', 'InProgress', 'Completed'].includes(String(task.trangThai)) || typeof task.coNhiemVuCon !== 'boolean' ||
    !(task.hanHieuLuc === null || timestamp(task.hanHieuLuc)) || !(task.ngayHoanThanh === null || timestamp(task.ngayHoanThanh))) invalid()
  return task as unknown as StatisticsTask
}
function changed() { return new ApiError('Dữ liệu vừa thay đổi. Vui lòng thử lại.', 409, 'STATISTICS_VERSION_CHANGED') }
async function loadTasks(token: string, semesterId: string, signal: AbortSignal) {
  if (!/^[1-9]\d*$/.test(semesterId) || !Number.isSafeInteger(Number(semesterId))) invalid()
  for (let attempt = 0; ; attempt++) {
    const results = await Promise.allSettled(['NotStarted', 'InProgress', 'Completed'].map(async status => {
      const tasks: StatisticsTask[] = []
      let version: number | undefined, total: number | undefined
      for (let page = 1; ; page++) {
        signal.throwIfAborted()
        // The task list's "all" mode returns roots. Request every status explicitly:
        // without trangThai=Completed the backend omits completed roots.
        const query = new URLSearchParams({ maHocKy: semesterId, chiLa: 'false', trangThai: status, cheDo: 'all', trang: String(page), kichThuocTrang: '100', sapXep: 'due' })
        const response = record(await apiRequest('/tasks?' + query, { token, signal }))
        const body = record(response.duLieu)
        if (!integer(response.phienBan) || !Array.isArray(body.danhSach) || body.trang !== page || !integer(body.kichThuocTrang, 1) || body.kichThuocTrang > 100 ||
          !integer(body.tongSo) || body.danhSach.length > body.kichThuocTrang) invalid()
        if (version !== undefined && (version !== response.phienBan || total !== body.tongSo)) throw changed()
        version = response.phienBan; total = body.tongSo
        const rows = body.danhSach.map(parseTask)
        if (rows.some(task => task.maNhiemVuCha !== null || task.trangThai !== status || String(task.maHocKy) !== semesterId)) invalid()
        tasks.push(...rows)
        if (tasks.length > total || (!rows.length && tasks.length < total)) invalid()
        if (tasks.length === total) break
      }
      return { tasks, version }
    }))
    signal.throwIfAborted()
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') {
      if (!attempt && failure.reason instanceof ApiError && failure.reason.code === 'STATISTICS_VERSION_CHANGED') continue
      throw failure.reason
    }
    const groups = results.map(result => (result as PromiseFulfilledResult<{ tasks: StatisticsTask[]; version: number }>).value)
    const tasks = groups.flatMap(group => group.tasks)
    if (groups.some(group => group.version !== groups[0].version) || new Set(tasks.map(task => task.ma)).size !== tasks.length) {
      if (!attempt) continue
      throw changed()
    }
    return tasks
  }
}
export async function loadStatistics(token: string, semesterId: string, signal: AbortSignal): Promise<StatisticsSnapshot> {
  return { tasks: await loadTasks(token, semesterId, signal) }
}
