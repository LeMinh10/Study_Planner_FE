// Manual check against a running backend. Without admin credentials this only
// checks OpenAPI, validation and anonymous access. With credentials it creates
// one unique test account and deletes that same account in finally.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'

const backend = process.env.API_PROXY_TARGET || 'http://localhost:5059'
const vite = await createServer({
  define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"', 'import.meta.env.VITE_ENABLE_DEMO_AUTH': '"false"' },
  server: { host: '127.0.0.1', port: 0, hmr: false, ws: false, proxy: { '/api': { target: backend, changeOrigin: true } } },
})
const nativeFetch = globalThis.fetch
let admin, accountId, email, request
let created = false
try {
  await vite.listen()
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
  const api = await vite.ssrLoadModule('/src/api/auth.ts')
  const users = await vite.ssrLoadModule('/src/api/admin.ts')
  request = (await vite.ssrLoadModule('/src/api/client.ts')).apiRequest
  const config = await vite.ssrLoadModule('/src/api/config.ts')
  const demo = await vite.ssrLoadModule('/src/auth/demo.ts')
  assert.equal(config.useMockApi, false)
  assert.equal(demo.demoEnabled, false)
  assert.equal(demo.tryDemoLogin('demo@studyplanner.vn', '123456', 'sinhvien'), null)
  const swaggerResponse = await nativeFetch(backend + '/swagger/v1/swagger.json')
  assert.equal(swaggerResponse.status, 200)
  const swagger = await swaggerResponse.json()
  assert(swagger.components.schemas.RegisterRequest.properties.maSoSinhVien)
  assert.equal(swagger.components.schemas.RegisterRequest.properties.matKhau.minLength, 8)
  assert(swagger.paths['/api/v1/users/me/change-password'].post.responses['200'])
  await assert.rejects(request('/users/me'), (error) => error.status === 401)
  await assert.rejects(request('/admin/users'), (error) => error.status === 401)
  const registration = { fullName: 'Kiểm thử đồng bộ frontend', email: 'invalid-test@example.com', studentCode: 'CHECK', schoolName: 'Kiểm thử', className: 'Kiểm thử', major: 'Kiểm thử', password: '1234567' }
  await assert.rejects(api.registerStudent(registration), (error) => error.status === 400)
  console.log('PASS: running backend Swagger, maSoSinhVien, minimum password 8, HTTP 200 password change, JWT guards and FE proxy validation.')

  if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
    console.log('Full account integration skipped: set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to an existing admin account.')
  } else {
    admin = await api.loginAccount(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD, 'admin')
    email = 'frontend-sync-' + Date.now() + '-' + randomUUID().slice(0, 8) + '@example.com'
    const password = randomUUID() + 'Aa1!'
    const changedPassword = randomUUID() + 'Aa2!'
    const input = { ...registration, email, studentCode: 'FE' + Date.now(), password }
    await api.registerStudent(input)
    created = true
    const listed = await users.listUsers(admin.token, { search: email, pageSize: 5 })
    assert.equal(listed.total, 1)
    accountId = listed.items[0].id
    assert.equal(listed.items[0].studentId, input.studentCode)
    const student = await api.loginAccount(email, password, 'sinhvien')
    const detail = await users.getUser(admin.token, accountId)
    assert.equal(detail.email, email)
    assert.equal(detail.role, 'sinhvien')
    const updatedCode = input.studentCode + 'U'
    const saved = await api.updateCurrentUser(student.token, { ...student.user, name: 'Kiểm thử đã cập nhật', studentId: updatedCode, school: '', className: '', major: '' })
    assert.equal(saved.studentId, updatedCode)
    assert.equal(saved.school, '')
    const mssvSession = await api.loginAccount(updatedCode, password, 'sinhvien')
    assert.equal(mssvSession.user.email, email)
    await assert.rejects(users.listUsers(student.token), (error) => error.status === 403)
    await api.changeCurrentPassword(mssvSession.token, { currentPassword: password, newPassword: changedPassword })
    await assert.rejects(api.getCurrentUser(student.token), (error) => error.status === 401)
    await assert.rejects(api.getCurrentUser(mssvSession.token), (error) => error.status === 401)
    await assert.rejects(api.loginAccount(email, password, 'sinhvien'), (error) => error.status === 401)
    const renewed = await api.loginAccount(updatedCode, changedPassword, 'sinhvien')
    await users.setUserActive(admin.token, accountId, false)
    await assert.rejects(api.getCurrentUser(renewed.token), (error) => error.status === 401)
    await assert.rejects(api.loginAccount(email, changedPassword, 'sinhvien'), (error) => error.status === 401)
    const locked = await users.listUsers(admin.token, { search: email, isActive: false })
    assert.equal(locked.items[0].id, accountId)
    await users.setUserActive(admin.token, accountId, true)
    assert.equal((await api.loginAccount(email, changedPassword, 'sinhvien')).user.studentId, updatedCode)
    console.log('PASS: real backend registration, email/MSSV login, profile update, password change, user administration and activate/deactivate through FE adapters and Vite proxy.')
  }
} finally {
  try {
    if (created && admin && email) {
      if (!accountId) {
        const result = await request('/admin/users?' + new URLSearchParams({ TuKhoa: email }), { token: admin.token })
        const match = result.danhSach.find((user) => user.email === email)
        if (match) accountId = String(match.ma)
      }
      if (accountId) {
        const exact = await request('/admin/users/' + accountId, { token: admin.token })
        assert.equal(exact.email, email, 'Cleanup must affect only the unique account created by this check')
        await request('/admin/users/' + accountId, { method: 'DELETE', token: admin.token })
        console.log('Cleaned up the temporary integration account.')
      }
    }
  } finally {
    globalThis.fetch = nativeFetch
    await vite.close()
  }
}
