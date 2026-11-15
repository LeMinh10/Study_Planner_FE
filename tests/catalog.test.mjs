import assert from 'node:assert/strict'
import { test, after, afterEach } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ configFile: false, envDir: false, appType: 'custom', server: { middlewareMode: true }, define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, optimizeDeps: { noDiscovery: true, include: [] } })
const api = await vite.ssrLoadModule('/src/api/catalog.ts')
const original = globalThis.fetch
after(() => vite.close())
afterEach(() => { globalThis.fetch = original })
const semester = { ma: 1, ten: 'Học kỳ 1', thuTu: 1, phienBan: 1, soMonHoc: 1, tongTinChi: 3 }
const course = { ma: 7, maHocKyMau: 1, tenHocKy: 'Học kỳ 1', kyHieu: 'WEB01', ten: 'Thiết kế web', soTinChi: 3, phienBan: 1 }
function replies(items) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined })
    const [status, data] = items.shift() || assert.fail('Unexpected request')
    return new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}
test('catalog GET preserves admin scope, JWT, selected semester, search and pagination', async () => {
  const calls = replies([[200, [semester]], [200, { danhSach: [course], trang: 2, kichThuocTrang: 20, tongSo: 21 }]])
  assert.deepEqual(await api.listTemplateSemesters('token'), [semester])
  assert.deepEqual((await api.listTemplateCourses('token', '1', ' web ', 2)).danhSach, [course])
  for (const call of calls) { assert.equal(call.options.headers.Authorization, 'Bearer token'); assert.equal(call.options.method, 'GET'); assert(call.url.includes('/admin/catalog/')) }
  const query = new URL(calls[1].url, 'http://test').searchParams
  assert.equal(query.get('maHocKyMau'), '1'); assert.equal(query.get('tuKhoa'), 'web'); assert.equal(query.get('trang'), '2')
})
test('catalog CRUD normalizes payload, sends edit/delete versions and accepts empty 204', async () => {
  const calls = replies([[201, semester], [201, course], [200, { ...course, phienBan: 2 }], [204]])
  await api.saveTemplateSemester('token', { ten: ' Học kỳ 1 ', thuTu: 1 })
  await api.saveTemplateCourse('token', { maHocKyMau: 1, kyHieu: ' web01 ', ten: ' Thiết kế web ', soTinChi: 3 })
  await api.saveTemplateCourse('token', { maHocKyMau: 1, kyHieu: 'web01', ten: 'Sửa', soTinChi: 4, phienBan: 1 }, 7)
  await api.deleteTemplate('token', 'courses', 7, 2)
  assert.deepEqual(calls[0].body, { ten: 'Học kỳ 1', thuTu: 1 })
  assert.equal(calls[1].body.kyHieu, 'WEB01'); assert.equal(calls[1].body.ten, 'Thiết kế web')
  assert.equal(calls[2].options.method, 'PUT'); assert.equal(calls[2].body.phienBan, 1)
  assert(calls[3].url.endsWith('/courses/7?phienBan=2')); assert.equal(calls[3].options.method, 'DELETE')
})
test('invalid credits/IDs/versions cannot issue writes and malformed server data cannot masquerade as empty catalog', async () => {
  let calls = replies([])
  await assert.rejects(api.saveTemplateCourse('token', { maHocKyMau: 1, kyHieu: 'WEB', ten: 'Web', soTinChi: 0 }))
  await assert.rejects(api.saveTemplateSemester('token', { ten: 'Kỳ', thuTu: 1 }, 1))
  await assert.rejects(api.deleteTemplate('token', 'courses', 1, 0))
  assert.equal(calls.length, 0)
  assert.throws(() => api.parseCourse({ ...course, soTinChi: 31 }))
  calls = replies([[200, [semester, semester]], [200, { danhSach: [course], trang: 1, kichThuocTrang: 20, tongSo: 0 }]])
  await assert.rejects(api.listTemplateSemesters('token'))
  await assert.rejects(api.listTemplateCourses('token', '', '', 1))
})
test('duplicate/stale edits and restricted deletion surface server messages without pretend success', async () => {
  replies([[409, { detail: 'Học kỳ còn môn học.', code: 'CATALOG_CONFLICT' }], [403, { detail: 'Không có quyền.' }]])
  await assert.rejects(api.deleteTemplate('token', 'semesters', 1, 1), error => error.status === 409 && error.message === 'Học kỳ còn môn học.')
  await assert.rejects(api.listTemplateSemesters('token'), error => error.status === 403)
})
