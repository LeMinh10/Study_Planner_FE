import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const servers = []
after(async () => { for (const server of servers) await server.close(); delete globalThis.localStorage; delete globalThis.sessionStorage })
async function modules(index) {
  const server = await createServer({ cacheDir: 'node_modules/.vite-priority-mock-' + index, define: { 'import.meta.env.VITE_USE_MOCK_API': '"true"', 'import.meta.env.VITE_ENABLE_DEMO_AUTH': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  servers.push(server)
  return { auth: await server.ssrLoadModule('/src/api/auth.ts'), api: await server.ssrLoadModule('/src/api/priorityRules.ts') }
}
test('mock priority endpoints enforce roles and keep the active config across a fresh module instance', async () => {
  const entries = new Map()
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) }
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const { auth, api } = await modules(1)
  const admin = await auth.loginAccount('admin@studyplanner.vn', '123456')
  const student = await auth.loginAccount('demo@studyplanner.vn', '123456')
  assert.equal((await api.loadActivePriorityRule(student.token)).phienBan, 0)
  const config = { phienBanSchema: 1, tieuChi: ['Importance', 'Deadline'] }
  await assert.rejects(api.listPriorityRules(student.token), e => e.status === 403)
  await assert.rejects(api.createPriorityRule(student.token, 'Forbidden', config), e => e.status === 403)
  const created = await api.createPriorityRule(admin.token, 'Theo mức quan trọng', config)
  await assert.rejects(api.activatePriorityRule(student.token, created.ma, 0), e => e.status === 403)
  await api.activatePriorityRule(admin.token, created.ma, 0)
  const fresh = await modules(2)
  const active = await fresh.api.loadActivePriorityRule(student.token)
  assert.equal(active.ma, created.ma)
  assert.deepEqual(active.cauHinh, config)
  await assert.rejects(fresh.api.deletePriorityRule(student.token, active.ma), e => e.status === 403)
  await assert.rejects(fresh.api.deletePriorityRule(admin.token, active.ma), e => e.status === 409)
})
