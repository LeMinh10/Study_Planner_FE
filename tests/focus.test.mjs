import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const { focusElapsed, clockText, durationText, isPersonal, focusTimeline } = await server.ssrLoadModule('/src/focus/focus.ts')
after(() => server.close())
const start = Date.parse('2026-11-12T10:00:00Z')
const row = { cheDo: 'Pomodoro', trangThai: 'Running', mucTieuGiay: 1500, soMiliGiayDaHoc: 20000, batDauDoan: new Date(start).toISOString() }
test('countdown uses persisted segments and clamps to the configured target', () => {
  assert.equal(focusElapsed(row, start + 30000), 50000)
  assert.equal(focusElapsed(row, start + 3600000), 1500000)
  assert.equal(focusElapsed(row, start - 20000), 20000)
})
test('pause excludes break time; stopwatch is not capped at the countdown target', () => {
  assert.equal(focusElapsed({ ...row, trangThai: 'Paused', batDauDoan: null }, start + 3600000), 20000)
  assert.equal(focusElapsed({ ...row, cheDo: 'Stopwatch' }, start + 3600000), 3620000)
})
test('timer and duration labels handle seconds, hours and zero', () => {
  assert.equal(clockText(1500), '25:00'); assert.equal(clockText(-2), '00:00'); assert.equal(clockText(3661), '1:01:01')
  assert.equal(durationText(0), '0 giây'); assert.equal(durationText(30000), '30 giây'); assert.equal(durationText(4500000), '1 giờ 15 phút')
})
test('academic and personal selection depends on scope, not the task type', () => {
  assert(isPersonal({ maHocKy: null, maMonHoc: null }))
  assert(!isPersonal({ maHocKy: 1, maMonHoc: null }))
  assert(!isPersonal({ maHocKy: 1, maMonHoc: 3 }))
})
test('timeline clips overnight sessions to the account day and includes the running group once', () => {
  const now = Date.parse('2026-11-12T03:00:00Z')
  const current = { ma: 1, batDau: '2026-11-11T16:30:00Z', ketThuc: null }
  const previous = { ma: 2, batDau: '2026-11-10T15:00:00Z', ketThuc: '2026-11-10T16:00:00Z' }
  const timeline = focusTimeline([current, previous], current, now, 'Asia/Ho_Chi_Minh')
  assert.equal(timeline.blocks.length, 1)
  assert.equal(timeline.blocks[0].start, 0)
  assert.equal(timeline.blocks[0].end, 10)
  assert(timeline.first >= 0 && timeline.last <= 24)
})
test('timeline has a readable window for a new session near midnight', () => {
  const now = Date.parse('2026-11-12T16:59:00Z')
  const timeline = focusTimeline([], { ma: 1, batDau: new Date(now).toISOString(), ketThuc: null }, now, 'Asia/Ho_Chi_Minh')
  assert.equal(timeline.last, 24)
  assert(timeline.last - timeline.first >= 4)
})
test('timeline measures real elapsed hours across the repeated DST hour', () => {
  const current = { ma: 1, batDau: '2026-11-01T05:30:00Z', ketThuc: '2026-11-01T06:30:00Z' }
  const timeline = focusTimeline([], current, Date.parse('2026-11-01T07:00:00Z'), 'America/New_York')
  assert.equal(timeline.blocks[0].end - timeline.blocks[0].start, 1)
  assert.equal(timeline.currentHour, 3)
})
