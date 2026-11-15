import assert from 'node:assert/strict'
import { test, after, afterEach } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-priority-test', define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/priorityRules.ts')
const rules = await server.ssrLoadModule('/src/priority/rules.ts')
const { recommend, priorityReasons } = await server.ssrLoadModule('/src/pages/Dashboard/todayModel.ts')
const { priorityTestTasks } = await server.ssrLoadModule('/tests/fixtures/priorityTasks.ts')
const { mockPriorityRequest } = await server.ssrLoadModule('/src/api/mockPriorityRules.ts')
const original = globalThis.fetch
after(() => server.close())
afterEach(() => { globalThis.fetch = original })
const stored = { ma: 1, ten: 'Theo hạn', phienBan: 1, dangSuDung: false, cauHinh: rules.defaultPriorityConfig, ngayTao: '2026-11-12T07:00:00Z' }
test('configurable ranking changes actual Today order and preserves overdue/undated boundaries', () => {
  const now = Date.parse('2026-11-12T10:00:00+07:00')
  const tasks = priorityTestTasks(now), original = structuredClone(tasks)
  const rank = order => recommend(tasks, now, { phienBanSchema: 1, tieuChi: order }).map(x => x.task.ma)
  assert.deepEqual(rank(['Deadline', 'Importance', 'InProgress']), [1, 2, 4, 3, 5])
  assert.deepEqual(rank(['Importance', 'Deadline', 'InProgress']), [1, 4, 3, 2, 5])
  assert.deepEqual(rank(['Deadline']), [1, 2, 3, 4, 5], 'Disabled importance/status cannot silently affect ties')
  assert.deepEqual(rank(['InProgress', 'Deadline']), [1, 4, 2, 3, 5])
  assert.deepEqual(tasks, original, 'Ranking never mutates task records')
  assert(!priorityReasons(tasks[3], now, { phienBanSchema: 1, tieuChi: ['Deadline'] }).includes('Đang thực hiện'))
})
test('priority config accepts only the supported schema, a required deadline and unique known criteria', () => {
  for (const config of [null, {}, { phienBanSchema: 2, tieuChi: ['Deadline'] }, { phienBanSchema: 1, tieuChi: ['Importance'] }, { phienBanSchema: 1, tieuChi: ['Deadline', 'Deadline'] }, { phienBanSchema: 1, tieuChi: ['Deadline', 'unknown'] }, { ...rules.defaultPriorityConfig, script: 'x' }]) assert.equal(rules.isPriorityConfig(config), false)
  assert(rules.isPriorityConfig({ phienBanSchema: 1, tieuChi: ['Deadline'] }))
  assert(rules.isPriorityConfig({ phienBanSchema: 1, tieuChi: ['Importance', 'Deadline'] }))
  assert.throws(() => api.parsePriorityRule({ ...stored, cauHinh: {} }))
})
test('priority API uses JWT, creates inactive versions, activates against the viewed version and deletes by ID', async () => {
  const calls = []
  globalThis.fetch = async (path, options) => {
    calls.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined })
    assert.equal(options.headers.Authorization, 'Bearer priority-token')
    assert.equal(options.cache, 'no-store')
    if (options.method === 'DELETE') return new Response(null, { status: 204 })
    if (path.endsWith('/active')) return Response.json(rules.defaultPriorityRule)
    if (path.includes('?')) return Response.json({ danhSach: [stored], trang: 1, kichThuocTrang: 20, tongSo: 1 })
    return Response.json({ ...stored, dangSuDung: path.endsWith('/activate') })
  }
  assert.equal((await api.loadActivePriorityRule('priority-token')).phienBan, 0)
  assert.equal((await api.listPriorityRules('priority-token')).tongSo, 1)
  assert.equal((await api.createPriorityRule('priority-token', ' Theo hạn ', rules.defaultPriorityConfig)).dangSuDung, false)
  await api.activatePriorityRule('priority-token', 1, 0)
  await api.deletePriorityRule('priority-token', 1)
  assert.deepEqual(calls.slice(2), [
    { path: '/api/v1/admin/priority-rules', method: 'POST', body: { ten: 'Theo hạn', cauHinh: rules.defaultPriorityConfig } },
    { path: '/api/v1/admin/priority-rules/1/activate', method: 'POST', body: { phienBanDangDung: 0 } },
    { path: '/api/v1/admin/priority-rules/1', method: 'DELETE', body: undefined },
  ])
})
test('priority API fails closed for malformed config and propagates stale activation conflicts', async () => {
  globalThis.fetch = async () => Response.json({ ...stored, dangSuDung: false })
  await assert.rejects(api.loadActivePriorityRule('test'), /chưa hợp lệ/)
  globalThis.fetch = async () => Response.json({ detail: 'Quy tắc đang dùng đã thay đổi.', code: 'PRIORITY_RULE_CHANGED' }, { status: 409 })
  await assert.rejects(api.activatePriorityRule('test', 1, 0), e => e.status === 409 && e.code === 'PRIORITY_RULE_CHANGED')
  globalThis.fetch = async () => { throw new Error('Must not call network') }
  await assert.rejects(api.activatePriorityRule('test', 0, 0), /chưa hợp lệ/)
  await assert.rejects(api.deletePriorityRule('test', -1), /chưa hợp lệ/)
  await assert.rejects(api.createPriorityRule('test', ' ', rules.defaultPriorityConfig), /chưa hợp lệ/)
})
test('explicit mock keeps a single active version, rejects stale writes and never reuses deleted versions', async () => {
  const state = {}, url = path => new URL(path, 'https://test.local')
  const call = (path, method = 'GET', body = {}) => mockPriorityRequest(state, url(path), method, body)
  assert.equal((await call('/priority-rules/active').json()).phienBan, 0)
  const first = await call('/admin/priority-rules', 'POST', { ten: 'Một', cauHinh: rules.defaultPriorityConfig }).json()
  const second = await call('/admin/priority-rules', 'POST', { ten: 'Hai', cauHinh: rules.defaultPriorityConfig }).json()
  assert.equal(call(`/admin/priority-rules/${first.ma}/activate`, 'POST', { phienBanDangDung: 0 }).status, 200)
  assert.equal(call(`/admin/priority-rules/${second.ma}/activate`, 'POST', { phienBanDangDung: 0 }).status, 409)
  assert.equal(call(`/admin/priority-rules/${first.ma}`, 'DELETE').status, 409)
  assert.equal(call(`/admin/priority-rules/${second.ma}`, 'DELETE').status, 204)
  const third = await call('/admin/priority-rules', 'POST', { ten: 'Ba', cauHinh: rules.defaultPriorityConfig }).json()
  assert(third.phienBan > second.phienBan)
  assert.equal(state.priorityRules.filter(x => x.dangSuDung).length, 1)
})
