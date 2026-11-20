import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const { validateSemester, normalizeSemesterName } = await server.ssrLoadModule('/src/utils/semesterValidation.ts')
after(() => server.close())
const fields = { name: 'Học kỳ I · 2026–2027', startDate: '01/09/2026', endDate: '31/01/2027' }
const check = (changes = {}, semesters = [], id = '') => validateSemester({ ...fields, ...changes }, semesters, id)

test('semester name accepts Vietnamese and meaningful punctuation and rejects invalid characters', () => {
  assert.deepEqual(check(), {})
  for (const name of ['Học kỳ hè (2026)', 'HK 1/2026', 'Học kỳ I — 2026', 'HK: 2026-2027']) assert.deepEqual(check({ name }), {})
  for (const name of ['', ' ', 'A', '123', '<script>', 'HK @@@', 'HK 😀', 'HK\nA', 'HK\u200bA', 'A'.repeat(201)]) assert(check({ name }).name, name)
})
test('duplicates compare normalized names, exempt self and allow overlapping dates with different names', () => {
  const existing = { id: '1', ...fields }
  assert(check({ name: '  học   KỲ I · 2026–2027 '.normalize('NFD') }, [existing]).name)
  assert.deepEqual(check({}, [existing], '1'), {})
  assert.deepEqual(check({ name: 'Học kỳ khác' }, [existing]), {})
  assert.equal(normalizeSemesterName('  Học   kỳ '.normalize('NFD')), 'Học kỳ')
})
test('both dates required, real calendar dates only, end on or after start', () => {
  assert(check({ startDate: '' }).startDate)
  assert(check({ endDate: '' }).endDate)
  for (const startDate of ['31/02/2026', '29/02/2025', '2026-09-01', '01/13/2026', '01/01/0000', '1/']) assert(check({ startDate }).startDate, startDate)
  assert.deepEqual(check({ startDate: '29/02/2024', endDate: '29/02/2024' }), {})
  assert(check({ endDate: '31/08/2026' }).endDate)
  assert.deepEqual(check({ endDate: '01/09/2026' }), {})
})
