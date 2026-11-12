import assert from 'node:assert/strict'
import { test, before, after, afterEach } from 'node:test'
import { createServer } from 'vite'
import { personalAndSemesterTasks, statisticsNow, statisticsTasks, tasksWithCompletedHistory } from './fixtures/statisticsTasks.mjs'

let vite, model, api
const originalFetch = globalThis.fetch
const filter = { semesterId: '11', subjectId: 'all' }
before(async () => {
  vite = await createServer({ configFile: false, envDir: false, appType: 'custom', server: { middlewareMode: true } })
  model = await vite.ssrLoadModule('/src/statistics/statisticsModel.ts')
  api = await vite.ssrLoadModule('/src/statistics/statisticsApi.ts')
})
after(async () => { await vite.close() })
afterEach(() => { globalThis.fetch = originalFetch })
test('semester statistics match task-list roots, include old completions and never count child steps as extra tasks', () => {
  const tasks = model.filterStatistics(statisticsTasks, filter)
  assert.equal(tasks.length, 11)
  assert(tasks.some(task => task.ma === 8) && tasks.some(task => task.ma === 14))
  assert(!tasks.some(task => [9, 15, 16, 17].includes(task.ma)))
  assert.deepEqual(model.summarizeStatistics(tasks, statisticsNow), { total: 11, completed: 5, inProgress: 3, notStarted: 3,
    overdue: 3, onTime: 2, late: 1, completedUndated: 1, completedUnknown: 1, completionRate: 45, onTimeRate: 67 })
})
test('subject and unassigned filters keep row totals consistent and empty timeliness has no invented percentage', () => {
  const totals = ['101', '102', '103', 'unassigned'].map(subjectId => model.filterStatistics(statisticsTasks, { ...filter, subjectId }).length)
  assert.deepEqual(totals, [5, 4, 1, 1])
  assert.equal(model.summarizeStatistics([], statisticsNow).onTimeRate, null)
  assert.equal(model.summarizeStatistics(model.filterStatistics(statisticsTasks, { ...filter, subjectId: '103' }), statisticsNow).onTimeRate, null)
  assert.equal(model.filterStatistics(statisticsTasks, { ...filter, semesterId: '12' }).length, 1)
})
function fakeApi({ mutate = response => response, version = () => 8, fail = false, tasks = statisticsTasks } = {}) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url, 'http://test'), q = parsed.searchParams
    calls.push({ path: parsed.pathname, q, options })
    if (fail) return Response.json({ title: 'Unavailable' }, { status: 503 })
    const status = q.get('trangThai'), page = Number(q.get('trang'))
    const rows = tasks.filter(task => String(task.maHocKy) === q.get('maHocKy') && (q.get('chiLa') === 'true' ? !task.coNhiemVuCon : task.maNhiemVuCha === null) && task.trangThai === status)
    const response = { phienBan: version(status, page), duLieu: { danhSach: rows.slice((page - 1) * 2, page * 2), trang: page, kichThuocTrang: 2, tongSo: rows.length } }
    return Response.json(mutate(response, status, page))
  }
  return calls
}
test('API reads all pages of all states with Bearer and selected semester, never limits completed work to today or writes', async () => {
  const calls = fakeApi()
  const snapshot = await api.loadStatistics('token', '11', new AbortController().signal)
  assert.equal(snapshot.tasks.length, 11)
  assert(calls.some(call => call.q.get('trangThai') === 'Completed' && call.q.get('trang') === '3'))
  for (const call of calls) {
    assert.equal(call.options.headers.Authorization, 'Bearer token')
    assert.equal(call.options.method, 'GET')
    if (call.path.endsWith('/tasks')) { assert.equal(call.q.get('chiLa'), 'false'); assert.equal(call.q.get('cheDo'), 'all'); assert.equal(call.q.get('maHocKy'), '11') }
  }
})

test('five personal roots and one semester root stay six overall but zero/one in semester statistics, regardless of child steps', async () => {
  assert.equal(personalAndSemesterTasks.filter(task => task.maNhiemVuCha === null).length, 6)
  assert.equal(personalAndSemesterTasks.filter(task => task.maNhiemVuCha === null && task.maHocKy === null).length, 5)
  assert.deepEqual(model.filterStatistics(personalAndSemesterTasks, { semesterId: '11', subjectId: 'all' }), [])
  assert.deepEqual(model.filterStatistics(personalAndSemesterTasks, { semesterId: '12', subjectId: 'all' }).map(task => task.ma), [501])
  fakeApi({ tasks: personalAndSemesterTasks })
  const first = await api.loadStatistics('token', '11', new AbortController().signal)
  const second = await api.loadStatistics('token', '12', new AbortController().signal)
  assert.equal(first.tasks.length, 0)
  assert.deepEqual(second.tasks.map(task => task.ma), [501])
  assert.equal(model.summarizeStatistics(second.tasks, statisticsNow).completed, 0, 'A completed child is not a completed main task')
})

test('completed history explains four/ two semester totals while the ordinary task list still shows six unfinished roots', async () => {
  assert.equal(tasksWithCompletedHistory.filter(task => task.maNhiemVuCha === null && task.trangThai !== 'Completed').length, 6)
  fakeApi({ tasks: tasksWithCompletedHistory })
  const first = model.summarizeStatistics((await api.loadStatistics('token', '11', new AbortController().signal)).tasks, statisticsNow)
  const second = model.summarizeStatistics((await api.loadStatistics('token', '12', new AbortController().signal)).tasks, statisticsNow)
  assert.deepEqual([first.total, first.completed, first.total - first.completed], [4, 4, 0])
  assert.deepEqual([second.total, second.completed, second.total - second.completed], [2, 1, 1])
})
test('API retries one mixed-version snapshot and rejects a persistently changing result', async () => {
  let reads = 0
  fakeApi({ version: (status, page) => { if (status === 'NotStarted' && page === 1) reads++; return reads === 1 && status === 'Completed' ? 9 : 8 } })
  assert.equal((await api.loadStatistics('token', '11', new AbortController().signal)).tasks.length, 11)
  fakeApi({ version: status => status === 'Completed' ? 9 : 8 })
  await assert.rejects(api.loadStatistics('token', '11', new AbortController().signal), error => error.code === 'STATISTICS_VERSION_CHANGED')
})
test('partial failures and malformed completion data cannot become plausible zero statistics', async () => {
  fakeApi({ fail: true })
  await assert.rejects(api.loadStatistics('token', '11', new AbortController().signal), error => error.status === 503)
  fakeApi({ mutate: response => { if (response.duLieu.danhSach.length) response.duLieu.danhSach[0].ngayHoanThanh = 'not-a-date'; return response } })
  await assert.rejects(api.loadStatistics('token', '11', new AbortController().signal), /chưa hợp lệ/)
  fakeApi({ mutate: response => { if (response.duLieu.danhSach.length) response.duLieu.danhSach[0].maHocKy = 12; return response } })
  await assert.rejects(api.loadStatistics('token', '11', new AbortController().signal), /chưa hợp lệ/)
})
