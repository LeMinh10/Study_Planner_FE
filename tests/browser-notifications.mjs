import assert from 'node:assert/strict'
import fs from 'node:fs'

export function createNotificationFixture() {
  const row = i => ({ ma: i, maNhiemVu: i, tieuDe: i === 1 ? 'Nhiệm vụ đã quá hạn' : 'Nhiệm vụ sắp đến hạn', tenNhiemVu: i === 1 ? 'Việc quá hạn ' + 'a'.repeat(200) : 'Nhiệm vụ ' + i, noiDung: 'Thông báo nhắc hạn.', hanHieuLuc: '2026-11-10T17:00:00+07:00', maHocKy: i === 1 ? 12 : 11, tenHocKy: i === 1 ? 'Học kỳ II' : 'Học kỳ I', maMonHoc: null, tenMonHoc: null, quaHan: i === 1, daHoanThanh: false, ngayPhat: '2026-11-10T03:00:00Z', ngayDoc: i <= 2 ? null : '2026-11-10T03:01:00Z' })
  const state = { rows: Array.from({ length: 21 }, (_, i) => row(i + 1)), fail: false }
  return { state, handle(url, method, body) {
    if (!url.pathname.startsWith('/api/v1/notifications')) return null
    if (state.fail) return { status: 503, response: { detail: 'Thông báo tạm gián đoạn.' } }
    if (method === 'GET') {
      const unread = state.rows.filter(x => !x.ngayDoc).length
      const rows = state.rows.filter(x => url.searchParams.get('chuaDoc') !== 'true' || !x.ngayDoc)
      const page = Number(url.searchParams.get('trang'))
      return { status: 200, response: { danhSach: rows.slice((page - 1) * 20, page * 20), trang: page, kichThuocTrang: 20, tongSo: rows.length, tongChuaDoc: unread, muiGio: 'Asia/Ho_Chi_Minh', docDenLuc: '2026-11-10T04:00:00Z' } }
    }
    if (url.pathname.endsWith('/read-all')) {
      assert.equal(body.docDenLuc, '2026-11-10T04:00:00Z')
      state.rows.forEach(x => { if (!x.ngayDoc) x.ngayDoc = '2026-11-10T04:01:00Z' })
    } else {
      const row = state.rows.find(x => x.ma === Number(url.pathname.split('/').at(-2)))
      assert(row)
      assert.equal(body.ngayPhat, row.ngayPhat)
      row.ngayDoc ??= '2026-11-10T04:01:00Z'
    }
    return { status: 204 }
  } }
}

export async function runNotificationChecks({ go, click, select, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await go('/login'); await login()
  await waitFor('document.querySelector(".student-notification-count")?.textContent === "2"')
  await click('.student-notification-bell')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 20')
  await click('.notification-toolbar button[aria-pressed="true"]')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 20')
  await click('.notification-pagination button:last-child')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 1')
  await click('.notification-pagination button:first-child')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 20')
  await click('.notification-toolbar > div button:last-child')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 2')
  await select('.flow-active-semester select', '12')
  assert.equal(await evaluate('document.querySelectorAll(".student-notification-item").length'), 2, 'Switching semesters must not filter the account inbox')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  const mobile = await evaluate('(() => { const p = document.querySelector(".student-notification-popup"), b = p.getBoundingClientRect(); return { left: b.left, right: b.right, width: innerWidth, scroll: p.scrollWidth, client: p.clientWidth, position: getComputedStyle(p).position, media: matchMedia("(max-width: 600px)").matches } })()')
  assert(mobile.left >= 0 && mobile.right <= mobile.width && mobile.scroll <= mobile.client + 1, 'Long titles fit mobile popup: ' + JSON.stringify(mobile))
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/notifications-mobile.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await click('.notification-read-all')
  await waitFor('!document.querySelector(".student-notification-count") && document.querySelector(".student-notification-empty")?.textContent.includes("Không có thông báo chưa đọc")')
  await go('/profile')
  await click('.student-notification-bell')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 20')
  assert(!await evaluate('!!document.querySelector(".student-notification-count")'), 'Read state survives a full navigation/reload')
  fixture.state.rows[0].ngayDoc = null
  await evaluate('window.dispatchEvent(new Event("studyplanner:refresh"))')
  await waitFor('document.querySelector(".student-notification-count")?.textContent === "1"')
  fixture.state.fail = true
  await click('.notification-toolbar > div button:last-child')
  await waitFor('!!document.querySelector(".notification-error")')
  assert(!await evaluate('!!document.querySelector(".student-notification-empty")'), 'Failure is not shown as an empty inbox')
  fixture.state.fail = false
  await click('.notification-error button')
  await waitFor('document.querySelectorAll(".student-notification-item").length === 1')
  await click('.student-notification-item')
  await waitFor('location.pathname === "/tasks" && new URLSearchParams(location.search).get("task") === "1"')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("semester")'), '12')
  assert(fixture.state.rows[0].ngayDoc)
  assert(calls.some(x => x.route === '/api/v1/notifications/1/read' && x.method === 'PATCH'))
  assert.deepEqual(calls.filter(x => /^\/api\/v1\/(tasks|calendar)/.test(x.route) && x.method !== 'GET'), [], 'Notification actions must never change tasks or calendar')
  assert.deepEqual(errors, [])
  console.log('PASS: notification unread badge, filters, same-filter refresh, pagination, semester independence, mobile long title, read-all, F5 persistence, independent errors/retry and exact task link; no task/calendar writes.')
}
