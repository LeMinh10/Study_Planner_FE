import assert from 'node:assert/strict'
import fs from 'node:fs'

export function createTodayFixture() {
  const task = (ma, tieuDe, due, more = {}) => ({ ma, tieuDe, maHocKy: 11, maMonHoc: 101, maNhiemVuCha: null, moTa: 'Nội dung cần hoàn thành và ghi chú môn học.', loai: 'Assignment', mucDoUuTien: 'Medium', trangThai: 'NotStarted', tienDo: 0,
    hanHoanThanh: due, hanHieuLuc: due, maNhiemVuNguonHan: due ? ma : null, batDauSuKien: null, ketThucSuKien: null, thoiLuongDuKienPhut: 90, thoiLuongConLaiPhut: 90, coNhiemVuCon: false, nhacTruocGio: null, ...more })
  const event = (ma, loai, start, end, more = {}) => ({ ma, loai, maNguon: 10, maMonHoc: 101, maHocKy: 11, tieuDe: 'Lập trình ứng dụng web · A.203', batDau: start, ketThuc: end, mauSac: '#53A88C', trangThai: null, ...more })
  const state = { delay: 200, tasksFail: false, calendarFail: false, version: 7,
    tasks: [task(1, 'Nộp bài CSDL còn quá hạn', '2026-11-09T22:00:00+07:00', { mucDoUuTien: 'Low' }),
      task(2, 'Hoàn thiện giao diện đăng nhập', '2026-11-10T12:00:00+07:00'),
      task(3, 'Nộp báo cáo đồ án', '2026-11-10T15:00:00+07:00', { mucDoUuTien: 'High', trangThai: 'InProgress', tienDo: 40 }),
      task(4, 'Làm bài tập React', '2026-11-10T18:00:00+07:00', { mucDoUuTien: 'High' }),
      task(5, 'Ôn tập kiểm tra tiếng Anh', '2026-11-11T09:00:00+07:00', { loai: 'Revision' }),
      task(6, 'Đọc tài liệu bổ sung', null, { mucDoUuTien: 'High' }),
      task(7, 'Bài đã hoàn thành', '2026-11-10T23:59:00+07:00', { trangThai: 'Completed', tienDo: 100 }),
      task(8, 'Nhiệm vụ cha không được xếp trùng', '2026-11-10T11:00:00+07:00', { coNhiemVuCon: true }),
      task(9, 'Hoàn tất bước kiểm thử', '2026-11-10T11:00:00+07:00', { maNhiemVuCha: 8, maNhiemVuNguonHan: 8, hanHoanThanh: null, mucDoUuTien: 'Low' }),
      task(10, 'Việc của học kỳ II', '2026-11-10T10:30:00+07:00', { maHocKy: 12, maMonHoc: null }),
      task(11, 'Gửi hồ sơ học bổng', '2026-11-10T12:00:00+07:00', { maHocKy: null, maMonHoc: null, loai: 'Personal', mucDoUuTien: 'High' })],
    events: [event('class-1', 'LichHoc', '2026-11-10T11:00:00+07:00', '2026-11-10T12:30:00+07:00'),
      event('session-1', 'PhienTuHoc', '2026-11-10T14:00:00+07:00', '2026-11-10T15:00:00+07:00', { tieuDe: 'Tự học React', trangThai: 'Planned' }),
      event('overnight', 'SuKien', '2026-11-09T23:30:00+07:00', '2026-11-10T00:30:00+07:00', { tieuDe: 'Sự kiện qua nửa đêm' }),
      event('deadline-1', 'HanNhiemVu', '2026-11-10T23:59:00+07:00', null),
      event('free-1', 'GioRanh', '2026-11-10T16:00:00+07:00', '2026-11-10T17:00:00+07:00'),
      event('cancelled', 'PhienTuHoc', '2026-11-10T19:00:00+07:00', '2026-11-10T20:00:00+07:00', { trangThai: 'Cancelled' }),
      event('class-other', 'LichHoc', '2026-11-10T10:30:00+07:00', '2026-11-10T12:00:00+07:00', { maHocKy: 12, maMonHoc: null, tieuDe: 'Lớp của học kỳ II' })],
  }
  return { state, async handle(url, method) {
    if (!['/api/v1/tasks', '/api/v1/calendar'].includes(url.pathname)) return null
    assert.equal(method, 'GET', 'Today must not mutate the shared task workspace')
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay))
    if (url.pathname.endsWith('/calendar')) return state.calendarFail ? { status: 503, response: { detail: 'Lịch học tạm gián đoạn.' } } : { status: 200, response: { phienBan: state.version, duLieu: { muiGio: 'Asia/Ho_Chi_Minh', suKien: state.events } } }
    if (state.tasksFail) return { status: 503, response: { detail: 'Nhiệm vụ tạm gián đoạn.' } }
    const q = url.searchParams
    let rows = state.tasks.filter((task) => q.get('chiLa') === 'true' ? !task.coNhiemVuCon : !task.maNhiemVuCha)
    if (q.get('trangThai')) rows = rows.filter((task) => task.trangThai === q.get('trangThai'))
    else rows = rows.filter((task) => task.trangThai !== 'Completed')
    if (q.get('cheDo') === 'today') rows = rows.filter((task) => task.hanHieuLuc?.startsWith('2026-11-10'))
    const page = Number(q.get('trang') ?? 1)
    return { status: 200, response: { phienBan: state.version, duLieu: { danhSach: rows.slice((page - 1) * 2, page * 2), trang: page, kichThuocTrang: 2, tongSo: rows.length } } }
  } }
}

export async function runTodayChecks({ go, click, select, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const Original = Date; const fixed = Original.parse('2026-11-10T03:00:00Z'); globalThis.Date = class extends Original { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }; })()` })
  await cdp('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  const has = (text) => 'document.body.innerText.includes(' + JSON.stringify(text) + ')'
  const ready = 'document.querySelectorAll(".today-priority-list > li").length === 5 && !!document.querySelector(".today-class-hours") && !document.querySelector(".today-reload").disabled'
  await go('/login'); await login(); await waitFor('location.pathname === "/today"')
  await waitFor('!!document.querySelector(".today-skeleton")')
  assert.equal(await evaluate('document.querySelector(".today-metrics strong").textContent'), '—')
  await waitFor(ready)
  fixture.state.delay = 0
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".today-priority-list .today-task-title")].map(x=>x.textContent)'), ['Nộp bài CSDL còn quá hạn', 'Hoàn tất bước kiểm thử', 'Gửi hồ sơ học bổng', 'Hoàn thiện giao diện đăng nhập', 'Nộp báo cáo đồ án'])
  assert.equal(await evaluate('document.querySelector(".today-progress").innerText.includes("1/6")'), true)
  assert.equal(await evaluate('document.querySelectorAll(".today-agenda-list > li").length'), 3)
  assert.equal(await evaluate('document.querySelector(".today-class-hours strong").textContent'), '11:00')
  assert(!await evaluate(has('Nhiệm vụ cha không được xếp trùng')))
  assert(!await evaluate(has('Việc của học kỳ II')))
  assert(calls.some((call) => call.route === '/api/v1/tasks' && call.query.includes('trang=2')))
  assert(!await evaluate('!!document.querySelector(".today-reason, .today-policy, .today-context, .today-short-reason")'))
  await click('.today-priorities > .today-show-more')
  await waitFor('document.querySelectorAll(".today-priority-list > li").length === 8')
  await click('.today-priorities > .today-show-more')
  await click('.today-task-tabs button:nth-child(2)')
  assert.equal(await evaluate('document.querySelectorAll(".today-daily-list article").length'), 1)
  await click('.today-task-tabs button:nth-child(3)')
  assert(await evaluate('document.querySelector(".today-daily-list").innerText.includes("Bài đã hoàn thành")'))
  await click('.today-priority-list .today-task-title')
  await waitFor('!!document.querySelector(".today-page dialog[open]")')
  assert(!await evaluate(has('Vì sao được ưu tiên?')))
  assert.equal(await evaluate('new URL(document.querySelector(".today-detail > a").href).searchParams.get("task")'), '1')
  await click('dialog button[aria-label="Đóng hộp thoại"]')

  await select('.flow-active-semester select', '12')
  await waitFor(has('Việc của học kỳ II'))
  assert(await evaluate(has('Gửi hồ sơ học bổng')))
  assert(!await evaluate(has('Nộp bài CSDL còn quá hạn')))
  assert.equal(await evaluate('document.querySelector(".today-next-class h2").textContent'), 'Lớp của học kỳ II')
  await go('/today')
  await waitFor('document.querySelector(".flow-active-semester select")?.value === "12" && document.querySelector(".today-next-class h2")?.textContent === "Lớp của học kỳ II" && !document.querySelector(".today-reload").disabled')
  assert(await evaluate(has('Việc của học kỳ II')), 'A full reload must preserve the selected semester')
  await select('.flow-active-semester select', '11'); await waitFor(ready)
  await evaluate('sessionStorage.setItem("studyplanner.selected-semester.v1:an%40example.com", "999")')
  await go('/today'); await waitFor(ready)
  assert.equal(await evaluate('document.querySelector(".flow-active-semester select").value'), '11', 'An unavailable remembered semester falls back to an existing one')

  const root = '.backend-integration/screenshots'
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(root + '/today-priorities-desktop.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  // Re-entering via client navigation keeps the last view while refreshing the BE.
  await click('.sidebar a[href="/profile"]'); await waitFor('location.pathname === "/profile"')
  fixture.state.delay = 400
  fixture.state.tasks[0].tieuDe = 'Bài quá hạn vừa cập nhật'
  await click('.sidebar a[href="/today"]')
  await waitFor('!!document.querySelector(".today-updating")')
  assert.equal(await evaluate('document.querySelectorAll(".today-priority-list > li").length'), 5)
  assert(!await evaluate('!!document.querySelector(".today-skeleton")'), 'No blocking loader on a warm route return')
  await waitFor(has('Bài quá hạn vừa cập nhật')); await waitFor(ready)
  fixture.state.delay = 0

  // Each source can fail independently; no false empty state or invented zeroes.
  fixture.state.calendarFail = true
  await go('/today'); await waitFor(has('Lịch học tạm gián đoạn.'))
  await waitFor('document.querySelectorAll(".today-priority-list > li").length === 5')
  assert(!await evaluate('!!document.querySelector(".today-next-class #today-next-title")'))
  fixture.state.calendarFail = false
  await click('.today-next-class .today-error button'); await waitFor(ready)
  fixture.state.tasksFail = true
  await go('/today'); await waitFor(has('Nhiệm vụ tạm gián đoạn.'))
  await waitFor('!!document.querySelector(".today-class-hours")')
  assert.equal(await evaluate('document.querySelector(".today-metrics strong").textContent'), '—')
  assert(!await evaluate('!!document.querySelector(".today-priority-list")'))
  fixture.state.tasksFail = false
  await click('.today-priorities .today-error button'); await waitFor(ready)

  // Long titles must wrap inside the Today drawer, including unbroken text.
  const longTitle = 'Các bước thực hiện nhiệm vụ '.repeat(8) + 'a'.repeat(180)
  fixture.state.tasks[0].tieuDe = longTitle
  await click('.today-reload')
  await waitFor('document.querySelector(".today-priority-list .today-task-title")?.textContent === ' + JSON.stringify(longTitle))
  for (const width of [1440, 390]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await click('.today-priority-list .today-task-title')
    await waitFor('!!document.querySelector(".today-page dialog[open]")')
    const layout = await evaluate(`(() => {
      const dialog = document.querySelector('.today-page dialog[open]')
      const heading = dialog.querySelector('h2')
      const close = dialog.querySelector('.dialog-heading button')
      const bounds = dialog.getBoundingClientRect(), title = heading.getBoundingClientRect(), button = close.getBoundingClientRect()
      return { title: heading.textContent, noOverflow: dialog.scrollWidth <= dialog.clientWidth + 1,
        inViewport: bounds.left >= 0 && bounds.right <= innerWidth + 1,
        wrapped: title.height > parseFloat(getComputedStyle(heading).lineHeight) * 2,
        closeVisible: button.left >= bounds.left && button.right <= bounds.right && button.top >= 0 && button.bottom <= innerHeight && title.right <= button.left }
    })()`)
    assert.equal(layout.title, longTitle)
    assert(layout.noOverflow && layout.inViewport && layout.wrapped && layout.closeVisible, `Long title drawer at ${width}px: ${JSON.stringify(layout)}`)
    await click('dialog button[aria-label="Đóng hộp thoại"]')
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })

  fixture.state.tasks = []; fixture.state.events = []
  await click('.today-reload')
  await waitFor(has('Chưa có việc cần gợi ý'))
  assert(await evaluate(has('Chưa có buổi học trong 7 ngày tới')))
  assert.equal(await evaluate('document.querySelector(".today-progress").innerText.includes("0/0")'), true)
  const writes = calls.filter((call) => /^\/api\/v1\/(tasks|calendar|planning|class-sessions)/.test(call.route) && call.method !== 'GET')
  assert.deepEqual(writes, [], 'Today is a read-only summary and must never write tasks or schedules')
  assert.deepEqual(errors, [])
  console.log('PASS: Today compact priority list, leaf pagination, inherited deadlines, selected semester/personal work, timezone calculations, progress, agenda, detail links, warm navigation, independent failures, retries and empty states; no task/calendar mutations.')
}
