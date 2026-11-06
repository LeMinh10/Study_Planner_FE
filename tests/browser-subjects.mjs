import assert from 'node:assert/strict'
import fs from 'node:fs'

// Opt-in browser scenario, run by browser-auth.mjs with TEST_SUBJECTS_UI=1.
// Data stays inside CDP interception; never writes to the application database.
export function createAcademicFixture() {
  const state = {
    unavailable: false, saveFailure: false, deleteFailure: false, detailFailure: false, previewFailure: false, delay: 250,
    semesters: [{ ma: 11, ten: 'Học kỳ I · 2026–2027', ngayBatDau: '2026-09-01', ngayKetThuc: '2027-01-31' }, { ma: 12, ten: 'Học kỳ II · 2026–2027', ngayBatDau: '2027-02-01', ngayKetThuc: '2027-06-30' }],
    courses: [
      { ma: 101, maHocKy: 11, ten: 'Lập trình ứng dụng web', kyHieu: 'IT301', soTinChi: 4, giangVien: 'Nguyễn Minh Anh', mauSac: '#53A88C' },
      { ma: 102, maHocKy: 11, ten: 'Cơ sở dữ liệu', kyHieu: 'IT204', soTinChi: 3, giangVien: 'Trần Hoàng Phúc', mauSac: '#72A8D6' },
      { ma: 103, maHocKy: 11, ten: 'Tiếng Anh chuyên ngành', kyHieu: null, soTinChi: null, giangVien: null, mauSac: '#A278C4' },
    ],
  }
  let nextId = 200
  const page = (items, url) => ({ danhSach: items, trang: Number(url.searchParams.get('Trang') || 1), kichThuocTrang: Number(url.searchParams.get('KichThuocTrang') || 20), tongSo: items.length })
  return { state, async handle(url, method, body) {
    if (!/^\/api\/v1\/(semesters|courses)(\/|$)/.test(url.pathname)) return null
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay))
    if (state.unavailable) return { status: 503, response: { detail: 'Dịch vụ tạm thời gián đoạn.' } }
    const coursePath = url.pathname.match(/^\/api\/v1\/courses\/(\d+)(\/deletion-preview)?$/)
    if (coursePath) {
      const id = Number(coursePath[1]), course = state.courses.find((item) => item.ma === id)
      if (!course) return { status: 404, response: { detail: 'Không tìm thấy môn học.' } }
      if (coursePath[2]) return state.previewFailure ? { status: 503, response: { detail: 'Chưa lấy được ảnh hưởng xóa.' } } : { status: 200, response: { soMonHoc: 1, soBuoiHoc: 2, soNhiemVuBoLienKet: 4 } }
      if (method === 'GET' && state.detailFailure) return { status: 503, response: {} }
      if (method === 'DELETE') {
        if (state.deleteFailure) return { status: 409, response: { detail: 'Dữ liệu đã thay đổi. Vui lòng thử lại.' } }
        state.courses = state.courses.filter((item) => item.ma !== id)
        return { status: 204 }
      }
      if (method === 'PUT') {
        if (state.saveFailure) return { status: 400, response: { detail: 'Không thể lưu môn học lúc này.' } }
        Object.assign(course, body)
      }
      return { status: 200, response: course }
    }
    const nested = url.pathname.match(/^\/api\/v1\/semesters\/(\d+)\/courses$/)
    if (nested) {
      const semesterId = Number(nested[1])
      if (method === 'POST') {
        if (state.saveFailure) return { status: 400, response: { detail: 'Không thể lưu môn học lúc này.' } }
        const created = { ...body, ma: nextId++, maHocKy: semesterId }
        state.courses.push(created)
        return { status: 201, response: created }
      }
      return { status: 200, response: page(state.courses.filter((item) => item.maHocKy === semesterId), url) }
    }
    if (url.pathname === '/api/v1/semesters') {
      if (method === 'POST') {
        const created = { ...body, ma: nextId++ }; state.semesters.push(created)
        return { status: 201, response: created }
      }
      return { status: 200, response: page(state.semesters, url) }
    }
    return { status: 404, response: {} }
  } }
}

export async function runSubjectChecks({ go, input, click, select, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  const screenshotRoot = '.backend-integration/screenshots'
  fs.mkdirSync(screenshotRoot, { recursive: true })
  async function screenshot(name) {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`${screenshotRoot}/${name}.png`, Buffer.from(data, 'base64'))
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await go('/login'); await login(); await waitFor('location.pathname === "/today"')
  await click('.sidebar .flow-sidebar-tools a[href="/subjects"]')
  await waitFor('!!document.querySelector(".courses-loading")')
  assert(await evaluate('document.querySelector(".courses-page .button-primary").disabled'))
  await waitFor('document.querySelectorAll(".course-card").length === 3')
  fixture.state.delay = 0
  await runSidebarSubjectChecks({ go, click, waitFor, evaluate, cdp, fixture, screenshot })
  assert.equal(await evaluate('document.querySelector(".courses-totals").innerText.replace(/\\s+/g, " ").trim()'), 'Môn học 3 Tổng tín chỉ 7')
  assert(!await evaluate('!!document.querySelector(".courses-page progress")'), 'No invented task completion metrics')
  await screenshot('subjects-desktop')
  await input('courseSearch', 'Minh Anh'); await waitFor('document.querySelectorAll(".course-card").length === 1')
  await input('courseSearch', 'không có kết quả'); await waitFor('document.body.innerText.includes("Không tìm thấy môn học")')
  await click('.courses-empty button'); await waitFor('document.querySelectorAll(".course-card").length === 3')
  await select('select[aria-label="Sắp xếp môn học"]', 'credits')
  assert((await evaluate('document.querySelector(".course-card h2").innerText')).includes('Lập trình'))
  await click('button[aria-label="Hiển thị dạng danh sách"]'); await waitFor('!!document.querySelector(".courses-list")')
  await click('button[aria-label="Hiển thị dạng thẻ"]')
  await runCreateNavigationChecks({ go, click, select, waitFor, evaluate })
  await click('.courses-page .heading-actions .button-primary')
  await waitFor('location.pathname === "/subjects/new" && !!document.querySelector(".course-create-page input[name=name]")')
  assert(!await evaluate('!!document.querySelector("dialog")'), 'Create a subject on its own page')
  assert.equal(await evaluate('document.querySelector("select[name=semesterId]").value'), '11')
  await input('name', 'Thiết kế giao diện'); await input('code', 'UX201'); await input('teacher', 'Lê Hoài An')
  await click('input[type=radio][value=clay]')
  await screenshot('subject-create-page')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  assert.equal(await evaluate('innerWidth'), 390)
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'))
  await screenshot('subject-create-page-mobile')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  fixture.state.saveFailure = true
  await click('.course-create-page button[type=submit]'); await waitFor('document.querySelector(".course-create-page [role=alert]")?.textContent.includes("Không thể lưu")')
  assert.equal(await evaluate('location.pathname'), '/subjects/new')
  assert.equal(await evaluate('document.querySelector("input[name=name]").value'), 'Thiết kế giao diện')
  assert.equal(fixture.state.courses.length, 3)
  fixture.state.saveFailure = false
  await click('.course-create-page button[type=submit]'); await waitFor('location.pathname === "/subjects" && document.querySelectorAll(".course-card").length === 4')
  assert((await evaluate('document.querySelector(".courses-success").textContent')).includes('Đã thêm môn học'))
  assert.equal(fixture.state.courses.find((item) => item.ma === 200).mauSac, '#E58E73')
  await click('article:has(a[href="/tasks?subject=200"]) summary')
  await click('article:has(a[href="/tasks?subject=200"]) .action-menu-items button')
  await waitFor('!!document.querySelector("dialog input[name=name]")')
  assert(await evaluate('document.querySelector("dialog select[name=semesterId]").disabled'))
  await input('name', 'Thiết kế giao diện nâng cao')
  await click('dialog button[type=submit]'); await waitFor('!document.querySelector("dialog")')
  assert.equal(fixture.state.courses.find((item) => item.ma === 200).ten, 'Thiết kế giao diện nâng cao')
  const put = calls.findLast((call) => call.route === '/api/v1/courses/200' && call.method === 'PUT')
  assert(!('maHocKy' in put.body))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  assert.equal(await evaluate('innerWidth'), 390, 'Mobile should use the device width')
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile must not overflow horizontally')
  await screenshot('subjects-mobile')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await click('article:has(a[href="/tasks?subject=200"]) summary')
  await click('article:has(a[href="/tasks?subject=200"]) .action-menu-items .danger-text')
  await waitFor('document.querySelector("dialog")?.innerText.includes("4 nhiệm vụ được giữ lại")')
  fixture.state.deleteFailure = true
  await click('dialog .button-danger'); await waitFor('document.querySelector("dialog [role=alert]")?.textContent.includes("Dữ liệu đã thay đổi")')
  assert.equal(fixture.state.courses.length, 4)
  fixture.state.deleteFailure = false
  await click('dialog .button-danger'); await waitFor('!document.querySelector("dialog") && document.querySelectorAll(".course-card").length === 3')
  const previewIndex = calls.findIndex((call) => call.route === '/api/v1/courses/200/deletion-preview')
  assert(previewIndex >= 0 && previewIndex < calls.findIndex((call) => call.route === '/api/v1/courses/200' && call.method === 'DELETE'))
  await select('#courses-semester', '12'); await waitFor('document.body.innerText.includes("Học kỳ này chưa có môn học")')
  await click('.courses-empty .button-primary')
  await waitFor('location.pathname === "/subjects/new" && !!document.querySelector(".course-create-page input[name=name]")')
  assert.equal(await evaluate('document.querySelector("select[name=semesterId]").value'), '12')
  await input('name', 'Môn tạo ở kỳ II')
  await click('.course-create-page button[type=submit]')
  await waitFor('location.pathname === "/subjects" && document.querySelector("#courses-semester").value === "12" && document.querySelectorAll(".course-card").length === 1')
  assert.equal(fixture.state.courses.find((item) => item.ma === 201).maHocKy, 12)
  await click('.course-card summary'); await click('.course-card .danger-text')
  await waitFor('!!document.querySelector("dialog .button-danger")')
  await click('dialog .button-danger')
  await waitFor('!document.querySelector("dialog") && document.body.innerText.includes("Học kỳ này chưa có môn học")')
  await screenshot('subjects-empty')
  fixture.state.unavailable = true
  await go('/subjects'); await waitFor('document.body.innerText.includes("Chưa tải được môn học")')
  assert(await evaluate('document.querySelector(".courses-page .heading-actions .button-primary").disabled'))
  await screenshot('subjects-error')
  fixture.state.unavailable = false
  await click('.courses-error button'); await waitFor('document.querySelectorAll(".course-card").length === 3')
  await runWorkspaceChecks({ go, input, click, select, waitFor, evaluate, fixture, screenshot })
  fixture.state.courses = []; fixture.state.semesters = []
  await go('/subjects/new'); await waitFor('document.body.innerText.includes("Bạn cần có học kỳ trước") && !document.querySelector(".course-create-page button[type=submit]")')
  await go('/subjects'); await waitFor('document.body.innerText.includes("Bắt đầu với một học kỳ") && !!document.querySelector(".courses-empty button:not(:disabled)")')
  await click('.courses-empty button'); await input('name', 'Học kỳ mới'); await input('startDate', '2026-09-01'); await input('endDate', '2027-01-31')
  await click('dialog button[type=submit]'); await waitFor('!document.querySelector("dialog") && document.body.innerText.includes("Học kỳ này chưa có môn học")')
  assert.equal(fixture.state.semesters.length, 1)
  assert.deepEqual(errors, [])
  console.log('PASS: subjects UI loading/error/retry/empty states, semester creation/filter, search, sorting, grid/list, course create/update, immutable semester, deletion preview, failed writes and 204, responsive layout. Screenshots: ' + screenshotRoot)
}

async function runSidebarSubjectChecks({ go, click, waitFor, evaluate, cdp, fixture, screenshot }) {
  const original = fixture.state.courses
  fixture.state.courses = [...original, ...Array.from({ length: 97 }, (_, index) => ({
    ma: 1000 + index, maHocKy: 11, ten: 'Môn kiểm thử ' + (index + 1), kyHieu: null, soTinChi: 3, giangVien: null, mauSac: '#53A88C',
  }))]
  await go('/subjects')
  await waitFor('document.querySelectorAll(".sidebar .flow-subject-link").length === 100')
  assert(await evaluate('(() => { const list = document.querySelector(".flow-subject-tree"); return list.scrollHeight <= list.clientHeight + 1 && getComputedStyle(list).overflowY === "visible" && list.clientHeight > 280 })()'), 'All 100 subjects expand without a separate scroll area')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 720, deviceScaleFactor: 1, mobile: false })
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  await screenshot('sidebar-subjects-100')
  await click('.sidebar-subject-toggle')
  await waitFor('document.querySelector(".sidebar-subject-toggle").getAttribute("aria-expanded") === "false"')
  assert(await evaluate('document.querySelector("#sidebar-subject-list").hidden'))
  assert(await evaluate('document.querySelector(".sidebar-profile").getBoundingClientRect().bottom <= innerHeight + 1'), 'Collapsing subjects brings the lower navigation back into view')
  assert(await evaluate('document.querySelector(".student-semester-link").getClientRects().length > 0'))
  await click('.student-semester-link')
  await waitFor('location.pathname === "/semesters"')
  assert(await evaluate('document.querySelector("#sidebar-subject-list").hidden'), 'Collapsed state persists when navigating')
  await click('.sidebar .flow-sidebar-tools a[href="/subjects"]')
  await waitFor('location.pathname === "/subjects"')
  await click('.sidebar-subject-toggle')
  await waitFor('!document.querySelector("#sidebar-subject-list").hidden')
  await click('.flow-subject-link:last-child')
  await waitFor('new URLSearchParams(location.search).get("subject") === "1096" && !!document.querySelector(".flow-subject-link:last-child[aria-current=page]")')
  await click('.sidebar-toggle')
  assert(await evaluate('document.querySelector(".flow-space-tree").getClientRects().length === 0'))
  await click('.sidebar-toggle')
  assert(await evaluate('document.querySelector(".flow-space-tree").getClientRects().length > 0'))
  fixture.state.courses = original
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await go('/subjects')
  await waitFor('document.querySelectorAll(".course-card").length === 3')
  console.log('PASS: all 100 subjects expand without an inner scroll area, collapse/expand, persistent collapsed state during navigation and selection of the last subject.')
}

async function runCreateNavigationChecks({ go, click, select, waitFor, evaluate }) {
  await click('.sidebar .flow-new-list')
  await waitFor('location.pathname === "/subjects/new" && !!document.querySelector(".course-create-page input[name=name]")')
  assert(!await evaluate('!!document.querySelector("dialog")'))
  await click('.course-create-page .dialog-actions button[type=button]')
  await waitFor('location.pathname === "/subjects" && document.querySelectorAll(".course-card").length === 3')
  await click('.course-add-card')
  await waitFor('location.pathname === "/subjects/new"')
  await go('/subjects/new?semester=12')
  await waitFor('document.querySelector("select[name=semesterId]")?.value === "12" && !document.querySelector(".course-editor-fields").disabled')
  assert.equal(await evaluate('document.querySelector(".course-create-page h1").textContent'), 'Thêm môn học')
  await go('/subjects/new?semester=999')
  await waitFor('document.querySelector(".course-create-page [role=alert] h2")?.textContent === "Không tìm thấy học kỳ"')
  assert(!await evaluate('!!document.querySelector(".course-create-page form")'))
  await click('.course-create-page .courses-empty a')
  await waitFor('location.pathname === "/subjects" && !!document.querySelector("#courses-semester")')
  await select('#courses-semester', '11')
  await waitFor('document.querySelectorAll(".course-card").length === 3')
}

async function runWorkspaceChecks({ go, input, click, select, waitFor, evaluate, fixture, screenshot }) {
  assert(await evaluate('[...document.querySelectorAll(".course-card h2 a")].every(link => link.getAttribute("href").startsWith("/tasks?subject="))'))
  await click('.course-card h2 a')
  await waitFor('location.pathname === "/tasks" && new URLSearchParams(location.search).get("subject") === "102" && !!document.querySelector(".task-workspace")')
  assert(!await evaluate('!!document.querySelector(".subject-room-grid")'))
  await click('.flow-view-tabs button:nth-child(2)')
  await waitFor('new URLSearchParams(location.search).get("layout") === "board"')
  await click('.flow-filter-chips button[aria-pressed=false]:last-child')
  await waitFor('new URLSearchParams(location.search).get("view") === "priority"')
  await evaluate(`(() => { const field = document.querySelector('input[aria-label="Tìm trong danh sách"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'ghi nhớ'); field.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  fixture.state.detailFailure = true
  await click('.flow-space-actions button[aria-haspopup=dialog]')
  await waitFor('!!document.querySelector(".subject-info-error")')
  assert(await evaluate('document.querySelector(".subject-info-actions .button-primary").disabled'))
  fixture.state.detailFailure = false
  await click('.subject-info-error button')
  await waitFor('!!document.querySelector(".subject-info-actions .button-primary:not(:disabled)")')
  assert((await evaluate('document.querySelector(".subject-info-fields").innerText')).includes('Trần Hoàng Phúc'))
  await screenshot('subject-workspace-panel')
  await click('.subject-info-actions .button-primary')
  await waitFor('!!document.querySelector(".course-editor")')
  await input('teacher', 'Giảng viên đã cập nhật')
  await click('dialog button[type=submit]')
  await waitFor('document.querySelector(".subject-info-fields")?.innerText.includes("Giảng viên đã cập nhật")')
  await click('dialog button[aria-label="Đóng hộp thoại"]')
  await waitFor('!document.querySelector("dialog")')
  assert.deepEqual(await evaluate('(() => { const p = new URLSearchParams(location.search); return [p.get("subject"), p.get("layout"), p.get("view"), p.get("info"), document.querySelector(\'input[aria-label="Tìm trong danh sách"]\').value] })()'), ['102', 'board', 'priority', null, 'ghi nhớ'])
  assert.equal(await evaluate('document.body.style.overflow'), '')
  await go('/subjects/101?layout=calendar&view=done')
  await waitFor('location.pathname === "/tasks" && new URLSearchParams(location.search).get("subject") === "101" && !!document.querySelector(".flow-calendar-days")')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("view")'), 'done')
  await go('/subjects/999')
  await waitFor('location.pathname === "/tasks" && document.querySelector("main h1")?.textContent === "Không tìm thấy môn học"')
  assert(!await evaluate('!!document.querySelector(".task-workspace")'))

  fixture.state.courses.push({ ma: 201, maHocKy: 12, ten: 'Môn học kỳ khác', kyHieu: 'HK2', soTinChi: 2, giangVien: null, mauSac: '#72A8D6' })
  await go('/subjects/201?layout=board')
  await waitFor('location.pathname === "/tasks" && document.querySelector("main h1")?.textContent === "Môn học kỳ khác" && document.querySelector(".flow-active-semester select").value === "12"')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("layout")'), 'board')
  await select('.flow-active-semester select', '11')
  await waitFor('!new URLSearchParams(location.search).has("subject") && document.querySelector(".flow-active-semester select").value === "11" && document.querySelector("main h1")?.textContent === "Nhiệm vụ"')
  assert.equal(await evaluate('document.querySelector("main h1").textContent'), 'Nhiệm vụ')
  await go('/tasks?subject=201&info=1')
  await waitFor('!!document.querySelector(".subject-info-actions .button-primary:not(:disabled)")')
  fixture.state.previewFailure = true
  await click('.subject-info-actions .danger-text')
  await waitFor('!!document.querySelector(".subject-info-panel [role=alert]")')
  assert(!await evaluate('!!document.querySelector(".button-danger")'), 'Failed preview cannot offer delete confirmation')
  fixture.state.previewFailure = false
  await click('.subject-info-actions .danger-text')
  await waitFor('!!document.querySelector("dialog .button-danger")')
  assert(!await evaluate('!!document.querySelector(".subject-info-panel")'), 'Use one modal at a time')
  await click('dialog .button-secondary')
  await waitFor('!!document.querySelector(".subject-info-panel")')
  await click('.subject-info-actions .danger-text')
  await waitFor('!!document.querySelector("dialog .button-danger")')
  fixture.state.deleteFailure = true
  await click('dialog .button-danger')
  await waitFor('document.querySelector("dialog [role=alert]")?.textContent.includes("Dữ liệu đã thay đổi")')
  assert(fixture.state.courses.some((item) => item.ma === 201))
  fixture.state.deleteFailure = false
  await click('dialog .button-danger')
  await waitFor('location.pathname === "/subjects" && !document.querySelector("dialog")')
  assert(!fixture.state.courses.some((item) => item.ma === 201))
  assert.equal(await evaluate('document.body.style.overflow'), '')
  await screenshot('subject-workspace-after-delete')
  console.log('PASS: one subject workspace, canonical card links, information drawer detail retry/edit, preserved filters/search, legacy redirects, invalid IDs, cross-semester links, semester switching, preview failure/cancel and delete retry/204.')
}
