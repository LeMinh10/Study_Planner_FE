import assert from 'node:assert/strict'
import fs from 'node:fs'

const fixedNow = Date.parse('2026-11-12T03:00:00Z')
export function overviewUsers() {
  const names = ['Nguyễn Minh Anh', 'Trần Hoàng Nam', 'Lê Thị Thảo', 'Phạm Quang Huy', 'Võ Ngọc Mai']
  const students = Array.from({ length: 34 }, (_, i) => {
    const created = i < 7 ? fixedNow - (i === 4 ? 3 : i) * 3600000 : i === 7 ? fixedNow - 7 * 86400000 : fixedNow - (7 + i) * 86400000
    return { ma: 201 + i, hoTen: names[i] ?? 'Sinh viên ' + (i + 1), email: `student${i + 1}@example.test`, maSoSinhVien: 'SV' + (201 + i), tenTruong: 'Cao đẳng Kỹ Thuật Cao Thắng', tenLop: 'CDTH23WEBC', nganhHoc: 'CNTT', vaiTro: 'Student', dangHoatDong: i % 3 !== 0, ngayTao: new Date(created).toISOString(), ngayCapNhat: new Date(fixedNow).toISOString() }
  })
  return [...students, ...[991, 992].map(ma => ({ ...students[0], ma, hoTen: 'Quản trị viên', email: `admin${ma}@example.test`, vaiTro: 'Admin', dangHoatDong: true, ngayTao: new Date(fixedNow + 1000).toISOString() }))]
}
export function createOverviewFixture(users) {
  const state = { fail: false, empty: false, delay: 0 }
  return { state, async handle(url, method, role) {
    if (url.pathname !== '/api/v1/admin/overview') return null
    if (role !== 'admin') return { status: 403, response: { detail: 'Không có quyền.' } }
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
    if (state.fail) return { status: 503, response: { detail: 'Tổng quan tạm gián đoạn.' } }
    assert.equal(method, 'GET')
    const students = state.empty ? [] : users().filter(user => user.vaiTro === 'Student')
    const from = fixedNow - 7 * 86400000
    return { status: 200, response: { tongSinhVien: students.length, dangMo: students.filter(x => x.dangHoatDong).length, daKhoa: students.filter(x => !x.dangHoatDong).length,
      moiTrong7Ngay: students.filter(x => Date.parse(x.ngayTao) >= from && Date.parse(x.ngayTao) <= fixedNow).length,
      tuNgay: new Date(from).toISOString(), denNgay: new Date(fixedNow).toISOString(), sinhVienMoi: [...students].sort((a, b) => Date.parse(b.ngayTao) - Date.parse(a.ngayTao) || b.ma - a.ma).slice(0, 5)
        .map(x => ({ ma: x.ma, hoTen: x.hoTen, email: x.email, dangHoatDong: x.dangHoatDong, ngayTao: x.ngayTao })) } }
  } }
}
export async function runOverviewChecks({ go, click, waitFor, evaluate, cdp, login, fixture, priority, calls, errors }) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  const ready = 'document.querySelector("[data-overview-metric=total] strong")?.textContent === "34" && document.querySelectorAll(".overview-recent [data-student-id]").length === 5 && !!document.querySelector(".overview-rule h3")'
  fixture.state.delay = 250
  await go('/admin/overview'); await waitFor('location.pathname === "/login"')
  await login('admin@example.com'); await waitFor('location.pathname === "/admin/overview"')
  await waitFor('document.querySelector("[data-overview-metric=total] strong")?.textContent === "—"')
  await waitFor(ready); fixture.state.delay = 0
  for (const route of ['/admin', '/', '/login', '/admin/unknown', '/admin/overview']) {
    await go(route); await waitFor('location.pathname === "/admin/overview"'); await waitFor(ready)
    assert.equal(await evaluate('document.querySelector(".admin-sidebar a[aria-current=page]").getAttribute("href")'), '/admin/overview')
  }
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".overview-metric strong")].map(x => x.textContent)'), ['34', '22', '12', '8'])
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".overview-recent [data-student-id]")].map(x => Number(x.dataset.studentId))'), [201, 202, 203, 205, 204])
  assert(!await evaluate('!!document.querySelector(".admin-overview canvas, .admin-overview [role=img]")'))
  assert(await evaluate('document.querySelector(".overview-rule h3").textContent === "Mặc định"'))
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/admin-overview.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  assert(!await evaluate('!!document.querySelector(".overview-metrics a, .overview-metrics button, .overview-reload")'))
  await click('.overview-recent .overview-student-detail')
  await waitFor('location.pathname === "/admin/students/201" && !!document.querySelector(".admin-student-details")')
  assert(await evaluate('document.querySelector(".admin-student-details").textContent.includes("Nguyễn Minh Anh")'))
  await go('/admin/overview'); await waitFor(ready)
  await click('.overview-rule-link'); await waitFor('location.pathname === "/admin/priority-rules" && !!document.querySelector(".priority-editor")')
  priority.state.priorityRules.push({ ma: 4, phienBan: 4, ten: 'Quy tắc mới', dangSuDung: true, cauHinh: { phienBanSchema: 1, tieuChi: ['Importance', 'Deadline'] }, ngayTao: '2026-11-12T00:00:00Z' })
  await go('/admin/overview'); await waitFor(ready)
  assert.equal(await evaluate('document.querySelector(".overview-rule h3").textContent'), 'Quy tắc mới')
  priority.state.failRead = true
  await go('/admin/overview'); await waitFor('!!document.querySelector(".overview-rule [role=alert]") && document.querySelector("[data-overview-metric=total] strong")?.textContent === "34"')
  priority.state.failRead = false
  await click('.overview-rule-retry'); await waitFor(ready)
  fixture.state.fail = true
  await go('/admin/overview'); await waitFor('!!document.querySelector(".admin-overview > [role=alert]") && document.querySelector(".overview-rule h3")?.textContent === "Quy tắc mới"')
  assert.equal(await evaluate('document.querySelector("[data-overview-metric=total] strong").textContent'), '—')
  assert(!await evaluate('document.querySelector(".overview-recent").textContent.includes("Chưa có sinh viên")'))
  fixture.state.fail = false
  await click('.overview-stats-retry'); await waitFor(ready)
  fixture.state.empty = true
  await go('/admin/overview')
  await waitFor('document.querySelector("[data-overview-metric=total] strong")?.textContent === "0" && document.querySelector(".overview-recent")?.textContent.includes("Chưa có sinh viên")')
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".overview-metric strong")].map(x => x.textContent)'), ['0', '0', '0', '0'])
  assert.deepEqual(calls.filter(call => /^\/api\/v1\/(admin|tasks|calendar|planning)/.test(call.route) && call.method !== 'GET'), [])
  assert.deepEqual(errors, [])
  console.log('PASS: static overview metrics without links/reload button, latest five, student details, current rule, independent retries and empty state; read-only APIs.')
}
