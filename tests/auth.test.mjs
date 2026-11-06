import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ define: { 'import.meta.env.VITE_USE_MOCK_API': JSON.stringify('false'), 'import.meta.env.VITE_ENABLE_DEMO_AUTH': JSON.stringify('true') }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/auth.ts')
const { apiRequest, ApiError, SESSION_INVALID_EVENT } = await server.ssrLoadModule('/src/api/client.ts')
const session = await server.ssrLoadModule('/src/auth/session.ts')
const validation = await server.ssrLoadModule('/src/auth/validation.ts')
const demo = await server.ssrLoadModule('/src/auth/demo.ts')
const originalFetch = globalThis.fetch
after(async () => { await server.close() })
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.sessionStorage; delete globalThis.window })

const jwt = (claims = {}) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, role: 'sinhvien', ...claims })).toString('base64url') + '.test-signature'
const profile = { ma: 2, hoTen: 'Nguyễn An', email: 'an@example.com', maSoSinhVien: '0306231307', tenTruong: 'Đại học', tenLop: 'CNTT01', nganhHoc: 'CNTT', vaiTro: 'Student', dangHoatDong: true, muiGio: 'Asia/Ho_Chi_Minh', nhacTruocGio: 24, ngayTao: '2026-10-31T08:00:00Z', ngayCapNhat: '2026-10-31T08:00:00Z' }
const registration = { fullName: 'Nguyễn An', email: 'an@example.com', password: 'Strong123!', studentCode: '0306231307', schoolName: 'Cao đẳng Kỹ Thuật Cao Thắng', className: 'CDTH23WEBC', major: 'Công nghệ thông tin' }
function mockFetch(replies) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, payload: options.body ? JSON.parse(options.body) : undefined })
    const reply = replies.shift()
    assert(reply, 'Unexpected additional API request')
    if (reply instanceof Error) throw reply
    const [status, body] = reply
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}
function storage() {
  const entries = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
  return entries
}

test('registration sends the seven required fields without role/status; duplicate email is an error', async () => {
  const calls = mockFetch([[201, profile], [409, { thongBao: 'Email đã tồn tại.' }]])
  const input = { ...registration, fullName: '  Nguyễn An  ', email: ' AN@EXAMPLE.COM ', studentCode: ' 0306231307 ', schoolName: ' Cao đẳng Kỹ Thuật Cao Thắng ', className: ' CDTH23WEBC ', major: ' Công nghệ thông tin ', role: 'admin', isActive: true, confirmPassword: 'Strong123!' }
  await api.registerStudent(input)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].url, '/api/v1/auth/register')
  assert.deepEqual(calls[0].payload, { email: registration.email, hoTen: registration.fullName, matKhau: registration.password, maSoSinhVien: registration.studentCode, tenTruong: registration.schoolName, tenLop: registration.className, nganhHoc: registration.major })
  await assert.rejects(api.registerStudent(input), (error) => error instanceof ApiError && error.status === 409 && error.message === 'Email đã tồn tại.')
})

test('login verifies the JWT against the current-user API before accepting a student session', async () => {
  const token = jwt()
  const hetHanLuc = new Date(Date.now() + 1800000).toISOString()
  const calls = mockFetch([[200, { tokenTruyCap: token, loaiToken: 'Bearer', hetHanLuc, nguoiDung: profile }], [200, { data: profile }]])
  const result = await api.loginAccount(' AN@EXAMPLE.COM ', 'Strong123!', 'sinhvien')
  assert.deepEqual(calls[0].payload, { taiKhoan: 'an@example.com', matKhau: 'Strong123!' })
  assert.equal(calls[0].url, '/api/v1/auth/login')
  assert.equal(calls[1].url, '/api/v1/users/me')
  assert.equal(calls[1].headers.Authorization, 'Bearer ' + token)
  assert.equal(result.user.name, profile.hoTen)
  assert.equal(result.user.studentId, profile.maSoSinhVien)
  assert.equal(result.user.school, profile.tenTruong)
  assert.equal(result.user.className, profile.tenLop)
  assert.equal(result.user.major, profile.nganhHoc)
  assert.equal(result.user.role, 'sinhvien')
  assert.deepEqual(api.parseAuthUser({ nguoiDung: profile }, token), result.user)
  assert.equal(result.token, token)
  assert.equal(result.expiresAt, Date.parse(hetHanLuc))
})

test('MSSV login uses taiKhoan and preserves leading zeroes and identifier case', async () => {
  for (const account of ['0306231307', 'SvABC01']) {
    const calls = mockFetch([[200, { tokenTruyCap: jwt() }], [200, profile]])
    await api.loginAccount(' ' + account + ' ', 'Strong123!', 'sinhvien')
    assert.deepEqual(calls[0].payload, { taiKhoan: account, matKhau: 'Strong123!' })
  }
})

test('admin login accepts only an admin role confirmed by the server', async () => {
  const token = jwt({ role: 'admin' })
  mockFetch([[200, { tokenTruyCap: token }], [200, { ...profile, vaiTro: 'Admin' }]])
  assert.equal((await api.loginAccount('admin@example.com', 'Strong123!', 'admin')).user.role, 'admin')
  mockFetch([[200, { tokenTruyCap: token }], [200, profile]])
  await assert.rejects(api.loginAccount('an@example.com', 'Strong123!', 'admin'), /không có quyền quản trị/)
  mockFetch([[200, { tokenTruyCap: token }], [200, { ...profile, vaiTro: 'Admin' }]])
  await assert.rejects(api.loginAccount('admin@example.com', 'Strong123!', 'sinhvien'), /trang đăng nhập admin/)
})

test('wrong passwords, disabled accounts, unknown roles and expired tokens never create sessions', async () => {
  mockFetch([[401, { thongBao: 'Tài khoản hoặc mật khẩu không đúng.' }]])
  await assert.rejects(api.loginAccount('an@example.com', 'wrong', 'sinhvien'), /mật khẩu không đúng/)
  mockFetch([[403, { thongBao: 'Tài khoản đã bị vô hiệu hóa.' }]])
  await assert.rejects(api.loginAccount('an@example.com', 'Strong123!', 'sinhvien'), /vô hiệu hóa/)
  mockFetch([[200, { tokenTruyCap: jwt() }], [200, { ...profile, dangHoatDong: false }]])
  await assert.rejects(api.loginAccount('an@example.com', 'Strong123!', 'sinhvien'), /vô hiệu hóa/)
  mockFetch([[200, { tokenTruyCap: jwt() }], [200, { ...profile, vaiTro: 'owner' }]])
  await assert.rejects(api.loginAccount('an@example.com', 'Strong123!', 'sinhvien'), /chưa hợp lệ/)
  const calls = mockFetch([[200, { tokenTruyCap: jwt({ exp: 1 }) }]])
  await assert.rejects(api.loginAccount('an@example.com', 'Strong123!', 'sinhvien'), /hết hạn/)
  assert.equal(calls.length, 1)
})

test('profile update whitelists editable fields and reloads the server-confirmed profile', async () => {
  const token = jwt()
  const updated = { ...profile, hoTen: 'Tên mới', maSoSinhVien: 'SV01', tenLop: 'CNTT02' }
  const calls = mockFetch([[200, updated], [200, updated]])
  const result = await api.updateCurrentUser(token, { name: ' Tên mới ', email: 'hacker@example.com', studentId: ' SV01 ', school: ' Đại học ', className: ' CNTT02 ', major: ' CNTT ', role: 'admin', isActive: false })
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].headers.Authorization, 'Bearer ' + token)
  assert.deepEqual(calls[0].payload, { hoTen: 'Tên mới', maSoSinhVien: 'SV01', tenTruong: 'Đại học', tenLop: 'CNTT02', nganhHoc: 'CNTT' })
  assert.equal(calls[1].method, 'GET')
  assert.equal(result.name, updated.hoTen)
  assert.equal(result.studentId, updated.maSoSinhVien)
  assert.equal(result.email, profile.email)
  assert.equal(result.role, 'sinhvien')
})

test('password change sends Vietnamese fields, accepts 204 or 200, and propagates failure', async () => {
  const token = jwt()
  const calls = mockFetch([[204], [200, { thongBao: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' }], [400, { errors: { matKhauHienTai: ['Mật khẩu hiện tại không đúng.'] } }]])
  await api.changeCurrentPassword(token, { currentPassword: 'oldPassword', newPassword: 'newPassword', role: 'admin', confirmPassword: 'newPassword' })
  assert.equal(calls[0].url, '/api/v1/users/me/change-password')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].headers.Authorization, 'Bearer ' + token)
  assert.deepEqual(calls[0].payload, { matKhauHienTai: 'oldPassword', matKhauMoi: 'newPassword' })
  await api.changeCurrentPassword(token, { currentPassword: 'oldPassword', newPassword: 'newPassword' })
  await assert.rejects(api.changeCurrentPassword(token, { currentPassword: 'bad', newPassword: 'newPassword' }), /hiện tại không đúng/)
})

test('401 and disabled-account responses invalidate only the affected token', async () => {
  const events = []
  globalThis.window = { dispatchEvent: (event) => events.push(event) }
  mockFetch([[401], [403, { code: 'ACCOUNT_DISABLED' }], [400, { message: 'Sai mật khẩu hiện tại.' }], [401]])
  await assert.rejects(apiRequest('/users/me', { token: 'first' }))
  await assert.rejects(apiRequest('/users/me', { token: 'second' }))
  await assert.rejects(apiRequest('/users/me/change-password', { token: 'third' }))
  await assert.rejects(apiRequest('/auth/login'))
  assert.deepEqual(events.map((event) => [event.type, event.detail.token]), [[SESSION_INVALID_EVENT, 'first'], [SESSION_INVALID_EVENT, 'second']])
})

test('network failures and server errors remain errors, without exposing backend internals', async () => {
  mockFetch([new TypeError('Network down'), [500, { detail: 'Sensitive server exception' }]])
  await assert.rejects(api.registerStudent(registration), /Không thể kết nối/)
  await assert.rejects(api.getCurrentUser(jwt()), (error) => error.message.includes('Máy chủ đang gặp sự cố') && !error.message.includes('Sensitive'))
})

test('session storage contains only JWT/expiry, ignores old demo flags and removes expired credentials', () => {
  const entries = storage()
  entries.set('studyplanner.demo-session', 'true')
  entries.set('studyplanner.admin-session', 'true')
  assert.equal(session.readAuthCredentials(), null)
  const token = jwt()
  const credentials = { token, expiresAt: session.tokenExpiry(token) }
  session.saveAuthCredentials({ ...credentials, password: 'secret', role: 'admin', user: profile })
  assert.deepEqual(session.readAuthCredentials(), credentials)
  const stored = [...entries.values()].map((value) => { try { return JSON.parse(value) } catch { return value } }).find((value) => value?.token)
  assert.deepEqual(Object.keys(stored).sort(), ['expiresAt', 'token'])
  session.clearAuthCredentials()
  assert.equal(session.readAuthCredentials(), null)
  session.saveAuthCredentials({ token: jwt({ exp: 1 }), expiresAt: Date.now() + 3600000 })
  assert.equal(session.readAuthCredentials(), null)
  assert(![...entries.values()].some((value) => value.includes('test-signature')))
})

test('expiry uses the earlier server/JWT deadline and rejects malformed JWT payloads', () => {
  const token = jwt({ exp: 2000000000 })
  assert.equal(session.tokenExpiry(token, '2030-01-01T00:00:00Z'), Date.parse('2030-01-01T00:00:00Z'))
  assert.equal(session.tokenExpiry('bad-token'), 0)
  assert.equal(session.normalizeRole('SinhVien'), 'sinhvien')
  assert.equal(session.normalizeRole('Admin'), 'admin')
  assert.equal(session.normalizeRole('owner'), null)
})

test('registration requires every field, rejects whitespace-only values and checks password confirmation', () => {
  for (const field of Object.keys(registration)) {
    for (const blank of ['', ' ']) assert(validation.registrationError({ ...registration, [field]: blank }, registration.password), field)
  }
  assert(validation.registrationError({ ...registration, email: 'bad-email' }, registration.password))
  assert(validation.registrationError(registration, 'different'))
  assert(validation.newPasswordError('123', '123'))
  assert(validation.newPasswordError('1234567', '1234567'))
  assert.equal(validation.newPasswordError('12345678', '12345678'), '')
  assert.equal(validation.newPasswordError('a'.repeat(128), 'a'.repeat(128)), '')
  assert(validation.newPasswordError('a'.repeat(129), 'a'.repeat(129)))
  assert(validation.newPasswordError('Strong123!', 'different'))
  assert.equal(validation.registrationError(registration, registration.password), '')
  for (const [field, maximum] of [['fullName', 200], ['email', 320], ['studentCode', 50], ['schoolName', 200], ['className', 200], ['major', 200]]) {
    assert(validation.registrationError({ ...registration, [field]: 'a'.repeat(maximum + 1) }, registration.password), field)
  }
})

test('real API mode cannot accept or restore a fake demo session by default', async () => {
  const live = await createServer({ define: { 'import.meta.env.VITE_USE_MOCK_API': '""', 'import.meta.env.VITE_ENABLE_DEMO_AUTH': '""' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const settings = await live.ssrLoadModule('/src/api/config.ts')
    const disabledDemo = await live.ssrLoadModule('/src/auth/demo.ts')
    storage().set('studyplanner.demo.v1', 'admin')
    assert.equal(settings.useMockApi, false)
    assert.equal(disabledDemo.demoEnabled, false)
    assert.equal(disabledDemo.tryDemoLogin('admin@studyplanner.vn', '123456', 'admin'), null)
    assert.equal(disabledDemo.readDemoSession(), null)
  } finally { await live.close() }
})

test('profile payload permits clearing optional fields and sends only backend-editable keys', () => {
  assert.deepEqual(api.profilePayload({ name: ' Tên mới ', email: 'keep@example.com', studentId: ' ', school: '', className: ' ', major: '', role: 'admin', isActive: false }), {
    hoTen: 'Tên mới', maSoSinhVien: null, tenTruong: null, tenLop: null, nganhHoc: null,
  })
})

test('demo login accepts only the sample password and student role, without a JWT', () => {
  const user = demo.tryDemoLogin(' DEMO@studyplanner.vn ', '123456', 'sinhvien')
  assert.equal(user.role, 'sinhvien')
  assert.equal(user.name, 'Sinh viên mẫu')
  assert.equal(user.token, undefined)
  assert.throws(() => demo.tryDemoLogin('demo@studyplanner.vn', 'wrong', 'sinhvien'), /không đúng/)
  assert.throws(() => demo.tryDemoLogin('demo@studyplanner.vn', '123456', 'admin'), /chỉ dùng cho trang sinh viên/)
  assert.equal(demo.tryDemoLogin('real@example.com', '123456', 'sinhvien'), null)
})

test('demo session restores only the fixed student identity and logout removes the marker', () => {
  const entries = storage()
  assert.equal(demo.readDemoSession(), null)
  demo.saveDemoSession()
  assert.equal(demo.readDemoSession().email, 'demo@studyplanner.vn')
  assert.deepEqual([...entries.values()], ['active'])
  assert.equal(session.readAuthCredentials(), null)
  demo.clearDemoSession()
  assert.equal(demo.readDemoSession(), null)
  assert.equal(entries.size, 0)
})

test('admin demo credentials have a fixed admin identity and cannot log into the student entry', () => {
  const user = demo.tryDemoLogin(' ADMIN@studyplanner.vn ', '123456', 'admin')
  assert.equal(user.role, 'admin')
  assert.equal(user.email, 'admin@studyplanner.vn')
  assert.equal(user.name, 'Quản trị viên')
  assert.equal(user.token, undefined)
  assert.throws(() => demo.tryDemoLogin('admin@studyplanner.vn', 'wrong', 'admin'), /không đúng/)
  assert.throws(() => demo.tryDemoLogin('admin@studyplanner.vn', '123456', 'sinhvien'), /trang đăng nhập admin/)
})

test('admin demo session restores its role and logout removes it without storing credentials', () => {
  const entries = storage()
  demo.saveDemoSession('admin')
  assert.equal(demo.readDemoSession().role, 'admin')
  assert.equal(demo.readDemoSession().email, 'admin@studyplanner.vn')
  assert.deepEqual([...entries.values()], ['admin'])
  assert.equal(session.readAuthCredentials(), null)
  demo.clearDemoSession()
  assert.equal(demo.readDemoSession(), null)
  assert.equal(entries.size, 0)
})
