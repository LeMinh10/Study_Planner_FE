import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-semester-selection-tests', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const selection = await server.ssrLoadModule('/src/data/semesterSelection.ts')
const original = globalThis.sessionStorage
after(() => server.close())
afterEach(() => { if (original === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = original })

function storage() {
  const records = new Map()
  globalThis.sessionStorage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
  return records
}
test('semester preference survives a fresh module instance and belongs to the account', async () => {
  const records = storage()
  selection.saveSelectedSemester('student@example.com', '6')
  const restored = await server.ssrLoadModule('/src/data/semesterSelection.ts?reload=1')
  assert.equal(restored.readSelectedSemester('student@example.com', ['5', '6']), '6')
  assert.equal(restored.readSelectedSemester('different@example.com', ['5', '6']), undefined)
  assert.equal(restored.readSelectedSemester(' STUDENT@example.com ', ['5', '6']), '6')
  assert.deepEqual([...records.values()], ['6'], 'Only the selection ID is stored, never academic data')
})
test('removed or unavailable semesters are never restored', () => {
  storage()
  selection.saveSelectedSemester('student@example.com', '6')
  assert.equal(selection.readSelectedSemester('student@example.com', ['5']), undefined)
  assert.equal(selection.readSelectedSemester('student@example.com', []), undefined)
  selection.saveSelectedSemester('student@example.com', '5')
  assert.equal(selection.readSelectedSemester('student@example.com', ['5']), '5')
})
test('missing account, missing preference and blocked storage do not prevent startup or selection', () => {
  const records = storage()
  assert.equal(selection.readSelectedSemester('student@example.com', ['5', '6']), undefined)
  selection.saveSelectedSemester('', '6'); selection.saveSelectedSemester('student@example.com', '')
  assert.equal(records.size, 0)
  globalThis.sessionStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(selection.readSelectedSemester('student@example.com', ['5', '6']), undefined)
  assert.doesNotThrow(() => selection.saveSelectedSemester('student@example.com', '6'))
  delete globalThis.sessionStorage
  assert.equal(selection.readSelectedSemester('student@example.com', ['5', '6']), undefined)
})
