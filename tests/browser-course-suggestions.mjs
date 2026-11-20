import assert from 'node:assert/strict'
import fs from 'node:fs'

export function createSuggestionsFixture() {
  const state = { fail: false, empty: false, delay: 30, rows: [
    { ma: 1, maHocKyMau: 2, tenHocKy: 'Học kỳ 2', ten: 'Cơ sở dữ liệu', kyHieu: 'CSDL01', soTinChi: 3 },
    { ma: 2, maHocKyMau: 1, tenHocKy: 'Học kỳ 1', ten: 'Lập trình web', kyHieu: 'WEB01', soTinChi: 4 },
    ...Array.from({ length: 24 }, (_, i) => ({ ma: i + 3, maHocKyMau: 2, tenHocKy: 'Học kỳ 2', ten: 'Môn mẫu ' + i, kyHieu: 'MAU' + i, soTinChi: 2 })),
  ] }
  return { state, async handle(url, method) {
    if (url.pathname !== '/api/v1/catalog/courses') return null
    assert.equal(method, 'GET', 'Suggestions never write shared templates')
    const keyword = (url.searchParams.get('tuKhoa') || '').toLowerCase(), page = Number(url.searchParams.get('trang') || 1)
    const rows = state.empty ? [] : structuredClone(state.rows.filter(row => (row.ten + ' ' + row.kyHieu).toLowerCase().includes(keyword)))
    const fail = state.fail
    await new Promise(resolve => setTimeout(resolve, keyword === 'cũ' ? 500 : state.delay))
    return fail ? { status: 503, response: { title: 'Unavailable' } } : { status: 200, response: { danhSach: rows.slice((page - 1) * 20, page * 20), trang: page, kichThuocTrang: 20, tongSo: rows.length } }
  } }
}

export async function runCourseSuggestionChecks({ go, login, input, click, waitFor, evaluate, cdp, fixture, academic, calls, errors }) {
  const options = 'document.querySelectorAll(".course-suggestions-list [role=option]")'
  const field = 'document.querySelector("input[name=name]")'
  const press = key => evaluate(field + '.dispatchEvent(new KeyboardEvent("keydown", { key: ' + JSON.stringify(key) + ', bubbles: true, cancelable: true }))')
  const openSuggestions = () => evaluate(field + '.click()')
  await go('/login'); await login(); await waitFor('location.pathname === "/today"')
  await go('/subjects/new'); await waitFor('!!document.querySelector("input[name=name]") && !document.querySelector("input[name=name]").closest("fieldset").disabled')
  await evaluate(field + '.focus()'); await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  assert.equal(await evaluate(field + '.getAttribute("aria-expanded")'), 'false', 'Autofocus and focus alone must not open suggestions')
  assert.equal(await evaluate('!!document.querySelector(".course-suggestions-popup")'), false)
  assert.equal(calls.filter(call => call.route === '/api/v1/catalog/courses').length, 0)
  await openSuggestions(); await waitFor(options + '.length === 20')
  assert.equal(await evaluate(field + '.getAttribute("aria-expanded")'), 'true')
  assert.equal(await evaluate('document.querySelector("select[name=semesterId]").value'), '11')
  await click('.course-suggestions-more'); await waitFor(options + '.length === 26')
  await input('name', 'CSDL'); await waitFor(options + '.length === 1 && document.querySelector(".course-suggestions-list strong").textContent === "Cơ sở dữ liệu"')
  await press('ArrowDown'); await press('Enter')
  assert.equal(await evaluate(field + '.value'), 'Cơ sở dữ liệu')
  assert.equal(await evaluate('document.querySelector("input[name=code]").value'), 'CSDL01')
  assert.equal(await evaluate('document.querySelector("input[name=credits]").value'), '3')
  assert.equal(await evaluate('document.querySelector("select[name=semesterId]").value'), '11', 'Sample semester never changes the personal target semester')
  assert.equal(academic.state.courses.length, 3, 'Selecting a suggestion does not save a course')
  await input('name', 'Cơ sở dữ liệu nâng cao'); await input('code', 'CSDL-TUYCHINH'); await input('credits', '5')
  await click('.course-create-page button[type=submit]'); await waitFor('location.pathname === "/subjects" && document.querySelectorAll(".course-card").length === 4')
  const created = academic.state.courses.find(row => row.kyHieu === 'CSDL-TUYCHINH')
  assert(created && created.soTinChi === 5 && created.maHocKy === 11)
  const save = calls.findLast(call => call.route === '/api/v1/semesters/11/courses' && call.method === 'POST')
  assert.deepEqual(Object.keys(save.body).sort(), ['giangVien', 'kyHieu', 'mauSac', 'soTinChi', 'ten'].sort(), 'Save still uses the existing academic contract')

  await go('/subjects/new'); await waitFor('!!document.querySelector("input[name=name]") && !document.querySelector("input[name=name]").closest("fieldset").disabled')
  await openSuggestions(); await input('name', 'WEB01'); await waitFor(options + '.length === 1')
  await click('.course-suggestions-list [role=option]')
  assert.equal(await evaluate(field + '.value'), 'Lập trình web')
  assert.equal(await evaluate('document.querySelector("input[name=credits]").value'), '4')
  await openSuggestions(); await press('Escape')
  assert.equal(await evaluate('!!document.querySelector(".course-suggestions-popup")'), false)
  await evaluate(field + '.click()'); await waitFor(options + '.length === 1')
  await evaluate('document.querySelector("input[name=teacher]").focus()')
  assert.equal(await evaluate('!!document.querySelector(".course-suggestions-popup")'), false)
  await openSuggestions(); await input('name', 'Môn riêng không có mẫu'); await waitFor('document.querySelector(".course-suggestions-message")?.textContent.includes("Chưa có môn phù hợp")')
  assert.equal(await evaluate(field + '.value'), 'Môn riêng không có mẫu')
  fixture.state.fail = true
  await input('name', 'Không tải được'); await waitFor('!!document.querySelector(".course-suggestions-error")')
  assert.equal(await evaluate('document.querySelector("button[type=submit]").disabled'), false)
  fixture.state.fail = false
  await click('.course-suggestions-error button'); await waitFor('!document.querySelector(".course-suggestions-error") && document.querySelector(".course-suggestions-message")?.textContent.includes("Chưa có môn phù hợp")')
  await input('name', 'Môn tự nhập'); await input('code', 'RIENG01'); await input('credits', '2')
  await click('.course-create-page button[type=submit]'); await waitFor('location.pathname === "/subjects"')
  assert(academic.state.courses.some(row => row.ten === 'Môn tự nhập' && row.kyHieu === 'RIENG01' && row.soTinChi === 2))

  const suggestionReads = calls.filter(call => call.route === '/api/v1/catalog/courses').length
  await click('article:has(a[href="/tasks?subject=201"]) summary')
  await click('article:has(a[href="/tasks?subject=201"]) .action-menu-items button:first-child')
  await waitFor('!!document.querySelector("dialog input[name=name]")')
  assert(!await evaluate('!!document.querySelector("dialog [role=combobox]")'), 'Editing an existing course does not apply suggestions')
  assert.equal(await evaluate('document.querySelector("dialog input[name=code]").value'), 'RIENG01')
  await input('credits', '7'); await click('dialog button[type=submit]'); await waitFor('!document.querySelector("dialog")')
  assert.equal(academic.state.courses.find(row => row.ma === 201).soTinChi, 7)
  assert.equal(calls.filter(call => call.route === '/api/v1/catalog/courses').length, suggestionReads)

  await go('/subjects/new'); await waitFor('!!document.querySelector("input[name=name]") && !document.querySelector("input[name=name]").closest("fieldset").disabled')
  await openSuggestions(); await input('name', 'Cũ')
  await waitFor('document.querySelector(".course-suggestions-message")?.textContent.includes("Đang tìm")')
  await new Promise(resolve => setTimeout(resolve, 250))
  assert(calls.some(call => call.route === '/api/v1/catalog/courses' && new URLSearchParams(call.query).get('tuKhoa') === 'Cũ'))
  await input('name', 'WEB01'); await waitFor(options + '.length === 1 && document.querySelector(".course-suggestions-list strong").textContent === "Lập trình web"')
  await evaluate('new Promise(resolve => setTimeout(resolve, 600))')
  assert.equal(await evaluate('document.querySelector(".course-suggestions-list strong").textContent'), 'Lập trình web')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/course-suggestions.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  assert(await evaluate('(() => { const box = document.querySelector(".course-suggestions-popup").getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth })()'), 'Suggestions fit mobile viewport')
  assert.deepEqual(errors, [])
  assert(calls.filter(call => call.route === '/api/v1/catalog/courses').every(call => call.method === 'GET'))
  console.log('PASS: name focus/search, all-page suggestions, mouse/keyboard selection, editable autofill, unchanged target semester, explicit save, custom entry, error/retry, Escape/outside close, stale request cancellation and mobile layout.')
}
