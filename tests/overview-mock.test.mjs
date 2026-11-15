import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-overview-mock', define: { 'import.meta.env.VITE_USE_MOCK_API': '"true"', 'import.meta.env.VITE_ENABLE_DEMO_AUTH': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(async () => { await server.close(); delete globalThis.localStorage })
test('mock overview enforces admin access and reflects registrations, locks and matching list filters', async () => {
  const entries = new Map()
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) }
  const auth = await server.ssrLoadModule('/src/api/auth.ts')
  const api = await server.ssrLoadModule('/src/api/adminOverview.ts')
  const users = await server.ssrLoadModule('/src/api/admin.ts')
  const admin = await auth.loginAccount('admin@studyplanner.vn', '123456')
  const before = await api.loadAdminOverview(admin.token)
  const input = { fullName: 'Sinh viên tổng quan', email: 'overview@example.test', password: 'Strong123!', studentCode: 'OV0001', schoolName: 'Trường', className: 'Lớp', major: 'CNTT' }
  await auth.registerStudent(input)
  const student = await auth.loginAccount(input.email, input.password)
  await assert.rejects(api.loadAdminOverview(student.token), e => e.status === 403)
  const after = await api.loadAdminOverview(admin.token)
  assert.equal(after.total, before.total + 1); assert.equal(after.open, before.open + 1); assert.equal(after.recentCount, before.recentCount + 1)
  const latest = after.students.find(row => row.email === input.email)
  assert(latest)
  const filtered = await users.listUsers(admin.token, { role: 'sinhvien', createdFrom: after.from, createdTo: after.to })
  assert.equal(filtered.total, after.recentCount)
  assert(filtered.items.every(row => row.role === 'sinhvien'))
  await users.setUserActive(admin.token, String(latest.id), false)
  const changed = await api.loadAdminOverview(admin.token)
  assert.equal(changed.locked, before.locked + 1); assert.equal(changed.open, before.open)
  assert.equal(changed.students.find(row => row.id === latest.id).active, false)
})
