import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({
  define: { 'import.meta.env.VITE_USE_MOCK_API': JSON.stringify('true') },
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
})
const { mockAuthRequest } = await server.ssrLoadModule('/src/api/mockAuth.ts')
let entries
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
beforeEach(() => {
  entries = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    get length() { return entries.size },
  } })
})
after(async () => {
  await server.close()
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
  else delete globalThis.localStorage
})

const registration = {
  email: 'student@example.com', hoTen: 'Nguyễn An', matKhau: 'Strong123!',
  maSinhVien: '0306239991', tenTruong: 'Cao đẳng Kỹ Thuật Cao Thắng',
  tenLop: 'CDTH23WEBC', nganhHoc: 'Công nghệ thông tin',
}
const register = (body = registration) => mockAuthRequest('/auth/register', { method: 'POST', body })
const login = (taiKhoan = registration.email, matKhau = registration.matKhau) => mockAuthRequest('/auth/login', { method: 'POST', body: { taiKhoan, matKhau } })
const me = (token) => mockAuthRequest('/users/me', { token })
async function session(taiKhoan = registration.email, matKhau = registration.matKhau) {
  const response = await login(taiKhoan, matKhau)
  assert.equal(response.status, 200)
  return response.json()
}
function safeProfile(profile) {
  assert.equal(typeof profile.ma, 'number')
  for (const field of ['email', 'hoTen', 'maSinhVien', 'tenTruong', 'tenLop', 'nganhHoc', 'vaiTro', 'ngayTao', 'ngayCapNhat']) assert.equal(typeof profile[field], 'string', field)
  assert.equal(typeof profile.dangHoatDong, 'boolean')
  for (const field of Object.keys(profile)) assert(!/matkhau|password|hash|salt/i.test(field), field + ' must not be exposed')
}

test('mock register returns 201 and a safe student profile using the Swagger DTO', async () => {
  const response = await register({ ...registration, email: ' STUDENT@EXAMPLE.COM ', hoTen: ' Nguyễn An ', vaiTro: 'Admin', dangHoatDong: false })
  assert.equal(response.status, 201)
  const profile = await response.json()
  safeProfile(profile)
  assert.equal(profile.email, registration.email)
  assert.equal(profile.hoTen, registration.hoTen)
  assert.equal(profile.maSinhVien, registration.maSinhVien)
  assert.equal(profile.tenTruong, registration.tenTruong)
  assert.equal(profile.tenLop, registration.tenLop)
  assert.equal(profile.nganhHoc, registration.nganhHoc)
  assert.equal(profile.vaiTro, 'Student')
  assert.equal(profile.dangHoatDong, true)
  const persisted = [...entries.values()].join('')
  assert(!persisted.includes(registration.matKhau), 'Raw passwords must not be persisted')
})

test('mock register rejects duplicate emails and MSSV and serializes simultaneous registrations', async () => {
  assert.equal((await register()).status, 201)
  assert.equal((await register({ ...registration, email: ' STUDENT@EXAMPLE.COM ', maSinhVien: '0306239999' })).status, 409)
  assert.equal((await register({ ...registration, email: 'other@example.com' })).status, 409)
  const candidate = { ...registration, email: 'parallel@example.com', maSinhVien: '0306238888' }
  const replies = await Promise.all([register(candidate), register(candidate)])
  assert.deepEqual(replies.map((reply) => reply.status).sort(), [201, 409])
})

test('mock register requires all seven fields and rejects whitespace-only values', async () => {
  for (const field of Object.keys(registration)) {
    for (const blank of ['', ' ']) assert.equal((await register({ ...registration, [field]: blank })).status, 400, field)
  }
  assert.equal((await register({ ...registration, email: 'not-an-email' })).status, 400)
  assert.equal((await register()).status, 201, 'Invalid submissions must not consume the identity')
})

test('mock login accepts email or MSSV and returns JWT, expiry and the current user', async () => {
  assert.equal((await register()).status, 201)
  for (const taiKhoan of [' STUDENT@EXAMPLE.COM ', '0306231307']) {
    const result = await session(taiKhoan)
    assert.equal(result.loaiToken, 'Bearer')
    assert.equal(typeof result.tokenTruyCap, 'string')
    assert.equal(result.tokenTruyCap.split('.').length, 3)
    assert(Date.parse(result.hetHanLuc) > Date.now())
    const claims = JSON.parse(Buffer.from(result.tokenTruyCap.split('.')[1], 'base64url').toString())
    assert(claims.exp * 1000 > Date.now())
    safeProfile(result.nguoiDung)
    assert.equal(result.nguoiDung.email, registration.email)
    const own = await me(result.tokenTruyCap)
    assert.equal(own.status, 200)
    assert.deepEqual(await own.json(), result.nguoiDung)
  }
  assert.equal((await login(registration.email, 'wrong-password')).status, 401)
  assert.equal((await login('missing@example.com')).status, 401)
})

test('mock seeds the student and admin accounts with their correct role', async () => {
  const student = await session('demo@studyplanner.vn', '123456')
  assert.equal(student.nguoiDung.vaiTro, 'Student')
  assert.equal(student.nguoiDung.maSinhVien, 'SVDEMO001')
  assert.equal(student.nguoiDung.tenTruong, 'Cao đẳng Kỹ Thuật Cao Thắng')
  assert.equal(student.nguoiDung.tenLop, 'CDTH23WEBC')
  assert.equal(student.nguoiDung.nganhHoc, 'Công nghệ thông tin')
  const admin = await session('admin@studyplanner.vn', '123456')
  assert.equal(admin.nguoiDung.vaiTro, 'Admin')
  assert.notEqual(admin.nguoiDung.ma, student.nguoiDung.ma)
  const ownStudentProfile = await (await me(student.tokenTruyCap)).json()
  assert.equal(ownStudentProfile.ma, student.nguoiDung.ma, 'A later admin login must not change the student token identity')
  assert.equal(ownStudentProfile.vaiTro, 'Student')
})

test('mock PATCH updates only editable profile fields and GET confirms persisted values', async () => {
  await register()
  const { tokenTruyCap, nguoiDung } = await session()
  const changes = { hoTen: ' Nguyễn An mới ', tenTruong: ' Trường mới ', tenLop: ' CDTH23D ', nganhHoc: ' Ngành mới ' }
  const response = await mockAuthRequest('/users/me', { method: 'PATCH', token: tokenTruyCap, body: {
    ...changes, ma: 999, email: 'hacker@example.com', maSinhVien: 'HACKED', vaiTro: 'Admin', dangHoatDong: false,
  } })
  assert.equal(response.status, 200)
  const updated = await response.json()
  safeProfile(updated)
  for (const [field, value] of Object.entries(changes)) assert.equal(updated[field], value.trim())
  for (const field of ['ma', 'email', 'maSinhVien', 'vaiTro', 'dangHoatDong', 'ngayTao']) assert.equal(updated[field], nguoiDung[field], field)
  const confirmed = await me(tokenTruyCap)
  assert.equal(confirmed.status, 200)
  assert.deepEqual(await confirmed.json(), updated)
  const anotherSession = await session()
  assert.equal(anotherSession.nguoiDung.hoTen, updated.hoTen)
})

test('mock password change validates the current password and revokes every old session', async () => {
  await register()
  const first = await session()
  const second = await session(registration.maSinhVien)
  const admin = await session('admin@studyplanner.vn', '123456')
  const change = (body) => mockAuthRequest('/users/me/change-password', { method: 'POST', token: first.tokenTruyCap, body })
  assert.equal((await change({ matKhauHienTai: 'wrong-password', matKhauMoi: 'NewStrong123!' })).status, 400)
  assert.equal((await me(first.tokenTruyCap)).status, 200)
  assert.equal((await change({ matKhauHienTai: registration.matKhau, matKhauMoi: 'NewStrong123!' })).status, 204)
  assert.equal((await me(first.tokenTruyCap)).status, 401)
  assert.equal((await me(second.tokenTruyCap)).status, 401)
  assert.equal((await me(admin.tokenTruyCap)).status, 200, 'Changing a student password must not revoke another account session')
  assert.equal((await login()).status, 401)
  const current = await session(registration.email, 'NewStrong123!')
  assert.equal((await me(current.tokenTruyCap)).status, 200)
  assert(![...entries.values()].join('').includes('NewStrong123!'))
})

test('mock GET rejects missing, unknown, modified and expired JWTs', async () => {
  await register()
  const current = await session()
  assert.equal((await me()).status, 401)
  assert.equal((await me('unknown-token')).status, 401)
  const tampered = current.tokenTruyCap.slice(0, -1) + (current.tokenTruyCap.endsWith('A') ? 'B' : 'A')
  assert.equal((await me(tampered)).status, 401)
  const originalNow = Date.now
  try {
    Date.now = () => originalNow() + 7 * 24 * 60 * 60 * 1000
    assert.equal((await me(current.tokenTruyCap)).status, 401)
  } finally { Date.now = originalNow }
})

test('mock account, edited profile and changed password survive a fresh module instance', async () => {
  await register()
  const initial = await session()
  const updated = await mockAuthRequest('/users/me', { method: 'PATCH', token: initial.tokenTruyCap, body: {
    hoTen: 'Tên đã lưu', tenTruong: registration.tenTruong, tenLop: 'CDTH23D', nganhHoc: registration.nganhHoc,
  } })
  assert.equal(updated.status, 200)
  const changed = await mockAuthRequest('/users/me/change-password', { method: 'POST', token: initial.tokenTruyCap, body: {
    matKhauHienTai: registration.matKhau, matKhauMoi: 'Persisted123!',
  } })
  assert.equal(changed.status, 204)
  const reloadedServer = await createServer({
    define: { 'import.meta.env.VITE_USE_MOCK_API': JSON.stringify('true') },
    server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  })
  try {
    const { mockAuthRequest: reloadedRequest } = await reloadedServer.ssrLoadModule('/src/api/mockAuth.ts')
    const loginResponse = await reloadedRequest('/auth/login', { method: 'POST', body: { taiKhoan: registration.maSinhVien, matKhau: 'Persisted123!' } })
    assert.equal(loginResponse.status, 200)
    const current = await loginResponse.json()
    assert.equal(current.nguoiDung.hoTen, 'Tên đã lưu')
    assert.equal(current.nguoiDung.tenLop, 'CDTH23D')
    assert.equal((await reloadedRequest('/users/me', { token: initial.tokenTruyCap })).status, 401)
  } finally { await reloadedServer.close() }
})
