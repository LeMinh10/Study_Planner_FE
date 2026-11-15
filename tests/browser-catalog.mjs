import assert from 'node:assert/strict'
import fs from 'node:fs'

export function createCatalogFixture() {
  const state = {
    failLoad: false, failWrite: false,
    semesters: [{ ma: 1, ten: 'Học kỳ 1', thuTu: 1, phienBan: 1 }, { ma: 2, ten: 'Học kỳ 2', thuTu: 2, phienBan: 1 }],
    courses: Array.from({ length: 26 }, (_, i) => ({ ma: i + 1, maHocKyMau: i % 2 + 1, kyHieu: 'MON' + String(i + 1).padStart(2, '0'), ten: i === 0 ? 'Cơ sở dữ liệu' : 'Môn tham khảo ' + (i + 1), soTinChi: 3, phienBan: 1 })),
  }
  let nextTerm = 3, nextCourse = 27
  const failure = (status, detail) => ({ status, response: { detail } })
  return { state, async handle(url, method, body, role) {
    if (!url.pathname.startsWith('/api/v1/admin/catalog/')) return null
    if (role !== 'admin') return failure(403, 'Không có quyền quản trị.')
    if (method === 'GET' && state.failLoad) return failure(503, 'Danh mục tạm gián đoạn.')
    if (method !== 'GET' && state.failWrite) return failure(503, 'Chưa lưu được mẫu.')
    const [, kind, idText] = url.pathname.match(/\/catalog\/(semesters|courses)(?:\/(\d+))?$/) || []
    const id = Number(idText), rows = kind === 'semesters' ? state.semesters : state.courses
    const dto = row => kind === 'semesters' ? { ...row, soMonHoc: state.courses.filter(c => c.maHocKyMau === row.ma).length, tongTinChi: state.courses.filter(c => c.maHocKyMau === row.ma).reduce((s, c) => s + c.soTinChi, 0) } : { ...row, tenHocKy: state.semesters.find(s => s.ma === row.maHocKyMau)?.ten }
    if (method === 'GET') {
      if (kind === 'semesters') return { status: 200, response: rows.map(dto) }
      const q = url.searchParams, page = Number(q.get('trang') || 1), keyword = (q.get('tuKhoa') || '').toLowerCase()
      const filtered = rows.filter(row => (!q.get('maHocKyMau') || row.maHocKyMau === Number(q.get('maHocKyMau'))) && (row.ten + ' ' + row.kyHieu).toLowerCase().includes(keyword))
      return { status: 200, response: { danhSach: filtered.slice((page - 1) * 20, page * 20).map(dto), trang: page, kichThuocTrang: 20, tongSo: filtered.length } }
    }
    const row = rows.find(r => r.ma === id)
    if (method !== 'POST' && !row) return failure(404, 'Mẫu không còn tồn tại.')
    if (method !== 'POST' && row.phienBan !== Number(method === 'DELETE' ? url.searchParams.get('phienBan') : body.phienBan)) return failure(409, 'Mẫu đã được thay đổi bởi người khác. Hãy tải lại.')
    if (method === 'DELETE') {
      if (kind === 'semesters' && state.courses.some(c => c.maHocKyMau === id)) return failure(409, 'Học kỳ mẫu còn môn học. Hãy chuyển hoặc xóa các môn trước.')
      rows.splice(rows.indexOf(row), 1); return { status: 204 }
    }
    if (kind === 'semesters' && rows.some(r => r.ma !== id && r.ten.toUpperCase() === body.ten.trim().toUpperCase())) return failure(409, 'Tên học kỳ mẫu đã tồn tại.')
    if (kind === 'courses' && rows.some(r => r.ma !== id && r.maHocKyMau === body.maHocKyMau && r.kyHieu === body.kyHieu)) return failure(409, 'Mã môn đã tồn tại trong học kỳ mẫu này.')
    const next = { ...body, ma: id || (kind === 'semesters' ? nextTerm++ : nextCourse++), phienBan: row ? row.phienBan + 1 : 1 }
    if (row) Object.assign(row, next); else rows.push(next)
    return { status: method === 'POST' ? 201 : 200, response: dto(next) }
  } }
}

export async function runCatalogChecks({ go, click, input, select, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  const ready = '!!document.querySelector(".catalog-add") && !document.querySelector(".catalog-add").disabled'
  const modal = '!!document.querySelector("dialog[open]")'
  await go('/admin/catalog'); await waitFor('location.pathname === "/login"')
  await login('admin@example.com'); await waitFor('location.pathname === "/admin/overview"')
  await click('a[href="/admin/catalog"]'); await waitFor(ready)
  assert.equal(await evaluate('document.querySelector(".admin-topbar strong").textContent'), 'Danh mục môn học & học kỳ')
  assert.equal(await evaluate('document.querySelectorAll(".catalog-table tbody tr").length'), 20)
  await click('.catalog-pagination nav button:last-child'); await waitFor('document.querySelectorAll(".catalog-table tbody tr").length === 6')
  await select('select[name=catalogSemesterFilter]', '1'); await waitFor('document.querySelectorAll(".catalog-table tbody tr").length === 13 && !document.querySelector(".catalog-add").disabled')
  assert.equal(await evaluate('document.querySelectorAll(".catalog-table tbody tr").length'), 13)
  await input('catalogSearch', 'Cơ sở'); await waitFor('document.querySelectorAll(".catalog-table tbody tr").length === 1 && !document.querySelector(".catalog-add").disabled')
  await go('/admin/catalog?semester=1&q=C%C6%A1+s%E1%BB%9F'); await waitFor(ready)
  assert.equal(await evaluate('document.querySelector(".catalog-table tbody strong").textContent'), 'Cơ sở dữ liệu')
  await click('.catalog-filters .catalog-text-button'); await waitFor(ready)
  await click('.catalog-tabs button:last-child'); await waitFor('document.querySelector(".catalog-tabs button:last-child").getAttribute("aria-current") === "page"'); await waitFor(ready)
  await click('.catalog-add'); await waitFor(modal)
  await input('catalogName', 'Học kỳ mới'); await input('catalogOrder', '3'); await click('dialog button[type=submit]')
  await waitFor('!document.querySelector("dialog[open]") && document.querySelectorAll(".catalog-table tbody tr").length === 3')
  await go('/admin/catalog?tab=semesters'); await waitFor(ready)
  assert(await evaluate('document.querySelector(".catalog-table").textContent.includes("Học kỳ mới")'))
  await click('.catalog-tabs button:first-child'); await waitFor('document.querySelector(".catalog-tabs button:first-child").getAttribute("aria-current") === "page"'); await waitFor(ready)
  await click('.catalog-add'); await waitFor(modal)
  await input('catalogName', 'Môn mới'); await input('catalogCode', 'new01'); await input('catalogCredits', '4'); await select('select[name=catalogCourseSemester]', '3')
  fixture.state.failWrite = true
  await click('dialog button[type=submit]'); await waitFor('!!document.querySelector("dialog [role=alert]")')
  assert.equal(await evaluate('document.querySelector("input[name=catalogName]").value'), 'Môn mới')
  fixture.state.failWrite = false
  await click('dialog button[type=submit]'); await waitFor('!document.querySelector("dialog[open]")'); await waitFor(ready)
  await select('select[name=catalogSemesterFilter]', '3'); await waitFor('document.querySelectorAll(".catalog-table tbody tr").length === 1 && !document.querySelector(".catalog-add").disabled')
  assert.equal(await evaluate('document.querySelector(".catalog-code").textContent'), 'NEW01')
  await click('.catalog-actions button:first-child'); await waitFor(modal)
  await input('catalogCredits', '5'); await click('dialog button[type=submit]'); await waitFor('!document.querySelector("dialog[open]")'); await waitFor(ready)
  assert.equal(fixture.state.courses.find(row => row.kyHieu === 'NEW01').soTinChi, 5)
  await click('.catalog-actions button:first-child'); await waitFor(modal)
  fixture.state.courses.find(row => row.kyHieu === 'NEW01').phienBan++
  await input('catalogCredits', '6'); await click('dialog button[type=submit]'); await waitFor('!!document.querySelector("dialog [role=alert]")')
  assert.equal(fixture.state.courses.find(row => row.kyHieu === 'NEW01').soTinChi, 5)
  await click('dialog .dialog-heading button'); await go(await evaluate('location.pathname + location.search')); await waitFor(ready)
  await click('.catalog-add'); await waitFor(modal)
  await input('catalogName', 'Môn trùng'); await input('catalogCode', 'NEW01'); await click('dialog button[type=submit]'); await waitFor('!!document.querySelector("dialog [role=alert]")')
  await click('dialog .dialog-heading button')
  await click('.catalog-tabs button:last-child'); await waitFor(ready)
  await click('button[aria-label="Xóa học kỳ Học kỳ mới"]'); await click('.catalog-confirm-delete'); await waitFor('!!document.querySelector("dialog [role=alert]")')
  await click('dialog .dialog-heading button')
  await click('.catalog-tabs button:first-child'); await waitFor(ready)
  const deletes = calls.filter(call => call.method === 'DELETE').length
  await click('.catalog-actions button:last-child'); await click('dialog .dialog-actions button:first-child')
  assert.equal(calls.filter(call => call.method === 'DELETE').length, deletes, 'Cancel never deletes a course')
  await click('.catalog-actions button:last-child'); await click('.catalog-confirm-delete'); await waitFor('!document.querySelector("dialog[open]")'); await waitFor(ready)
  assert(!fixture.state.courses.some(row => row.kyHieu === 'NEW01'))
  await click('.catalog-tabs button:last-child'); await waitFor(ready)
  await click('button[aria-label="Xóa học kỳ Học kỳ mới"]'); await click('.catalog-confirm-delete'); await waitFor('!document.querySelector("dialog[open]")'); await waitFor(ready)
  assert(!fixture.state.semesters.some(row => row.ma === 3))
  fixture.state.failLoad = true
  await go(await evaluate('location.pathname + location.search')); await waitFor('!!document.querySelector(".catalog-page > .catalog-error")')
  fixture.state.failLoad = false
  await click('.catalog-page > .catalog-error button'); await waitFor(ready)
  await go('/admin/catalog'); await waitFor(ready)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/admin-catalog.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page does not overflow the viewport')
  fixture.state.courses = []; fixture.state.semesters = []
  await go('/admin/catalog'); await waitFor('document.querySelector(".catalog-message")?.textContent.includes("Chưa có học kỳ mẫu") && document.querySelector(".catalog-add").disabled')
  assert(await evaluate('document.querySelector(".catalog-message").textContent.includes("Chưa có học kỳ mẫu")'))
  await click('.catalog-tabs button:last-child'); await waitFor(ready)
  assert(await evaluate('document.querySelector(".catalog-message").textContent.includes("Chưa có học kỳ mẫu")'))
  assert.deepEqual(errors, [])
  assert(!calls.some(call => /\/api\/v1\/(semesters|courses|tasks)(?:\?|\/|$)/.test(call.route) && call.method !== 'GET'), 'Catalog never writes student academic data')
  console.log('PASS: catalog menu, direct route, pagination, search/filter/F5, semester/course CRUD, preserved form on error, duplicates, stale versions, restricted semester deletion, cancellation, retries and separation from student data.')
}
