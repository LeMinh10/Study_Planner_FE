import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/hoc-tap/api.ts')
const time = await server.ssrLoadModule('/src/hoc-tap/time.ts')
const filters = await server.ssrLoadModule('/src/hoc-tap/boLoc.ts')
const calendar = await server.ssrLoadModule('/src/hoc-tap/lich.ts')
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
after(() => server.close())
afterEach(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow })
const envelope = (duLieu, phienBan = 5) => ({ phienBan, duLieu })
function replies(...values) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined })
    const value = values.shift()
    assert(value, 'Unexpected request')
    if (value instanceof Error) throw value
    return new Response(value.body === undefined ? null : JSON.stringify(value.body), { status: value.status ?? 200, headers: value.headers })
  }
  return calls
}
test('core client sends JWT, captured revision and idempotency key', async () => {
  const calls = replies({ status: 201, body: envelope({ ma: 9 }, 6) })
  const result = await api.goi('jwt', '/tasks', { method: 'POST', body: { tieuDe: 'Ôn SQL', maHocKy: 103, maMonHoc: 207 }, version: 5, key: 'same-attempt' })
  assert.equal(result.phienBan, 6)
  assert.equal(calls[0].headers.Authorization, 'Bearer jwt')
  assert.equal(calls[0].headers['If-Match'], '"ht-5"')
  assert.equal(calls[0].headers['Idempotency-Key'], 'same-attempt')
  assert.equal(calls[0].body.maMonHoc, 207)
})
test('empty DELETE reads the server ETag', async () => {
  replies({ status: 204, headers: { ETag: '"ht-6"' } })
  assert.equal((await api.goi('jwt', '/tasks/9', { method: 'DELETE', version: 5 })).phienBan, 6)
})
test('stale preview cannot silently upgrade a form and submit it', async () => {
  const calls = replies({ body: envelope({ maPhienBiHuy: [] }, 6) })
  await assert.rejects(api.thayDoi('jwt', '/tasks/9', 'PUT', { tieuDe: 'cũ' }, 5, { path: '/tasks/9/change-preview', body: { thaoTac: 'update' } }), /Dữ liệu đã đổi/)
  assert.equal(calls.length, 1)
})
test('cancelled impact confirmation never sends a write', async () => {
  const calls = replies({ body: envelope({ maPhienBiHuy: [11] }) })
  assert.equal(await api.thayDoi('jwt', '/tasks/9', 'PUT', {}, 5, { path: '/tasks/9/change-preview', body: {} }, async () => false), null)
  assert.equal(calls.length, 1)
})
test('confirmed availability deletion includes its impact flag and captured revision', async () => {
  const calls = replies({ body: envelope({ phienBiAnhHuong: [11] }) }, { status: 204, headers: { ETag: '"ht-6"' } })
  await api.thayDoi('jwt', '/availability-windows/2', 'DELETE', undefined, 5, { path: '/calendar/change-preview', body: { loai: 'GioRanh', ma: 2, xoa: true } }, async () => true)
  assert.equal(calls[1].url, '/api/v1/availability-windows/2?huyPhienLienQuan=true')
  assert.equal(calls[1].headers['If-Match'], '"ht-5"')
})
test('an active affected session blocks a calendar write', async () => {
  const calls = replies({ body: envelope({ canKetThucPhienDangHoc: true }) })
  await assert.rejects(api.thayDoi('jwt', '/availability-windows/2', 'PUT', {}, 5, { path: '/calendar/change-preview', body: {} }), /kết thúc phiên/)
  assert.equal(calls.length, 1)
})
test('new task event can ask confirmation before cancelling conflicting sessions', async () => {
  const calls = replies({ status: 409, body: { code: 'SCHEDULE_CHANGE_CONFIRMATION_REQUIRED', details: { maPhienBiHuy: [11] } } }, { body: envelope({ ma: 9 }, 6) })
  await api.thayDoi('jwt', '/tasks', 'POST', { tieuDe: 'Ca thi' }, 5, undefined, async () => true)
  assert.equal(calls[1].body.huyPhienLienQuan, true)
  assert.equal(calls[1].headers['If-Match'], '"ht-5"')
})
test('offline writes are not automatically retried', async () => {
  const calls = replies(new TypeError('offline'))
  await assert.rejects(api.goi('jwt', '/planning/apply', { method: 'POST', body: {}, key: 'retry-this' }), /kiểm tra kết quả/)
  assert.equal(calls.length, 1)
})
test('invalid core responses are rejected', async () => {
  replies({ body: { danhSach: [] } })
  await assert.rejects(api.goi('jwt', '/tasks'), /phiên bản/)
})
test('technical task hierarchy errors are translated for students', async () => {
  replies({ status: 409, body: { code: 'TASK_CYCLE', detail: 'Cây có vòng.' } })
  await assert.rejects(api.goi('jwt', '/tasks/9/parent', { method: 'PATCH', version: 5, body: {} }), error => error.message.includes('bước nhỏ') && !error.message.includes('Cây'))
})
test('account timezone conversion round trips and rejects ambiguous DST', () => {
  assert.equal(time.utc('2026-11-06T19:00', 'Asia/Ho_Chi_Minh'), '2026-11-06T12:00:00.000Z')
  assert.equal(time.gioNhap('2026-11-06T12:00:00Z', 'Asia/Ho_Chi_Minh'), '2026-11-06T19:00')
  assert.throws(() => time.utc('2026-11-01T01:30', 'America/New_York'), /không xác định/)
  assert.throws(() => time.utc('2026-03-08T02:30', 'America/New_York'), /không xác định/)
})
test('month navigation preserves months, leap days, and Monday week starts', () => {
  assert.equal(time.doiKhoang('2026-01-31', 1, 'month', 42), '2026-02-01')
  assert.equal(time.doiKhoang('2026-01-01', -1, 'month', 42), '2025-12-01')
  assert.equal(time.congNgay('2028-02-28', 1), '2028-02-29')
  assert.equal(time.dauTuan('2026-11-08'), '2026-11-02')
})
test('midnight endings do not occupy the following calendar day', () => {
  const from = Date.parse('2026-11-06T17:00:00Z')
  const to = Date.parse('2026-11-07T17:00:00Z')
  assert.equal(time.trongKhoang('2026-11-06T16:00:00Z', '2026-11-06T17:00:00Z', from, to), false)
  assert.equal(time.trongKhoang('2026-11-06T16:00:00Z', '2026-11-06T17:30:00Z', from, to), true)
})
test('editing metadata preserves original timestamp precision when the displayed minute is unchanged', () => {
  const original = '2026-11-06T12:00:42.123456Z'
  assert.equal(time.thoiDiemGui('2026-11-06T19:00', original, 'Asia/Ho_Chi_Minh'), original)
  assert.equal(time.thoiDiemGui('2026-11-06T19:01', original, 'Asia/Ho_Chi_Minh'), '2026-11-06T12:01:00.000Z')
})
test('default task scope includes personal tasks even when the sidebar has an academic selection', () => {
  const params = new URLSearchParams()
  const scope = filters.layPhamVi(params, [{ id: '207', semesterId: '103', name: 'CSDL' }])
  assert.deepEqual(scope, { hocKy: '', monHoc: '' })
  const query = new URLSearchParams(filters.taoTruyVanNhiemVu(params, 1, '', scope))
  assert(!query.has('maHocKy'))
  assert(!query.has('maMonHoc'))
})
test('explicit named semester/course filters are preserved and inbox spans semesters', () => {
  const params = new URLSearchParams('semester=103&subject=207&priority=High&type=Assignment&status=InProgress')
  const scope = filters.layPhamVi(params, [{ id: '207', semesterId: '103' }])
  const query = new URLSearchParams(filters.taoTruyVanNhiemVu(params, 2, ' SQL ', scope))
  assert.equal(query.get('maHocKy'), '103')
  assert.equal(query.get('maMonHoc'), '207')
  assert.equal(query.get('mucDoUuTien'), 'High')
  assert.equal(query.get('loai'), 'Assignment')
  assert.equal(query.get('trangThai'), 'InProgress')
  assert.equal(query.get('tuKhoa'), 'SQL')
  assert.equal(query.get('trang'), '2')
  params.set('view', 'inbox')
  const personal = new URLSearchParams(filters.taoTruyVanNhiemVu(params, 1, '', scope))
  assert(!personal.has('maHocKy'))
  assert(!personal.has('maMonHoc'))
})
test('day layout restores overlapping lanes, adjacent slots, and availability background', () => {
  const event = (ma, start, end, loai = 'LichHoc') => ({ ma, loai, batDau: '2026-11-06T' + start + ':00Z', ketThuc: '2026-11-06T' + end + ':00Z' })
  const blocks = calendar.xepKhoiLich('2026-11-06', [event('a', '12:00', '13:00'), event('b', '12:30', '13:30'), event('c', '13:30', '14:00'), event('free', '11:00', '15:00', 'GioRanh')], 'Asia/Ho_Chi_Minh')
  assert.equal(blocks.find(b => b.suKien.ma === 'a').soCot, 2)
  assert.equal(blocks.find(b => b.suKien.ma === 'b').cot, 1)
  assert.equal(blocks.find(b => b.suKien.ma === 'c').soCot, 1)
  assert.equal(blocks.find(b => b.suKien.ma === 'a').top, 19 * 60)
  assert.equal(blocks.find(b => b.suKien.ma === 'free').soCot, 1)
})
