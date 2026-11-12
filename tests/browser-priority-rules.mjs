import assert from 'node:assert/strict'
import fs from 'node:fs'

export function createPriorityFixture(handler) {
  const state = { priorityRules: [], nextPriorityVersion: 1, failRead: false, failWrite: false }
  return { state, async handle(url, method, body) {
    if (url.pathname !== '/api/v1/priority-rules/active' && !url.pathname.startsWith('/api/v1/admin/priority-rules')) return null
    if (method === 'GET' ? state.failRead : state.failWrite) return { status: 503, response: { detail: 'Quy tắc tạm gián đoạn.' } }
    const local = new URL(url); local.pathname = local.pathname.replace('/api/v1', '')
    const response = handler(state, local, method, body ?? {})
    return { status: response.status, ...(response.status === 204 ? {} : { response: await response.json() }) }
  } }
}

export async function runPriorityChecks({ go, input, click, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const Original = Date; const fixed = Original.parse('2026-11-10T03:00:00Z'); globalThis.Date = class extends Original { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }; })()` })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false })
  const config = { phienBanSchema: 1, tieuChi: ['Deadline', 'Importance', 'InProgress'] }
  fixture.state.priorityRules = Array.from({ length: 22 }, (_, index) => ({ ma: index + 1, ten: 'Quy tắc ' + (index + 1), phienBan: index + 1, dangSuDung: false, cauHinh: structuredClone(config), ngayTao: '2026-11-10T00:00:00Z' }))
  fixture.state.nextPriorityVersion = 23
  const editorReady = '!!document.querySelector(".priority-editor fieldset") && !document.querySelector(".priority-editor fieldset").disabled'
  await go('/admin/priority-rules'); await waitFor('location.pathname === "/login"')
  await login('admin@example.com'); await waitFor('location.pathname === "/admin/overview"')
  await click('a[href="/admin/priority-rules"]'); await waitFor(editorReady)
  assert(!await evaluate('!!document.querySelector(".priority-preview, .priority-note")'))
  await click('.priority-history nav button:last-child')
  await waitFor('document.querySelectorAll("[data-rule-id]").length === 2 && !document.querySelector(".priority-editor fieldset").disabled')
  await click('.priority-history nav button:first-child'); await waitFor(editorReady)
  const criterionOrder = () => evaluate('[...document.querySelectorAll("[data-criterion]")].map(row => row.dataset.criterion)')
  const press = async (key, code) => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code })
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code })
  }
  await evaluate(`document.querySelector('[data-criterion="Deadline"] .criterion-drag').focus()`)
  await press(' ', 'Space'); await press('ArrowDown', 'ArrowDown')
  assert.deepEqual(await criterionOrder(), ['Importance', 'Deadline', 'InProgress'])
  await press('Escape', 'Escape')
  assert.deepEqual(await criterionOrder(), ['Deadline', 'Importance', 'InProgress'], 'Keyboard cancellation restores the original order')
  await click('[data-criterion="Importance"] .criterion-move-up')
  assert.deepEqual(await criterionOrder(), ['Importance', 'Deadline', 'InProgress'])
  await click('[data-criterion="Importance"] .criterion-move-down')
  const drag = await evaluate(`(() => {
    const handle = document.querySelector('[data-criterion="Importance"] .criterion-drag').getBoundingClientRect()
    const target = document.querySelector('[data-criterion="Deadline"]').getBoundingClientRect()
    return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, targetY: target.y + target.height / 2 }
  })()`)
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: drag.x, y: drag.y })
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: drag.x, y: drag.y, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: drag.x, y: drag.targetY, buttons: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: drag.x, y: drag.targetY, button: 'left', clickCount: 1 })
  await waitFor(`document.querySelector('[data-criterion]')?.dataset.criterion === 'Importance'`)
  assert.deepEqual(await criterionOrder(), ['Importance', 'Deadline', 'InProgress'], 'Pointer dragging changes the same saved order as the arrow buttons')
  await click('[data-criterion="InProgress"] input')
  assert(await evaluate('!!document.querySelector("[data-criterion=Deadline] .criterion-required") && !document.querySelector("[data-criterion=Deadline] input")'))
  assert.equal(await evaluate('document.querySelector("[data-criterion=InProgress] input").getAttribute("role")'), 'switch')
  await input('ruleName', 'Ưu tiên quan trọng trước')
  fixture.state.failWrite = true
  await click('.priority-editor button[type=submit]')
  await waitFor('!!document.querySelector(".priority-error") && !document.querySelector(".priority-editor fieldset").disabled')
  assert.equal(await evaluate('document.querySelector("input[name=ruleName]").value'), 'Ưu tiên quan trọng trước')
  assert.equal(fixture.state.priorityRules.length, 22)
  fixture.state.failWrite = false
  await click('.priority-editor button[type=submit]')
  await waitFor(`!!document.querySelector('[data-rule-id="23"]') && !document.querySelector('.priority-editor fieldset').disabled`)
  assert.equal(fixture.state.priorityRules.filter(x => x.dangSuDung).length, 0, 'Saving never activates automatically')
  await click('[data-rule-id="23"] .rule-activate')
  await waitFor('!!document.querySelector("dialog[open]")')
  await click('dialog .button-secondary')
  assert.equal(fixture.state.priorityRules.filter(x => x.dangSuDung).length, 0)
  await click('[data-rule-id="23"] .rule-activate'); await click('.priority-confirm-submit')
  await waitFor('document.querySelector(".priority-active h2")?.textContent === "Ưu tiên quan trọng trước" && !document.querySelector(".priority-editor fieldset").disabled')
  assert.equal(await evaluate(`document.querySelector('[data-rule-id="23"] .rule-delete').disabled`), true)
  await go('/admin/priority-rules'); await waitFor(editorReady)
  assert.equal(await evaluate('document.querySelector(".priority-active h2").textContent'), 'Ưu tiên quan trọng trước', 'Active survives F5')
  await click('[data-rule-id="23"] .rule-edit')
  assert.equal(await evaluate('document.querySelector("input[name=ruleName]").value'), 'Ưu tiên quan trọng trước')
  await input('ruleName', 'Bản sửa chưa áp dụng')
  await click('.priority-editor button[type=submit]')
  await waitFor(`!!document.querySelector('[data-rule-id="24"]') && !document.querySelector('.priority-editor fieldset').disabled`)
  assert.equal(fixture.state.priorityRules.find(x => x.dangSuDung).ma, 23)
  await click('[data-rule-id="24"] .rule-delete'); await click('.priority-confirm-submit')
  await waitFor(`!document.querySelector('[data-rule-id="24"]') && !document.querySelector('.priority-editor fieldset').disabled`)
  await click('[data-rule-id="22"] .rule-activate')
  fixture.state.priorityRules.forEach(x => { x.dangSuDung = false })
  fixture.state.priorityRules.push({ ma: 25, ten: 'Thay đổi từ admin khác', phienBan: 25, dangSuDung: true, cauHinh: config, ngayTao: '2026-11-10T01:00:00Z' })
  fixture.state.nextPriorityVersion = 26
  await click('.priority-confirm-submit')
  await waitFor('document.querySelector(".priority-error")?.textContent.includes("đã thay đổi") && !document.querySelector("dialog[open]")')
  assert.equal(fixture.state.priorityRules.find(x => x.dangSuDung).ma, 25)
  await click('.priority-page-heading button'); await waitFor('document.querySelector(".priority-active h2")?.textContent === "Thay đổi từ admin khác" && !document.querySelector(".priority-editor fieldset").disabled')
  await click('[data-rule-id="23"] .rule-activate'); await click('.priority-confirm-submit')
  await waitFor('document.querySelector(".priority-active h2")?.textContent === "Ưu tiên quan trọng trước" && !document.querySelector(".priority-editor fieldset").disabled')
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/admin-priority-rules.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false })
  assert(await evaluate('document.querySelector(".priority-editor-grid").getBoundingClientRect().width > 0'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false })
  await click('.admin-logout'); await waitFor('location.pathname === "/login"')
  await login(); await waitFor('location.pathname === "/today"')
  await waitFor('document.querySelectorAll(".today-priority-list > li").length === 5 && !document.querySelector(".today-reload").disabled')
  const expected = ['Nộp bài CSDL còn quá hạn', 'Gửi hồ sơ học bổng', 'Nộp báo cáo đồ án', 'Làm bài tập React', 'Hoàn thiện giao diện đăng nhập']
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".today-priority-list .today-task-title")].map(x => x.textContent)'), expected, 'Admin config must change the real Today ranking')
  const taskReads = calls.filter(x => x.route === '/api/v1/tasks').length
  fixture.state.priorityRules.forEach(x => { x.dangSuDung = x.ma === 25 })
  await evaluate('window.dispatchEvent(new Event("focus"))')
  await waitFor('document.querySelectorAll(".today-priority-list .today-task-title")[1]?.textContent === "Hoàn tất bước kiểm thử"')
  fixture.state.priorityRules.forEach(x => { x.dangSuDung = x.ma === 23 })
  await evaluate('window.dispatchEvent(new Event("focus"))')
  await waitFor('document.querySelectorAll(".today-priority-list .today-task-title")[1]?.textContent === "Gửi hồ sơ học bổng"')
  assert.equal(calls.filter(x => x.route === '/api/v1/tasks').length, taskReads, 'Refreshing config on focus does not refetch task pages unnecessarily')
  await go('/admin/priority-rules'); await waitFor('location.pathname === "/today"')
  fixture.state.failRead = true
  await go('/today'); await waitFor('!!document.querySelector(".today-priorities .today-error")')
  await waitFor('!!document.querySelector(".today-class-hours")')
  assert(!await evaluate('!!document.querySelector(".today-priority-list")'), 'A failed config read must not silently show a default ranking')
  fixture.state.failRead = false
  await click('.today-priorities .today-error button')
  await waitFor('document.querySelectorAll(".today-priority-list > li").length === 5 && !document.querySelector(".today-reload").disabled')
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".today-priority-list .today-task-title")].map(x => x.textContent)'), expected)
  assert.deepEqual(calls.filter(x => /^\/api\/v1\/(tasks|calendar|planning|class-sessions)/.test(x.route) && x.method !== 'GET'), [])
  assert.deepEqual(errors, [])
  console.log('PASS: priority drag handles, keyboard reordering/cancel, arrow controls, switches, draft save, activation, F5, safe deletion, conflicts and actual Today ranking; no task/calendar writes.')
}
