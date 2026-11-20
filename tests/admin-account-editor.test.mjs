import assert from 'node:assert/strict'
import { test, after, afterEach } from 'node:test'
import { createServer } from 'vite'
const vite = await createServer({ configFile: false, envDir: false, appType: 'custom', server: { middlewareMode: true }, define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, optimizeDeps: { noDiscovery: true, include: [] } })
const { saveManagedStudent } = await vite.ssrLoadModule('/src/api/admin.ts')
const originalFetch = globalThis.fetch
after(() => vite.close()); afterEach(() => { globalThis.fetch = originalFetch })
const input = { name: ' An ', email: ' an@example.test ', studentId: ' SV001 ', schoolName: '', className: '', major: '', password: 'fixture-password' }
const response = { ma: 1, hoTen: 'An', email: 'an@example.test', maSoSinhVien: 'SV001', tenTruong: null, tenLop: null, nganhHoc: null, vaiTro: 'Student', dangHoatDong: true, ngayTao: '2026-11-18T00:00:00Z', ngayCapNhat: '2026-11-18T00:00:00Z' }
test('tạo tài khoản chỉ gửi hồ sơ cho phép, không nhận vai trò từ đầu vào', async () => {
  let call
  globalThis.fetch = async (url, options) => { call = { url, options, body: JSON.parse(options.body) }; return new Response(JSON.stringify(response), { status: 201 }) }
  const user = await saveManagedStudent('token', { ...input, vaiTro: 'Admin', matKhauBam: 'forbidden' })
  assert.equal(user.role, 'sinhvien'); assert.equal(call.options.method, 'POST')
  assert.equal(call.body.hoTen, 'An'); assert.equal(call.body.maSoSinhVien, 'SV001'); assert.equal(call.body.tenTruong, null)
  assert.equal(call.options.headers.Authorization, 'Bearer token')
  assert(!Object.hasOwn(call.body, 'vaiTro')); assert(!Object.hasOwn(call.body, 'matKhauBam'))
})
test('sửa giữ trạng thái đã khóa, gửi mốc cập nhật và không gửi lại mật khẩu', async () => {
  let body
  globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return new Response(JSON.stringify({ ...response, dangHoatDong: false })) }
  const original = { id: '1', role: 'sinhvien', status: 'locked', updatedAt: response.ngayCapNhat }
  await saveManagedStudent('token', input, original)
  assert.equal(body.dangHoatDong, false); assert.equal(body.ngayCapNhatMongDoi, original.updatedAt); assert(!Object.hasOwn(body, 'matKhau'))
})
test('dữ liệu sai và sửa tài khoản admin bị chặn trước khi gọi mạng', async () => {
  globalThis.fetch = () => assert.fail('Không được gọi mạng')
  await assert.rejects(saveManagedStudent('token', { ...input, email: 'bad' }))
  await assert.rejects(saveManagedStudent('token', { ...input, password: 'short' }))
  await assert.rejects(saveManagedStudent('token', input, { id: '1', role: 'admin' }), e => e.status === 403)
})
test('xung đột hồ sơ và email trùng hiển thị đúng lỗi máy chủ', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'ACCOUNT_CHANGED', detail: 'Tài khoản đã được cập nhật.' }), { status: 409 })
  await assert.rejects(saveManagedStudent('token', input), e => e.status === 409 && e.code === 'ACCOUNT_CHANGED')
})
