import assert from 'node:assert/strict'
import { test, after, afterEach } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-overview-test', define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/adminOverview.ts')
const users = await server.ssrLoadModule('/src/api/admin.ts')
const original = globalThis.fetch
after(() => server.close())
afterEach(() => { globalThis.fetch = original })
const summary = { tongSinhVien: 34, dangMo: 22, daKhoa: 12, moiTrong7Ngay: 8, tuNgay: '2026-11-05T03:00:00Z', denNgay: '2026-11-12T03:00:00Z', sinhVienMoi: Array.from({ length: 5 }, (_, i) => ({ ma: i + 1, hoTen: 'Sinh viên ' + i, email: i + '@example.test', dangHoatDong: i % 2 === 0, ngayTao: '2026-11-12T00:00:00Z' })) }
test('admin overview reads server aggregates with JWT rather than counting a user page', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/v1/admin/overview')
    assert.equal(options.method, 'GET'); assert.equal(options.headers.Authorization, 'Bearer overview-test'); assert.equal(options.signal, controller.signal)
    return Response.json(summary)
  }
  const result = await api.loadAdminOverview('overview-test', controller.signal)
  assert.equal(result.total, 34); assert.equal(result.students.length, 5); assert.equal(result.locked, 12); assert.equal(result.recentCount, 8)
})
test('overview accepts a real empty response and rejects inconsistent counts or partial student DTOs', () => {
  assert.equal(api.parseAdminOverview({ ...summary, tongSinhVien: 0, dangMo: 0, daKhoa: 0, moiTrong7Ngay: 0, sinhVienMoi: [] }).total, 0)
  for (const payload of [null, { ...summary, dangMo: 1 }, { ...summary, moiTrong7Ngay: 35 }, { ...summary, sinhVienMoi: [] }, { ...summary, sinhVienMoi: [summary.sinhVienMoi[0], summary.sinhVienMoi[0], ...summary.sinhVienMoi.slice(2)] }, { ...summary, tuNgay: 'bad' }, { ...summary, sinhVienMoi: summary.sinhVienMoi.map((item, i) => i ? item : { ...item, ngayTao: '2026-11-12' }) }]) assert.throws(() => api.parseAdminOverview(payload), /chưa hợp lệ/)
})
test('metric links and user API preserve the exact student/date/status filters', async () => {
  const data = api.parseAdminOverview(summary)
  const locked = new URL(api.overviewStudentLink('locked', data), 'https://test.local')
  assert.deepEqual(Object.fromEntries(locked.searchParams), { VaiTro: 'Student', DangHoatDong: 'false' })
  const recent = new URL(api.overviewStudentLink('recent', data), 'https://test.local')
  assert.deepEqual(Object.fromEntries(recent.searchParams), { VaiTro: 'Student', TaoTu: data.from, TaoDen: data.to })
  globalThis.fetch = async (path) => {
    const q = new URL(path, 'https://test.local').searchParams
    assert.equal(q.get('VaiTro'), 'Student'); assert.equal(q.get('TaoTu'), data.from); assert.equal(q.get('TaoDen'), data.to); assert.equal(q.get('DangHoatDong'), 'false')
    return Response.json({ danhSach: [], trang: 1, kichThuocTrang: 20, tongSo: 0 })
  }
  await users.listUsers('test', { role: 'sinhvien', isActive: false, createdFrom: data.from, createdTo: data.to })
  globalThis.fetch = async () => { throw new Error('Must not call network') }
  await assert.rejects(users.listUsers('test', { role: 'owner' }), /chưa hợp lệ/)
  await assert.rejects(users.listUsers('test', { createdFrom: 'bad' }), /chưa hợp lệ/)
  await assert.rejects(users.listUsers('test', { createdFrom: data.to, createdTo: data.from }), /chưa hợp lệ/)
})
test('overview API propagates permission and server failures without inventing empty statistics', async () => {
  globalThis.fetch = async () => Response.json({ detail: 'Không có quyền.' }, { status: 403 })
  await assert.rejects(api.loadAdminOverview('test'), e => e.status === 403)
  globalThis.fetch = async () => Response.json({ detail: 'Database unavailable' }, { status: 503 })
  await assert.rejects(api.loadAdminOverview('test'), e => e.status === 503)
})
