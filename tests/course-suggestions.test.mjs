import assert from 'node:assert/strict'
import { test, after, afterEach } from 'node:test'
import { createServer } from 'vite'
const vite = await createServer({ configFile: false, envDir: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, optimizeDeps: { noDiscovery: true, include: [] } })
const { loadCourseSuggestions } = await vite.ssrLoadModule('/src/api/courseSuggestions.ts')
const original = globalThis.fetch
after(() => vite.close())
afterEach(() => { globalThis.fetch = original })
const course = { ma: 8, maHocKyMau: 2, tenHocKy: 'Học kỳ 2', kyHieu: 'CSDL01', ten: 'Cơ sở dữ liệu', soTinChi: 3 }
function reply(status, response) {
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(response), { status }) }
  return calls
}
test('student suggestions use authenticated read-only catalog, search and pagination without tying it to a personal semester', async () => {
  const calls = reply(200, { danhSach: [course], trang: 2, kichThuocTrang: 20, tongSo: 21 })
  const result = await loadCourseSuggestions('student-token', ' CSDL ', 2)
  assert.deepEqual(result, { rows: [course], page: 2, total: 21 })
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer student-token')
  const url = new URL(calls[0].url, 'http://test')
  assert.equal(url.pathname, '/api/v1/catalog/courses')
  assert.equal(url.searchParams.get('tuKhoa'), 'CSDL'); assert.equal(url.searchParams.get('trang'), '2')
  assert(!url.searchParams.has('maHocKy')); assert(!url.pathname.includes('/admin/'))
})
test('empty suggestions are valid; invalid credits, duplicate IDs and mismatched pages remain errors', async () => {
  reply(200, { danhSach: [], trang: 1, kichThuocTrang: 20, tongSo: 0 })
  assert.deepEqual((await loadCourseSuggestions('token', '')).rows, [])
  for (const payload of [
    { danhSach: [{ ...course, soTinChi: 0 }], trang: 1, kichThuocTrang: 20, tongSo: 1 },
    { danhSach: [course, course], trang: 1, kichThuocTrang: 20, tongSo: 2 },
    { danhSach: [course], trang: 2, kichThuocTrang: 20, tongSo: 1 },
  ]) { reply(200, payload); await assert.rejects(loadCourseSuggestions('token', '')) }
})
test('request cancellation is forwarded and server errors never produce fake suggestions', async () => {
  const controller = new AbortController()
  const calls = reply(200, { danhSach: [course], trang: 1, kichThuocTrang: 20, tongSo: 1 })
  await loadCourseSuggestions('token', '', 1, controller.signal)
  assert.equal(calls[0].options.signal, controller.signal)
  reply(503, { detail: 'Temporarily unavailable' })
  await assert.rejects(loadCourseSuggestions('token', ''), error => error.status === 503)
})
