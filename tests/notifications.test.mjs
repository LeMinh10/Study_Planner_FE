import assert from 'node:assert/strict'
import { test, after, afterEach } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-notification-test', define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/notifications.ts')
const original = globalThis.fetch
after(() => server.close())
afterEach(() => { globalThis.fetch = original })
const item = { ma: 10, maNhiemVu: 25, tieuDe: 'Nhiệm vụ sắp đến hạn', tenNhiemVu: 'Làm bài tập', noiDung: 'Sắp đến hạn.', hanHieuLuc: '2026-11-10T17:00:00+07:00', maHocKy: 6, tenHocKy: 'Học kỳ 6', maMonHoc: 4, tenMonHoc: 'CSDL', quaHan: false, daHoanThanh: false, ngayPhat: '2026-11-10T08:00:00Z', ngayDoc: null }
const inbox = { danhSach: [item], trang: 1, kichThuocTrang: 20, tongSo: 1, tongChuaDoc: 1, muiGio: 'Asia/Ho_Chi_Minh', docDenLuc: '2026-11-10T09:00:00Z' }
test('notification list uses account JWT, unread filter and pagination without any semester filter', async () => {
  globalThis.fetch = async (url, options) => {
    const u = new URL(url, 'https://test.local')
    assert.equal(u.pathname, '/api/v1/notifications')
    assert.equal(u.searchParams.get('chuaDoc'), 'true')
    assert.equal(u.searchParams.get('trang'), '1')
    assert.equal(u.searchParams.has('maHocKy'), false)
    assert.equal(options.headers.Authorization, 'Bearer private-test-token')
    assert.equal(options.method, 'GET')
    assert.equal(options.cache, 'no-store')
    return Response.json(inbox)
  }
  assert.deepEqual(await api.loadNotifications('private-test-token', true, 1), inbox)
})
test('notification reads use delivery snapshot and server read-all cutoff, accept 204 and propagate failures', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push([url, options.method, JSON.parse(options.body)]); return new Response(null, { status: 204 }) }
  await api.readNotification('test', item)
  await api.readAllNotifications('test', inbox.docDenLuc)
  assert.deepEqual(calls, [['/api/v1/notifications/10/read', 'PATCH', { ngayPhat: item.ngayPhat }], ['/api/v1/notifications/read-all', 'POST', { docDenLuc: inbox.docDenLuc }]])
  globalThis.fetch = async () => Response.json({ detail: 'Thông báo đã thay đổi.', code: 'NOTIFICATION_CHANGED' }, { status: 409 })
  await assert.rejects(api.readNotification('test', item), /Thông báo đã thay đổi/)
})
test('malformed notification responses and unsafe identifiers cannot produce valid inboxes or writes', async () => {
  for (const value of [null, { ...inbox, muiGio: 'invalid' }, { ...inbox, docDenLuc: '2026-11-10' }, { ...inbox, danhSach: [item, item] }, { ...inbox, danhSach: [{ ...item, ngayDoc: 'invalid' }] }, { ...inbox, tongChuaDoc: -1 }]) assert.throws(() => api.parseInbox(value), /chưa hợp lệ/)
  globalThis.fetch = async () => { throw new Error('Must not reach network') }
  await assert.rejects(api.readNotification('test', { ...item, ma: -1 }), /chưa hợp lệ/)
  await assert.rejects(api.readAllNotifications('test', 'bad'), /chưa hợp lệ/)
})
test('notification links open exact task/semester/subject and completed view when necessary', () => {
  const url = new URL(api.notificationHref({ ...item, daHoanThanh: true }), 'https://test.local')
  assert.equal(url.pathname, '/tasks')
  assert.deepEqual(Object.fromEntries(url.searchParams), { task: '25', semester: '6', subject: '4', view: 'completed' })
  assert.equal(api.notificationHref({ ...item, maHocKy: null, maMonHoc: null }), '/tasks?task=25')
})
