import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-today-test', define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const model = await server.ssrLoadModule('/src/pages/Dashboard/todayModel.ts')
const api = await server.ssrLoadModule('/src/pages/Dashboard/todayApi.ts')
const cache = await server.ssrLoadModule('/src/pages/Dashboard/todayCache.ts')
const originalFetch = globalThis.fetch
after(() => server.close())
afterEach(() => { globalThis.fetch = originalFetch })
const now = Date.parse('2026-11-10T10:00:00+07:00')
const hour = 3600000
const task = (ma, dueHours, more = {}) => ({ ma, maHocKy: 11, maMonHoc: 101, maNhiemVuCha: null, tieuDe: 'Việc ' + ma, moTa: null,
  loai: 'Assignment', mucDoUuTien: 'Medium', hanHoanThanh: dueHours === null ? null : new Date(now + dueHours * hour).toISOString(), hanHieuLuc: dueHours === null ? null : new Date(now + dueHours * hour).toISOString(),
  maNhiemVuNguonHan: dueHours === null ? null : ma, batDauSuKien: null, ketThucSuKien: null, trangThai: 'NotStarted', tienDo: 0,
  thoiLuongDuKienPhut: 60, thoiLuongConLaiPhut: 60, coNhiemVuCon: false, nhacTruocGio: null, ...more })
const event = (ma, start, end, more = {}) => ({ ma, loai: 'LichHoc', maNguon: 10, maMonHoc: 101, maHocKy: 11, tieuDe: ma, batDau: start, ketThuc: end, mauSac: null, trangThai: null, ...more })
test('urgency groups have exact inclusive thresholds and use the effective inherited deadline', () => {
  for (const [hours, group] of [[-0.001, 0], [0, 1], [6, 1], [6.001, 2], [24, 2], [24.001, 3], [72, 3], [72.001, 4], [168, 4], [168.001, 5], [null, 6]]) {
    assert.equal(model.urgency(task(1, hours), now), group, String(hours))
  }
  const inherited = task(2, 4, { hanHoanThanh: null, maNhiemVuCha: 1, maNhiemVuNguonHan: 1 })
  assert.equal(model.urgency(inherited, now), 1)
  assert(model.priorityReasons(inherited, now).some((reason) => reason.includes('kế thừa')))
})
test('ranking is deterministic: due time before importance, then work in progress and ID', () => {
  const items = [task(9, null, { mucDoUuTien: 'High' }), task(8, 100, { mucDoUuTien: 'High' }), task(7, 8, { mucDoUuTien: 'High' }),
    task(6, 2, { mucDoUuTien: 'Low' }), task(5, 4, { mucDoUuTien: 'High' }), task(4, 4, { mucDoUuTien: 'High', trangThai: 'InProgress', tienDo: 20 }),
    task(3, -1, { mucDoUuTien: 'Low' }), task(2, 4, { mucDoUuTien: 'High' }), task(1, 1, { trangThai: 'Completed', tienDo: 100 }), task(10, -5, { coNhiemVuCon: true })]
  const original = structuredClone(items)
  assert.deepEqual(model.recommend(items, now).map(({ task }) => task.ma), [3, 6, 4, 2, 5, 7, 8, 9])
  assert.deepEqual(items, original, 'Ranking must not mutate shared/API records')
  assert.deepEqual(model.recommend([...items].reverse(), now).map(({ task }) => task.ma), [3, 6, 4, 2, 5, 7, 8, 9])
  const sameDay = [task(1, 12, { mucDoUuTien: 'High' }), task(2, 7), task(3, 12, { mucDoUuTien: 'Low' })]
  assert.deepEqual(model.recommend(sameDay, now).map(({ task }) => task.ma), [2, 1, 3], '17:00 Medium precedes 22:00 High; equal deadlines use importance')
})
test('urgency recalculates with time while earlier deadlines keep precedence over importance', () => {
  const items = [task(1, 7, { mucDoUuTien: 'High' }), task(2, 5, { mucDoUuTien: 'Low' })]
  assert.equal(model.recommend(items, now)[0].task.ma, 2)
  assert.equal(model.recommend(items, now + hour)[0].task.ma, 2)
  assert.equal(model.urgency(items[0], now + hour), 1)
  assert.deepEqual(model.priorityReasons(items[0], now), ['Đến hạn trong 24 giờ', 'Mức quan trọng cao'])
})
test('Today scopes the selected semester and personal work without mixing other semesters', () => {
  assert.equal(model.taskInScope(task(1, 2), '11'), true)
  assert.equal(model.taskInScope(task(2, 2, { maHocKy: 12 }), '11'), false)
  assert.equal(model.taskInScope(task(3, 2, { maHocKy: null, maMonHoc: null }), '11'), true)
  const key = '2026-11-10T00:30:00+07:00'
  const daily = model.dailyTasks([task(1, null, { hanHieuLuc: key }), task(2, null), task(3, 100)], now, 'Asia/Ho_Chi_Minh')
  assert.deepEqual(daily.map((t) => t.ma), [1])
  assert.equal(model.dailyTasks([task(1, null, { hanHieuLuc: key })], Date.parse('2026-11-10T20:00:00+07:00'), 'America/Los_Angeles').length, 0)
})
test('agenda excludes free blocks/deadlines/cancelled sessions and handles midnight overlaps', () => {
  const start = '2026-11-09T23:30:00+07:00'
  const entries = [event('overnight', start, '2026-11-10T00:30:00+07:00'), event('midnight-end', start, '2026-11-10T00:00:00+07:00'),
    event('class', '2026-11-10T11:00:00+07:00', '2026-11-10T12:00:00+07:00'), event('free', '2026-11-10T11:00:00+07:00', null, { loai: 'GioRanh' }),
    event('deadline', '2026-11-10T11:00:00+07:00', null, { loai: 'HanNhiemVu' }), event('cancelled', '2026-11-10T11:00:00+07:00', '2026-11-10T12:00:00+07:00', { loai: 'PhienTuHoc', trangThai: 'Cancelled' })]
  assert.deepEqual(model.agenda(entries, now, 'Asia/Ho_Chi_Minh').map((e) => e.ma), ['overnight', 'class'])
  assert.equal(model.nextClass(entries, now, 'Asia/Ho_Chi_Minh').ma, 'class')
  assert.equal(model.nextClass(entries, Date.parse('2026-11-10T11:30:00+07:00'), 'Asia/Ho_Chi_Minh').ma, 'class')
})
test('detail links use the merged task workspace query contract', () => {
  const url = new URL(model.taskHref(task(1, 2, { trangThai: 'Completed' })), 'http://test')
  assert.equal(url.pathname, '/tasks')
  assert.equal(url.searchParams.get('task'), '1'); assert.equal(url.searchParams.get('subject'), '101'); assert.equal(url.searchParams.get('semester'), '11'); assert.equal(url.searchParams.get('view'), 'completed')
})
function response(data, version = 7) { return new Response(JSON.stringify({ phienBan: version, duLieu: data }), { status: 200 }) }
function paged(items, page = 1, total = items.length) { return { danhSach: items, trang: page, kichThuocTrang: 1, tongSo: total } }
test('API loads all leaf pages in parallel and completed-today only, with JWT and no writes', async () => {
  const calls = []
  globalThis.fetch = async (path, options) => {
    const q = new URL(path, 'http://test').searchParams
    calls.push({ path, options })
    if (q.get('trangThai') === 'InProgress') return response(paged([]))
    if (q.get('trangThai') === 'Completed') return response(paged([task(3, 2, { trangThai: 'Completed', tienDo: 100 })]))
    return response(paged([task(Number(q.get('trang')), 2)], Number(q.get('trang')), 2))
  }
  const result = await api.loadTodayTasks('jwt', new AbortController().signal)
  assert.deepEqual(result.map((t) => t.ma), [1, 2, 3])
  assert(calls.every(({ options }) => options.headers.Authorization === 'Bearer jwt' && options.method === 'GET'))
  assert(calls.every(({ path }) => new URL(path, 'http://test').searchParams.get('chiLa') === 'true'))
  const completed = calls.find(({ path }) => path.includes('Completed'))
  assert.equal(new URL(completed.path, 'http://test').searchParams.get('cheDo'), 'today')
})
test('API refuses partial mixed-version task lists and retries once', async () => {
  let calls = 0
  globalThis.fetch = async (path) => { calls++; const status = new URL(path, 'http://test').searchParams.get('trangThai'); return response(paged([]), status === 'Completed' ? 8 : 7) }
  await assert.rejects(api.loadTodayTasks('jwt', new AbortController().signal), (e) => e.code === 'TODAY_VERSION_CHANGED')
  assert.equal(calls, 6)
})
test('calendar uses the account timezone and one aggregate request, validates malformed DTOs', async () => {
  const calls = []
  globalThis.fetch = async (path, options) => { calls.push({ path, options }); return response({ muiGio: 'Asia/Ho_Chi_Minh', suKien: [event('class', '2026-11-10T11:00:00+07:00', '2026-11-10T12:00:00+07:00')] }) }
  const calendar = await api.loadTodayCalendar('jwt', now, new AbortController().signal)
  assert.equal(calendar.suKien.length, 1); assert.equal(calls.length, 1)
  const query = new URL(calls[0].path, 'http://test').searchParams
  assert(Date.parse(query.get('tu')) < now && Date.parse(query.get('den')) > now + 7 * 86400000)
  assert.throws(() => api.parseCalendar({ muiGio: 'invalid-zone', suKien: [] }))
  assert.throws(() => api.parseTask({ ...task(1, 2), ma: -1 }))
  assert.throws(() => api.parseTask({ ...task(1, 2), hanHieuLuc: '2026-11-10T11:00:00' }))
})

test('Today memory cache isolates login sessions and expires task/calendar records independently', () => {
  const sessionA = () => 'a', sessionB = () => 'b'
  const tasks = [task(1, 2)], calendar = { muiGio: 'Asia/Ho_Chi_Minh', suKien: [] }
  cache.cacheTodayTasks(sessionA, tasks, now)
  cache.cacheTodayCalendar(sessionA, calendar, now + 290000)
  assert.equal(cache.readTodayCache(sessionA, now + 295000).tasks, tasks)
  assert.equal(cache.readTodayCache(sessionB, now + 295000).tasks, undefined)
  const expired = cache.readTodayCache(sessionA, now + 305000)
  assert.equal(expired.tasks, undefined, 'A successful calendar refresh cannot extend an old task record')
  assert.equal(expired.calendar, calendar)
  const midnight = Date.parse('2026-11-10T23:59:00+07:00')
  cache.cacheTodayTasks(sessionA, tasks, midnight)
  cache.cacheTodayCalendar(sessionA, calendar, midnight)
  assert.equal(cache.readTodayCache(sessionA, midnight + 120000).tasks, undefined, 'A new day requires new completed-today data')
})
