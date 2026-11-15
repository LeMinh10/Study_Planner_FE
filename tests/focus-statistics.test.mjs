import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const { focusDistribution, focusGradient } = await server.ssrLoadModule('/src/focus/focus-statistics.ts')
after(() => server.close())
test('empty focus statistics use a neutral ring rather than a fake percentage', () => {
  assert.deepEqual(focusDistribution([]), [])
  assert.equal(focusGradient([]), '#edf0f6')
  assert.equal(focusGradient([{ tongMiliGiay: 0 }]), '#edf0f6')
})
test('distribution preserves every minute when smaller groups are combined', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ maNhiemVu: i + 1, tieuDe: 'Việc ' + (i + 1), soPhien: 1, soPomodoro: 0, tongMiliGiay: (i + 1) * 10 }))
  const distribution = focusDistribution(rows)
  assert.equal(distribution.length, 6)
  assert.equal(distribution[5].maNhiemVu, null)
  assert.equal(distribution[5].tongMiliGiay, 210)
  assert.equal(distribution.reduce((n, row) => n + row.tongMiliGiay, 0), 360)
  assert.equal(rows.length, 8)
})
test('nonempty distribution builds a valid chart from actual durations', () => {
  const value = focusGradient([{ tongMiliGiay: 100 }, { tongMiliGiay: 300 }])
  assert(value.startsWith('conic-gradient('))
  assert(value.includes('25%'))
  assert(!value.includes('NaN'))
})
