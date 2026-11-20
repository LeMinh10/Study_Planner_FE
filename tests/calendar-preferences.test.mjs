import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const { readCalendarPreferences, calendarPreferencesKey, calendarLayers } = await server.ssrLoadModule('/src/hoc-tap/calendarPreferences.ts')
after(() => server.close())
const storage = value => ({ getItem: () => value })
test('calendar defaults are available without browser storage or an authenticated owner', () => {
  assert.deepEqual(readCalendarPreferences(null, 'student'), { mode: 'week', layers: calendarLayers, compactDeadlines: false, showCompleted: true })
  assert.equal(readCalendarPreferences(storage('{"version":1,"mode":"month"}'), '').mode, 'week')
})
test('calendar preferences retain real choices including hiding every layer', () => {
  assert.deepEqual(readCalendarPreferences(storage(JSON.stringify({ version: 1, mode: 'month', layers: [], compactDeadlines: true, showCompleted: false })), 'student'), { mode: 'month', layers: [], compactDeadlines: true, showCompleted: false })
})
test('malformed or unsupported calendar settings cannot create invalid views', () => {
  for (const value of ['broken', 'null', '{}', '{"version":2,"mode":"month"}']) assert.equal(readCalendarPreferences(storage(value), 'student').mode, 'week')
  const invalid = readCalendarPreferences(storage('{"version":1,"mode":"year","layers":["unknown"],"showCompleted":"false"}'), 'student')
  assert.equal(invalid.mode, 'week'); assert.deepEqual(invalid.layers, calendarLayers); assert.equal(invalid.showCompleted, true)
})
test('calendar preferences are read from the current account only', () => {
  const entries = new Map([[calendarPreferencesKey('A'), JSON.stringify({ version: 1, mode: 'day', layers: ['HanNhiemVu'] })]])
  const source = { getItem: key => entries.get(key) ?? null }
  assert.equal(readCalendarPreferences(source, 'A').mode, 'day')
  assert.equal(readCalendarPreferences(source, 'B').mode, 'week')
  assert.notEqual(calendarPreferencesKey('A'), calendarPreferencesKey('B'))
})
