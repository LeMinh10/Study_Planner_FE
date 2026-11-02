import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

const options = (mock) => ({ define: { 'import.meta.env.VITE_USE_MOCK_API': JSON.stringify(String(mock)) }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const httpServer = await createServer(options(false))
const mockServer = await createServer(options(true))
const httpApi = await httpServer.ssrLoadModule('/src/api/admin.ts')
const mockApi = await mockServer.ssrLoadModule('/src/api/admin.ts')
const auth = await mockServer.ssrLoadModule('/src/api/auth.ts')
const { mockAuthRequest } = await mockServer.ssrLoadModule('/src/api/mockAuth.ts')
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let entries
beforeEach(() => {
  entries = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
    clear: () => entries.clear(),
  } })
})
afterEach(() => { globalThis.fetch = originalFetch })
after(async () => {
  await Promise.all([httpServer.close(), mockServer.close()])
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete globalThis.localStorage
})

const dto = { ma: 7, hoTen: 'Lê Công Minh', email: '0306231307@caothang.edu.vn', maSinhVien: '0306231307', tenTruong: 'Cao đẳng Kỹ Thuật Cao Thắng', tenLop: 'CDTH23WEBC', nganhHoc: 'Công nghệ thông tin', vaiTro: 'Student', dangHoatDong: true, ngayTao: '2026-10-30T08:00:00Z', ngayCapNhat: '2026-10-31T08:00:00Z' }
const registration = { fullName: 'Sinh viên mới', email: 'new-user@example.com', password: 'Student123!', studentCode: '0306239998', schoolName: 'Cao đẳng Kỹ Thuật Cao Thắng', className: 'CDTH23WEBC', major: 'Công nghệ thông tin' }
function fakeFetch(replies) {
  const calls = []
  globalThis.fetch = async (url, request) => {
    calls.push({ url, ...request })
    const response = replies.shift()
    assert(response, 'Unexpected HTTP request')
    return new Response(JSON.stringify(response[1]), { status: response[0], headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}
const adminSession = () => auth.loginAccount('admin@studyplanner.vn', '123456', 'admin')
async function registerSession() {
  await auth.registerStudent(registration)
  return auth.loginAccount(registration.email, registration.password, 'sinhvien')
}
function assertNoSecrets(value) {
  if (Array.isArray(value)) { value.forEach(assertNoSecrets); return }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    assert(!/matkhau|password|salt|hash/i.test(key), key + ' must not be returned')
    assertNoSecrets(child)
  }
}

test('admin list uses Swagger query names, bearer authentication and pagination metadata', async () => {
  const controller = new AbortController()
  const calls = fakeFetch([[200, { danhSach: [dto], trang: 2, kichThuocTrang: 5, tongSo: 6 }]])
  const result = await httpApi.listUsers('admin-token', { search: '  Minh  ', page: 2, pageSize: 5, isActive: false, signal: controller.signal })
  const url = new URL(calls[0].url, 'http://localhost')
  assert.equal(url.pathname, '/api/v1/admin/users')
  assert.deepEqual(Object.fromEntries(url.searchParams), { Trang: '2', KichThuocTrang: '5', TuKhoa: 'Minh', DangHoatDong: 'false' })
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].headers.Authorization, 'Bearer admin-token')
  assert.equal(calls[0].signal, controller.signal)
  assert.deepEqual({ page: result.page, pageSize: result.pageSize, total: result.total }, { page: 2, pageSize: 5, total: 6 })
  assert.deepEqual(result.items[0], { id: '7', name: dto.hoTen, email: dto.email, studentId: dto.maSinhVien, schoolName: dto.tenTruong, className: dto.tenLop, major: dto.nganhHoc, role: 'sinhvien', status: 'active', createdAt: dto.ngayTao, updatedAt: dto.ngayCapNhat })
})

test('admin detail supports nullable administrator profile fields and never depends on selected list data', async () => {
  const adminDto = { ...dto, ma: 3, vaiTro: 'Admin', maSinhVien: null, tenTruong: null, tenLop: null, nganhHoc: null, dangHoatDong: false }
  const calls = fakeFetch([[200, adminDto]])
  const detail = await httpApi.getUser('admin-token', '3')
  assert.equal(calls[0].url, '/api/v1/admin/users/3')
  assert.equal(calls[0].headers.Authorization, 'Bearer admin-token')
  assert.equal(detail.role, 'admin')
  assert.equal(detail.status, 'locked')
  assert.equal(detail.studentId, '')
  assert.equal(detail.schoolName, '')
})

test('status actions PATCH only the requested URL and accept the confirmed response', async () => {
  const calls = fakeFetch([[200, { thongBao: 'Kích hoạt tài khoản thành công.', dangHoatDong: true }], [200, { thongBao: 'Vô hiệu hóa tài khoản thành công.', dangHoatDong: false }]])
  assert.deepEqual(await httpApi.setUserActive('admin-token', '7', true), { message: 'Kích hoạt tài khoản thành công.', isActive: true })
  assert.deepEqual(await httpApi.setUserActive('admin-token', '7', false), { message: 'Vô hiệu hóa tài khoản thành công.', isActive: false })
  assert.deepEqual(calls.map(({ url, method, body }) => ({ url, method, body })), [
    { url: '/api/v1/admin/users/7/activate', method: 'PATCH', body: undefined },
    { url: '/api/v1/admin/users/7/deactivate', method: 'PATCH', body: undefined },
  ])
})

test('invalid identifiers and pagination cannot issue an unintended admin mutation', async () => {
  const calls = fakeFetch([])
  for (const id of ['', '0', '-1', '1/activate', '../1', '1.2', '2147483648']) {
    await assert.rejects(httpApi.getUser('token', id), (error) => error.status === 400)
    await assert.rejects(httpApi.setUserActive('token', id, false), (error) => error.status === 400)
  }
  for (const query of [{ page: 0 }, { page: 1.5 }, { pageSize: 0 }, { pageSize: 101 }]) await assert.rejects(httpApi.listUsers('token', query), (error) => error.status === 400)
  assert.equal(calls.length, 0)
})

test('malformed profile, pagination and status responses remain failures', async () => {
  fakeFetch([[200, { danhSach: [dto], trang: 1, kichThuocTrang: 20, tongSo: -1 }], [200, { ...dto, vaiTro: 'Owner' }], [200, { thongBao: 'Not applied', dangHoatDong: false }]])
  await assert.rejects(httpApi.listUsers('token'), /phân trang/)
  await assert.rejects(httpApi.getUser('token', '7'), /chưa hợp lệ/)
  await assert.rejects(httpApi.setUserActive('token', '7', true), /chưa xác nhận/)
})

test('mock admin endpoints require a valid active Admin session and do not expose credentials', async () => {
  const admin = await adminSession()
  const student = await registerSession()
  assert.equal((await mockAuthRequest('/admin/users')).status, 401)
  assert.equal((await mockAuthRequest('/admin/users', { token: student.token })).status, 403)
  const listed = await mockApi.listUsers(admin.token)
  assert(listed.items.some((user) => user.email === registration.email))
  assert(listed.items.some((user) => user.role === 'admin'))
  const studentRecord = listed.items.find((user) => user.email === registration.email)
  assert.equal((await mockAuthRequest('/admin/users/' + studentRecord.id, { token: student.token })).status, 403)
  assert.equal((await mockAuthRequest('/admin/users/' + studentRecord.id + '/deactivate', { method: 'PATCH', token: student.token })).status, 403)
  const raw = await (await mockAuthRequest('/admin/users', { token: admin.token })).json()
  assertNoSecrets(raw)
  assertNoSecrets(await (await mockAuthRequest('/admin/users/' + studentRecord.id, { token: admin.token })).json())
  assert.equal((await mockApi.getUser(admin.token, studentRecord.id)).status, 'active')
  assert.equal((await mockAuthRequest('/admin/users/2147483647', { token: admin.token })).status, 404)
})

test('mock admin listing searches, filters, paginates and includes newly registered accounts', async () => {
  const admin = await adminSession()
  for (let index = 0; index < 4; index++) await auth.registerStudent({ ...registration, fullName: 'Phân trang ' + index, email: 'page-' + index + '@example.com', studentCode: 'PAGE00' + index })
  const first = await mockApi.listUsers(admin.token, { search: 'Phân trang', page: 1, pageSize: 2 })
  const second = await mockApi.listUsers(admin.token, { search: 'Phân trang', page: 2, pageSize: 2 })
  assert.deepEqual({ total: first.total, page: first.page, size: first.pageSize, count: first.items.length }, { total: 4, page: 1, size: 2, count: 2 })
  assert.equal(second.total, 4)
  assert.equal(second.items.length, 2)
  assert(!first.items.some((user) => second.items.some((other) => other.id === user.id)))
  const target = first.items[0]
  await mockApi.setUserActive(admin.token, target.id, false)
  const inactive = await mockApi.listUsers(admin.token, { search: 'Phân trang', isActive: false })
  assert.equal(inactive.total, 1)
  assert.equal(inactive.items[0].id, target.id)
  const active = await mockApi.listUsers(admin.token, { search: 'Phân trang', isActive: true })
  assert.equal(active.total, 3)
  assert(!active.items.some((user) => user.id === target.id))
  const exact = await mockApi.listUsers(admin.token, { search: target.studentId })
  assert.equal(exact.total, 1)
  assert.equal(exact.items[0].email, target.email)
  const empty = await mockApi.listUsers(admin.token, { search: 'absent-identity' })
  assert.equal(empty.total, 0)
  assert.deepEqual(empty.items, [])
})

test('deactivation revokes existing sessions, blocks login, and activation allows fresh login only', async () => {
  const admin = await adminSession()
  const first = await registerSession()
  const second = await auth.loginAccount(registration.studentCode, registration.password, 'sinhvien')
  const target = (await mockApi.listUsers(admin.token, { search: registration.email })).items[0]
  const result = await mockApi.setUserActive(admin.token, target.id, false)
  assert.deepEqual(result, { message: 'Vô hiệu hóa tài khoản thành công.', isActive: false })
  assert.equal((await mockApi.getUser(admin.token, target.id)).status, 'locked')
  for (const token of [first.token, second.token]) await assert.rejects(auth.getCurrentUser(token), (error) => [401, 403].includes(error.status))
  await assert.rejects(auth.loginAccount(registration.email, registration.password, 'sinhvien'), (error) => error.status === 403)
  assert.equal((await auth.getCurrentUser(admin.token)).role, 'admin')
  assert.deepEqual(await mockApi.setUserActive(admin.token, target.id, true), { message: 'Kích hoạt tài khoản thành công.', isActive: true })
  assert.equal((await mockApi.getUser(admin.token, target.id)).status, 'active')
  for (const token of [first.token, second.token]) await assert.rejects(auth.getCurrentUser(token), (error) => error.status === 401)
  const fresh = await auth.loginAccount(registration.studentCode, registration.password, 'sinhvien')
  assert.equal(fresh.user.email, registration.email)
  assert.equal((await auth.getCurrentUser(fresh.token)).isActive, true)
})

test('admin state changes persist across a fresh module instance without overwriting account data', async () => {
  const admin = await adminSession()
  await registerSession()
  const target = (await mockApi.listUsers(admin.token, { search: registration.email })).items[0]
  await mockApi.setUserActive(admin.token, target.id, false)
  const reloadedServer = await createServer(options(true))
  try {
    const api = await reloadedServer.ssrLoadModule('/src/api/admin.ts')
    const detail = await api.getUser(admin.token, target.id)
    assert.equal(detail.email, registration.email)
    assert.equal(detail.studentId, registration.studentCode)
    assert.equal(detail.status, 'locked')
    await api.setUserActive(admin.token, target.id, true)
    assert.equal((await mockApi.getUser(admin.token, target.id)).status, 'active')
  } finally { await reloadedServer.close() }
})
