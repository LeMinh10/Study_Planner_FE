import assert from 'node:assert/strict'
import fs from 'node:fs'
import { personalAndSemesterTasks, statisticsTasks, tasksWithCompletedHistory } from './fixtures/statisticsTasks.mjs'

export function createStatisticsFixture() {
  const state = { fail: false, empty: false, delay: 150, tasks: structuredClone(statisticsTasks) }
  return { state, async handle(url, method) {
    if (url.pathname !== '/api/v1/tasks' || url.searchParams.get('chiLa') === 'true') return null
    assert.equal(method, 'GET', 'Statistics must never mutate the task workspace')
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
    if (state.fail) return { status: 503, response: { title: 'Nhiệm vụ tạm gián đoạn.' } }
    const q = url.searchParams
    assert.notEqual(q.get('chiLa'), 'true', 'Statistics and task list must both request root tasks')
    assert.equal(q.get('cheDo'), 'all', 'Include completed tasks from the whole semester')
    const rows = state.empty ? [] : state.tasks.filter(task => (!q.get('maHocKy') || String(task.maHocKy) === q.get('maHocKy')) && task.maNhiemVuCha === null &&
      (!q.get('maMonHoc') || String(task.maMonHoc) === q.get('maMonHoc')) && (q.get('trangThai') ? task.trangThai === q.get('trangThai') : task.trangThai !== 'Completed'))
    const page = Number(q.get('trang'))
    const size = Number(q.get('kichThuocTrang')) === 20 ? 20 : 2
    return { status: 200, response: { phienBan: 8, duLieu: { danhSach: rows.slice((page - 1) * size, page * size).map(task => ({
      ...task, tieuDe: 'Nhiệm vụ ' + task.ma, moTa: null, loai: 'Assignment', mucDoUuTien: 'Medium', tienDo: task.trangThai === 'Completed' ? 100 : task.trangThai === 'InProgress' ? 50 : 0,
      hanHoanThanh: task.hanHieuLuc, maNhiemVuNguonHan: task.hanHieuLuc ? task.ma : null, batDauSuKien: null, ketThucSuKien: null, thoiLuongDuKienPhut: 60, thoiLuongConLaiPhut: 60, nhacTruocGio: null,
    })), trang: page, kichThuocTrang: size, tongSo: rows.length } } }
  } }
}

export async function runStatisticsChecks({ go, click, select, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const Original = Date; const fixed = Original.parse('2026-11-12T03:00:00Z'); globalThis.Date = class extends Original { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }; })()` })
  await cdp('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  const value = key => `document.querySelector('[data-stat="${key}"]')?.textContent`
  const ready = total => `${value('total')} === '${total}' && !document.querySelector('.statistics-loading, .statistics-updating')`
  await go('/login'); await login(); await waitFor('location.pathname === "/today"')
  await go('/statistics'); await waitFor(ready(11))
  assert.deepEqual(await evaluate(`['completed', 'inProgress', 'overdue', 'onTime', 'late', 'onTimeRate'].map(key => document.querySelector('[data-stat="'+key+'"]').textContent)`), ['5', '3', '3', '2', '1', '67%'])
  assert.equal(await evaluate('document.querySelectorAll(".statistics-subjects tbody tr").length'), 4)
  assert.equal(await evaluate(`document.querySelector('tr[data-subject="101"] td:nth-child(3)').textContent`), '2/5')
  assert(!await evaluate('!!document.querySelector(".statistics-page canvas, .statistics-page .status-chart, .statistics-page .kind-stats")'))
  assert(calls.some(call => call.route === '/api/v1/tasks' && call.query.includes('trangThai=Completed') && call.query.includes('trang=3')))
  await select('select[name=statistics-subject]', '101'); await waitFor(ready(5))
  assert.equal(await evaluate(value('completed')), '2')
  assert.equal(await evaluate(value('onTimeRate')), '100%')
  assert.equal(await evaluate('new URL(document.querySelector(".statistics-task-link").href).searchParams.get("subject")'), '101')
  await click('.statistics-clear'); await waitFor(ready(11))
  await click('.statistics-task-link')
  await waitFor('location.pathname === "/tasks" && document.querySelector(".ht-list-caption span")?.textContent === "6 nhiệm vụ"')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("semester")'), '11')
  assert.equal(await evaluate('document.querySelectorAll(".ht-task-list > .ht-task-branch").length'), 6)
  await click('.sidebar a[href="/statistics"]'); await waitFor(ready(11))
  const root = '.backend-integration/screenshots'
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(root + '/statistics-desktop.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await select('.flow-active-semester select', '12'); await waitFor(ready(1))
  assert.equal(await evaluate(value('completed')), '0')
  assert.equal(await evaluate('document.querySelector("select[name=statistics-subject]").value'), 'all')
  await go('/statistics'); await waitFor(ready(1))
  assert.equal(await evaluate('document.querySelector(".flow-active-semester select").value'), '12')
  await select('.flow-active-semester select', '11'); await waitFor(ready(11))

  await click('.sidebar a[href="/profile"]'); await waitFor('location.pathname === "/profile"')
  fixture.state.fail = true
  await click('.sidebar a[href="/statistics"]')
  await waitFor('!!document.querySelector(".statistics-feedback") && document.body.innerText.includes("lần tải trước")')
  assert.equal(await evaluate(value('total')), '11', 'A failed refresh must not replace prior totals with zeros')
  fixture.state.fail = false
  await click('.statistics-feedback button'); await waitFor(ready(11))

  fixture.state.empty = true
  await go('/statistics'); await waitFor(ready(0))
  assert.equal(await evaluate(value('onTimeRate')), '—')
  assert(await evaluate('!!document.querySelector(".statistics-empty")'))
  fixture.state.fail = true
  await go('/statistics')
  await waitFor('!!document.querySelector(".statistics-feedback") && !document.querySelector(".statistics-loading")')
  assert(!await evaluate('!!document.querySelector(".statistics-metrics")'), 'Initial load errors must not pretend there are zero tasks')
  fixture.state.fail = false; fixture.state.empty = false
  await click('.statistics-feedback button'); await waitFor(ready(11))

  fixture.state.tasks = structuredClone(personalAndSemesterTasks)
  await go('/tasks')
  await waitFor('document.querySelector(".ht-list-caption span")?.textContent === "6 nhiệm vụ"')
  await waitFor('[...document.querySelectorAll(".ht-task-row .ht-task-name small")].filter(element => element.textContent === "Việc cá nhân").length === 5')
  assert.equal(await evaluate('[...document.querySelectorAll(".ht-task-row .ht-task-name small")].filter(element => element.textContent === "Việc cá nhân").length'), 5)
  await click('.sidebar a[href="/statistics"]'); await waitFor(ready(0))
  assert.equal(await evaluate('document.querySelector(".flow-active-semester select").value'), '11')
  await select('.flow-active-semester select', '12')
  await go('/statistics'); await waitFor(ready(1))
  assert.equal(await evaluate(value('completed')), '0', 'Completing one child does not complete the whole main task')
  await click('.statistics-task-link')
  await waitFor('document.querySelector(".ht-list-caption span")?.textContent === "1 nhiệm vụ"')
  await click('.sidebar a[href="/statistics"]'); await waitFor(ready(1))

  fixture.state.tasks = structuredClone(tasksWithCompletedHistory)
  await go('/statistics'); await waitFor(ready(2))
  assert.equal(await evaluate(value('pending')), '1')
  assert.equal(await evaluate(value('completed')), '1')
  await click('.statistics-completed-link')
  await waitFor('location.pathname === "/tasks" && document.querySelector(".ht-list-caption span")?.textContent === "1 nhiệm vụ"')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("status")'), 'Completed')
  assert.equal(await evaluate('document.querySelectorAll(".ht-task-completed").length'), 1)
  await click('.sidebar a[href="/statistics"]'); await waitFor(ready(2))
  await select('.flow-active-semester select', '11'); await go('/statistics'); await waitFor(ready(4))
  assert.equal(await evaluate(value('pending')), '0')
  assert.equal(await evaluate(value('completed')), '4')
  await click('.statistics-completed-link')
  await waitFor('document.querySelector(".ht-list-caption span")?.textContent === "4 nhiệm vụ"')
  assert.equal(await evaluate('document.querySelectorAll(".ht-task-completed").length'), 4)
  await click('.sidebar a[href="/statistics"]'); await waitFor(ready(4))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 800, height: 1100, deviceScaleFactor: 1, mobile: false })
  assert(await evaluate('document.querySelector(".statistics-page").getBoundingClientRect().width > 0'))
  assert(calls.filter(call => call.route === '/api/v1/tasks' && call.query.includes('maHocKy=')).every(call => call.method === 'GET'))
  assert.deepEqual(errors, [])
  console.log('PASS: six unfinished main tasks including five personal and one semester task; empty semester history gives zero/one, adding four/one completed roots gives four/two; completed-task links match the actual task-list UI; pagination, timeliness, cache refresh failures, retry and empty states; no task mutations.')
}
