// Two browser passes: Swagger contract responses through CDP, then the actual
// frontend mock adapter with persistence. Neither pass needs a backend.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { createAcademicFixture, runSubjectChecks } from './browser-subjects.mjs'

const chromePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync)
if (!chromePath) throw new Error('Set CHROME_PATH to a Chromium browser executable.')
const subjectsOnly = process.env.TEST_SUBJECTS_UI === '1' || process.argv.includes('--subjects')
for (const useLocalMock of subjectsOnly ? [false] : [false, true]) {
const tempPrefix = path.join(os.tmpdir(), 'studyplanner-auth-test-')
const userDir = fs.mkdtempSync(tempPrefix)
const vite = await createServer({ define: { 'import.meta.env.VITE_USE_MOCK_API': JSON.stringify(useLocalMock ? 'true' : 'false'), 'import.meta.env.VITE_ENABLE_DEMO_AUTH': JSON.stringify(useLocalMock ? 'false' : 'true') }, server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
let chrome, socket
try {
  await vite.listen()
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + userDir, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  const browserUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('Chrome startup timed out: ' + output.slice(-1000))), 15000)
    chrome.once('error', reject)
    chrome.stderr.on('data', (chunk) => {
      output += chunk
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
  socket = new WebSocket(browserUrl)
  await once(socket, 'open')
  let id = 0
  const pending = new Map()
  const handlers = new Map()
  const debug = process.env.DEBUG_AUTH_BROWSER === '1'
  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data)
    if (debug) console.log('CDP receive', event.id || event.method, event.sessionId || '', event.error || '')
    if (event.id) {
      const task = pending.get(event.id)
      if (!task) return
      clearTimeout(task.timer); pending.delete(event.id)
      if (event.error) task.reject(new Error(JSON.stringify(event.error)))
      else task.resolve(event.result)
    } else handlers.get(event.method)?.(event.params)
  })
  function send(method, params = {}, sessionId) {
    if (debug) console.log('CDP send', method, sessionId || '')
    const requestId = ++id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('CDP timeout: ' + method)) }, 15000)
      pending.set(requestId, { resolve, reject, timer })
      socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cdp = (method, params) => send(method, params, sessionId)
  const calls = []
  const academicFixture = subjectsOnly ? createAcademicFixture() : null
  const errors = []
  let registered = false, password = 'Strong123!', meFailure = 0, patchFailure = 0, expiresIn = 3600
  let profile = { ma: 2, hoTen: 'Nguyễn An', email: 'an@example.com', maSoSinhVien: '', tenTruong: '', tenLop: '', nganhHoc: '', vaiTro: 'Student', dangHoatDong: true }
  const managedUsers = [
    { ma: 11, hoTen: 'Lê Công Minh', email: '0306231307@caothang.edu.vn', maSoSinhVien: '0306231307', tenTruong: 'Cao đẳng Kỹ Thuật Cao Thắng', tenLop: 'CDTH23WEBC', nganhHoc: 'Công nghệ thông tin', vaiTro: 'Student', dangHoatDong: true, ngayTao: '2026-10-30T08:00:00+07:00', ngayCapNhat: '2026-10-30T08:00:00+07:00' },
    { ma: 12, hoTen: 'Trần Hồng Kỳ', email: '0306231303@caothang.edu.vn', maSoSinhVien: '0306231303', tenTruong: 'Cao đẳng Kỹ Thuật Cao Thắng', tenLop: 'CDTH23WEBC', nganhHoc: 'Công nghệ thông tin', vaiTro: 'Student', dangHoatDong: false, ngayTao: '2026-10-31T09:00:00+07:00', ngayCapNhat: '2026-10-31T09:00:00+07:00' },
    { ma: 13, hoTen: 'Quản trị viên', email: 'admin@example.com', maSoSinhVien: null, tenTruong: null, tenLop: null, nganhHoc: null, vaiTro: 'Admin', dangHoatDong: true, ngayTao: '2026-10-31T09:00:00+07:00', ngayCapNhat: '2026-10-31T09:00:00+07:00' },
  ]
  const token = (role) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresIn, role })).toString('base64url') + '.mock'
  let activeRole = 'sinhvien'
  handlers.set('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.text + ': ' + (exceptionDetails.exception?.description || '')))
  handlers.set('Fetch.requestPaused', async ({ requestId, request }) => {
    try {
      const requestUrl = new URL(request.url)
      const route = requestUrl.pathname
      const body = request.postData ? JSON.parse(request.postData) : undefined
      calls.push({ route, query: requestUrl.search, method: request.method, body })
      let status = 200, response
      const academicReply = academicFixture ? await academicFixture.handle(requestUrl, request.method, body) : null
      if (academicReply) { status = academicReply.status; response = academicReply.response }
      else if (route === '/api/v1/auth/register') {
        if (registered) { status = 409; response = { thongBao: 'Email đã tồn tại.' } }
        else {
          registered = true
          profile = { ...profile, hoTen: body.hoTen, email: body.email, maSoSinhVien: body.maSoSinhVien, tenTruong: body.tenTruong, tenLop: body.tenLop, nganhHoc: body.nganhHoc }
          response = profile; status = 201
        }
      } else if (route === '/api/v1/auth/login') {
        if (body.taiKhoan === 'disabled@example.com') { status = 403; response = { code: 'ACCOUNT_DISABLED', thongBao: 'Tài khoản đã bị vô hiệu hóa.' } }
        else if (!['an@example.com', 'admin@example.com', profile.maSoSinhVien].filter(Boolean).includes(body.taiKhoan) || body.matKhau !== password) { status = 401; response = { thongBao: 'Tài khoản hoặc mật khẩu không đúng.' } }
        else {
          activeRole = body.taiKhoan === 'admin@example.com' ? 'admin' : 'sinhvien'
          const tokenTruyCap = token(activeRole)
          response = { tokenTruyCap, loaiToken: 'Bearer', hetHanLuc: new Date((JSON.parse(Buffer.from(tokenTruyCap.split('.')[1], 'base64url').toString()).exp) * 1000).toISOString(), nguoiDung: { ...profile, vaiTro: activeRole === 'admin' ? 'Admin' : 'Student' } }
        }
      } else if (route === '/api/v1/users/me' && request.method === 'PATCH') {
        if (patchFailure) { status = patchFailure; response = { thongBao: 'Phiên đăng nhập đã hết hiệu lực.' } }
        else { profile = { ...profile, ...body }; response = profile; status = 200 }
      } else if (route === '/api/v1/users/me') {
        status = meFailure || 200
        response = status === 200 ? { ...profile, vaiTro: activeRole === 'admin' ? 'Admin' : 'Student', ...(activeRole === 'admin' ? { email: 'admin@example.com', hoTen: 'Quản trị viên' } : {}) } : { thongBao: 'Không tải được hồ sơ.' }
      } else if (route === '/api/v1/users/me/change-password') {
        if (body.matKhauHienTai !== password) { status = 401; response = { detail: 'Thông tin xác thực không hợp lệ.', code: 'INVALID_CREDENTIALS' } }
        else { password = body.matKhauMoi; status = 200; response = { thongBao: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' } }
      } else if (route === '/api/v1/admin/users' || route.startsWith('/api/v1/admin/users/')) {
        const authorization = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'authorization')?.[1]
        let role
        try { role = JSON.parse(Buffer.from(authorization.split(' ')[1].split('.')[1], 'base64url').toString()).role } catch { /* Missing/invalid credentials are rejected below. */ }
        if (role !== 'admin') { status = role ? 403 : 401; response = { thongBao: 'Tài khoản không có quyền quản trị.' } }
        else if (route === '/api/v1/admin/users') {
          const query = requestUrl.searchParams
          const keyword = (query.get('TuKhoa') || '').trim().toLowerCase()
          const active = query.get('DangHoatDong')
          const users = managedUsers.filter((user) => (!keyword || `${user.hoTen} ${user.email} ${user.maSoSinhVien || ''}`.toLowerCase().includes(keyword)) && (active === null || user.dangHoatDong === (active === 'true')))
          const trang = Number(query.get('Trang') || 1), kichThuocTrang = Number(query.get('KichThuocTrang') || 20)
          response = { danhSach: users.slice((trang - 1) * kichThuocTrang, trang * kichThuocTrang), trang, kichThuocTrang, tongSo: users.length }
        } else {
          const match = route.match(/^\/api\/v1\/admin\/users\/(\d+)(?:\/(activate|deactivate))?$/)
          const user = match && managedUsers.find((item) => item.ma === Number(match[1]))
          if (!user) { status = 404; response = { thongBao: 'Không tìm thấy người dùng.' } }
          else if (request.method === 'PATCH' && match[2]) {
            user.dangHoatDong = match[2] === 'activate'
            response = { thongBao: user.dangHoatDong ? 'Kích hoạt tài khoản thành công.' : 'Vô hiệu hóa tài khoản thành công.', dangHoatDong: user.dangHoatDong }
          } else response = user
        }
      } else { status = 404; response = { message: 'Unexpected test endpoint' } }
      await cdp('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], ...(response === undefined ? {} : { body: Buffer.from(JSON.stringify(response)).toString('base64') }) })
    } catch (error) {
      // StrictMode or navigation can abort a paused fetch before it is fulfilled.
      if (!String(error).includes('Invalid InterceptionId')) errors.push(String(error))
    }
  })
  await cdp('Runtime.enable')
  await cdp('Page.enable')
  if (!useLocalMock) await cdp('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/v1/*' }] })
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function waitFor(expression) {
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      const value = await evaluate(expression)
      if (value) return value
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error('Wait failed: ' + expression + '\nPage: ' + await evaluate('document.body.innerText'))
  }
  const go = async (route) => { await cdp('Page.navigate', { url: origin + route }); await waitFor('document.querySelector("#root")?.children.length > 0') }
  const click = async (selector) => {
    await waitFor('!!document.querySelector(' + JSON.stringify(selector) + ')')
    await evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()')
  }
  const input = async (name, value) => {
    await waitFor('!!document.querySelector(' + JSON.stringify('input[name="' + name + '"]') + ')')
    await evaluate(`(() => { const input = document.querySelector('input[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  }
  const select = async (selector, value) => {
    await waitFor('!!document.querySelector(' + JSON.stringify(selector) + ')')
    await evaluate(`(() => { const field = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  }
  const searchUsers = async (value) => {
    await evaluate(`(() => { const field = document.querySelector('.admin-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  }
  const userRows = 'document.querySelectorAll(".admin-students-table tbody tr:has(.admin-account-actions)").length'
  async function login(taiKhoan = 'an@example.com', currentPassword = password) {
    await input('taiKhoan', taiKhoan); await input('password', currentPassword)
    await click('button[type="submit"]')
  }
  async function openProfile() { await click('a[href="/profile"]'); await waitFor('!!document.querySelector("input[name=className]")') }
  async function checkSidebarToggle() {
    await waitFor('!!document.querySelector(".sidebar-toggle")')
    const expandedWidth = await evaluate('document.querySelector(".sidebar").getBoundingClientRect().width')
    const workspaceWidth = await evaluate('document.querySelector(".workspace").getBoundingClientRect().width')
    assert.equal(await evaluate('document.querySelector(".sidebar-toggle").getAttribute("aria-expanded")'), 'true')
    await click('.sidebar-toggle')
    await waitFor('document.querySelector(".sidebar-toggle").getAttribute("aria-expanded") === "false"')
    assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().width'), 68)
    assert(await evaluate('document.querySelector(".workspace").getBoundingClientRect().width') > workspaceWidth)
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".study-brand-sidebar > span")).display'), 'none')
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".student-profile-info")).display'), 'none')
    assert(await evaluate(`document.querySelector('.sidebar a[aria-label="Đăng xuất"]').getClientRects().length > 0`))
    await click('.sidebar .flow-sidebar-tools a[href="/subjects"]')
    await waitFor(at('/subjects'))
    assert.equal(await evaluate('document.querySelector(".sidebar-toggle").getAttribute("aria-expanded")'), 'false')
    assert.equal(await evaluate(`document.querySelector('.sidebar a[href="/subjects"]').getAttribute('aria-current')`), 'page')
    await click('.sidebar-toggle')
    await waitFor('document.querySelector(".sidebar-toggle").getAttribute("aria-expanded") === "true"')
    assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().width'), expandedWidth)
    assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".student-profile-info")).display'), 'none')
    await click('.sidebar a[href="/today"]')
    await waitFor(at('/today'))
  }
  const alertHas = (text) => 'document.querySelector("[role=alert]")?.textContent.includes(' + JSON.stringify(text) + ')'
  const at = (route) => 'location.pathname === ' + JSON.stringify(route)
  const registrationFields = { fullName: useLocalMock ? 'Sinh viên kiểm thử' : 'Nguyễn An', email: useLocalMock ? 'frontend-test@example.com' : 'an@example.com', studentCode: useLocalMock ? '0991234567' : '0306231307', schoolName: 'Cao đẳng Kỹ Thuật Cao Thắng', className: 'CDTH23WEBC', major: 'Công nghệ thông tin' }
  async function fillRegistration() {
    for (const [field, value] of Object.entries(registrationFields)) await input(field, value)
    await input('password', password); await input('confirmPassword', password)
  }

  if (subjectsOnly) {
    await runSubjectChecks({ go, input, click, select, waitFor, evaluate, cdp, login, fixture: academicFixture, calls, errors })
  } else if (useLocalMock) {
    const networkAuthCalls = []
    handlers.set('Network.requestWillBeSent', ({ request }) => {
      if (new URL(request.url).pathname.startsWith('/api/v1/')) networkAuthCalls.push(request.url)
    })
    await cdp('Network.enable')

    await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
    await login('demo@studyplanner.vn', '123456'); await waitFor(at('/today'))
    await checkSidebarToggle()
    await openProfile()
    assert.equal(await evaluate('document.querySelector(".profile-form-panel fieldset").disabled'), false)
    assert.equal(await evaluate('document.querySelector(".profile-password-panel fieldset").disabled'), false)
    assert.equal(await evaluate('document.querySelector("input[name=studentCode]").value'), 'SVDEMO001')
    assert.equal(await evaluate('document.querySelector("input[name=studentCode]").readOnly'), false)
    assert(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'))
    await click('.profile-summary button'); await waitFor(at('/login'))
    await go('/admin'); await waitFor('document.body.innerText.includes("Đăng nhập admin")')
    await login('admin@studyplanner.vn', '123456'); await waitFor(at('/admin/students'))
    await waitFor('!!document.querySelector(".admin-students-table")')
    await click('.admin-logout'); await waitFor(at('/admin'))

    await go('/register'); await waitFor('!!document.querySelector("input[name=fullName]")')
    await fillRegistration(); await click('button[type="submit"]'); await waitFor(at('/login'))
    await waitFor('document.body.innerText.includes("Đăng ký thành công")')
    // Account data survives a page reload before any session has been created.
    await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
    await click('a[href="/register"]'); await waitFor('!!document.querySelector("input[name=fullName]")')
    await fillRegistration(); await input('studentCode', '0991234568')
    await click('button[type="submit"]'); await waitFor('!!document.querySelector("[role=alert]") && /email/i.test(document.querySelector("[role=alert]").textContent)')
    await input('email', 'frontend-other@example.com'); await input('studentCode', registrationFields.studentCode)
    await click('button[type="submit"]'); await waitFor('!!document.querySelector("[role=alert]") && /MSSV|mã sinh viên/i.test(document.querySelector("[role=alert]").textContent)')

    await click('a[href="/login"]'); await waitFor(at('/login'))
    await login(registrationFields.email); await waitFor(at('/today'))
    const firstToken = JSON.parse(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")')).token
    await openProfile()
    assert.equal(await evaluate('document.querySelector("input[name=email]").readOnly'), true)
    assert.equal(await evaluate('document.querySelector("input[name=studentCode]").readOnly'), false)
    assert.equal(await evaluate('document.querySelector("input[name=studentCode]").value'), '0991234567')
    const updatedProfile = { fullName: 'Sinh viên đã cập nhật', schoolName: 'Cao đẳng Kỹ Thuật Cao Thắng', className: 'CDTH23WEBC-TEST', major: 'Công nghệ thông tin đã cập nhật' }
    for (const [field, value] of Object.entries(updatedProfile)) await input(field, value)
    await click('.profile-form-panel button[type="submit"]'); await waitFor('document.body.innerText.includes("Đã lưu hồ sơ.")')
    assert((await evaluate('document.querySelector(".profile-summary").innerText')).includes(updatedProfile.fullName))
    await go('/profile'); await waitFor('!!document.querySelector("input[name=className]")')
    for (const [field, value] of Object.entries(updatedProfile)) assert.equal(await evaluate('document.querySelector(' + JSON.stringify('input[name="' + field + '"]') + ').value'), value, field)
    assert.equal(await evaluate('document.querySelector("input[name=studentCode]").value'), registrationFields.studentCode)
    await click('.profile-summary button'); await waitFor(at('/login'))

    await login(registrationFields.studentCode); await waitFor(at('/today'))
    const currentToken = JSON.parse(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")')).token
    await openProfile()
    const changedPassword = 'NewStrong123!'
    await input('currentPassword', 'wrong-password'); await input('newPassword', changedPassword); await input('confirmPassword', changedPassword)
    await click('.profile-password-panel button[type="submit"]'); await waitFor(at('/login'))
    assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
    await login(registrationFields.studentCode); await waitFor(at('/today')); await openProfile()
    await input('currentPassword', password); await input('newPassword', changedPassword); await input('confirmPassword', 'mismatch')
    await click('.profile-password-panel button[type="submit"]'); await waitFor(alertHas('không khớp'))
    await input('confirmPassword', changedPassword); await click('.profile-password-panel button[type="submit"]'); await waitFor(at('/login'))
    assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
    await waitFor('document.body.innerText.includes("Đổi mật khẩu thành công")')
    const revokedStatuses = await evaluate(`(async () => { const { getCurrentUser } = await import('/src/api/auth.ts'); const statuses = []; for (const token of ${JSON.stringify([firstToken, currentToken])}) { try { await getCurrentUser(token); statuses.push(200) } catch (error) { statuses.push(error.status) } } return statuses })()`)
    assert.deepEqual(revokedStatuses, [401, 401], 'Changing password must revoke every older token for this account')
    await login(registrationFields.email, password); await waitFor(alertHas('không đúng'))
    assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
    await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
    await login(registrationFields.studentCode, changedPassword); await waitFor(at('/today'))
    await go('/profile'); await waitFor('!!document.querySelector("input[name=className]")')
    assert.equal(await evaluate('document.querySelector("input[name=className]").value'), updatedProfile.className)
    await click('.profile-summary button'); await waitFor(at('/login'))

    // Admin uses the same local account database as registration and profile editing.
    await go('/admin'); await waitFor('document.body.innerText.includes("Đăng nhập admin")')
    await login('admin@caothang.edu.vn', '0306231303'); await waitFor(at('/admin/students'))
    await waitFor(userRows + ' === 6')
    assert((await evaluate('document.querySelector(".admin-students-table").innerText')).includes(updatedProfile.fullName))
    assert((await evaluate('document.querySelector(".admin-students-table").innerText')).includes('Quản trị viên'))
    assert(!await evaluate('!!document.querySelector(".admin-stats")'))
    await select('.admin-page-size select', '5'); await waitFor(userRows + ' === 5')
    await click('.admin-pagination button[aria-label="Trang sau"]'); await waitFor('new URLSearchParams(location.search).get("Trang") === "2" && ' + userRows + ' === 1')
    await click('.admin-pagination button[aria-label="Trang trước"]'); await waitFor(userRows + ' === 5')
    await searchUsers('0306231303'); await waitFor(userRows + ' === 1 && document.querySelector(".admin-students-table").innerText.includes("Trần Hồng Kỳ")')
    await select('.admin-status-filter select', 'locked'); await waitFor(userRows + ' === 1 && new URLSearchParams(location.search).get("DangHoatDong") === "false"')
    const kyLink = await waitFor('document.querySelector(".admin-students-table tbody a")?.getAttribute("href")')
    assert.match(kyLink, /^\/admin\/students\/\d+/)
    await click('.admin-students-table tbody a'); await waitFor('!!document.querySelector(".admin-student-details")')
    await waitFor('document.querySelector(".admin-student-details").innerText.includes("CDTH23WEBC")')
    assert((await evaluate('document.querySelector(".admin-student-details").innerText')).includes('Cao đẳng Kỹ Thuật Cao Thắng'))
    assert((await evaluate('document.querySelector(".admin-topbar").innerText')).includes('Tài khoản sinh viên'))
    assert((await evaluate('document.querySelector(".admin-topbar").innerText')).includes('Chi tiết sinh viên'))
    await go(kyLink); await waitFor('!!document.querySelector(".admin-student-details")')
    await click('.admin-student-details button'); await waitFor('document.body.innerText.includes("Kích hoạt tài khoản thành công.")')
    const kyToken = await evaluate(`(async () => { const { loginAccount } = await import('/src/api/auth.ts'); return (await loginAccount('0306231303', '123456', 'sinhvien')).token })()`)
    await click('.admin-student-details button'); await waitFor('document.body.innerText.includes("Vô hiệu hóa tài khoản thành công.")')
    const blockedKy = await evaluate(`(async () => { const { loginAccount, getCurrentUser } = await import('/src/api/auth.ts'); const statuses = []; for (const action of [() => getCurrentUser(${JSON.stringify(kyToken)}), () => loginAccount('0306231303@caothang.edu.vn', '123456', 'sinhvien')]) { try { await action(); statuses.push(200) } catch (error) { statuses.push(error.status) } } return statuses })()`)
    assert.deepEqual(blockedKy, [401, 401], 'Deactivation must revoke existing tokens and block new logins')
    await click('.admin-student-details button'); await waitFor('document.body.innerText.includes("Kích hoạt tài khoản thành công.")')
    const reactivatedKy = await evaluate(`(async () => { const { loginAccount, getCurrentUser } = await import('/src/api/auth.ts'); let previousStatus; try { await getCurrentUser(${JSON.stringify(kyToken)}); previousStatus = 200 } catch (error) { previousStatus = error.status } return { previousStatus, email: (await loginAccount('0306231303', '123456', 'sinhvien')).user.email } })()`)
    assert.deepEqual(reactivatedKy, { previousStatus: 401, email: '0306231303@caothang.edu.vn' }, 'Activation allows a fresh login without restoring revoked tokens')
    await click('.admin-back-link'); await waitFor(at('/admin/students'))
    await waitFor('new URLSearchParams(location.search).get("TuKhoa") === "0306231303" && new URLSearchParams(location.search).get("DangHoatDong") === "false"')
    await waitFor(userRows + ' === 0')
    await select('.admin-status-filter select', 'all'); await waitFor(userRows + ' === 1')
    await searchUsers(registrationFields.email); await waitFor(userRows + ' === 1 && document.querySelector(".admin-students-table").innerText.includes(' + JSON.stringify(updatedProfile.fullName) + ')')
    await click('.admin-students-table tbody a'); await waitFor('!!document.querySelector(".admin-student-details")')
    assert((await evaluate('document.querySelector(".admin-student-details").innerText')).includes(updatedProfile.className))
    await click('.admin-logout'); await waitFor(at('/admin'))
    await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
    await login('0306231303', '123456'); await waitFor(at('/today'))
    await openProfile(); await waitFor('document.querySelector("input[name=studentCode]").value === "0306231303"')
    assert.equal(await evaluate('document.querySelector("input[name=fullName]").value'), 'Trần Hồng Kỳ')
    await click('.profile-summary button'); await waitFor(at('/login'))
    assert.deepEqual(networkAuthCalls, [], 'The frontend mock must work without any HTTP authentication requests')
    assert.deepEqual(errors, [])
    console.log('PASS: local frontend auth/profile persistence and admin shared accounts, pagination, search/filter, direct detail routes, activation/deactivation and token revocation without backend HTTP.')
  } else {
  await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
  await login('demo@studyplanner.vn', 'wrong-password'); await waitFor(alertHas('không đúng'))
  await login('demo@studyplanner.vn', '123456'); await waitFor(at('/today'))
  await checkSidebarToggle()
  await waitFor('document.body.innerText.includes("Sinh viên mẫu")')
  assert.equal(await evaluate('document.querySelector(".sidebar nav a").getAttribute("href")'), '/today')
  assert.equal(await evaluate('document.querySelector(".sidebar nav a[aria-current=page]").getAttribute("href")'), '/today')
  await go('/'); await waitFor(at('/today'))
  await waitFor('document.querySelector(".topbar .flow-top-location strong")?.textContent === "Hôm nay"')
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  assert.equal(calls.length, 0, 'Demo login must not contact the backend')
  await openProfile()
  assert.equal(await evaluate('document.querySelector(".profile-form-panel fieldset").disabled'), true)
  assert.equal(await evaluate('document.querySelector(".profile-password-panel fieldset").disabled'), true)
  await go('/profile'); await waitFor('document.body.innerText.includes("Sinh viên mẫu")')
  assert.equal(calls.length, 0, 'Demo restoration must not contact the backend')
  await go('/admin/students/demo-student-1'); await waitFor(at('/today'))
  await openProfile(); await click('.profile-summary button'); await waitFor(at('/login'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.demo.v1")'), null)

  await go('/admin'); await waitFor('document.body.innerText.includes("Đăng nhập admin")')
  await login('admin@studyplanner.vn', 'wrong-password'); await waitFor(alertHas('không đúng'))
  await login('admin@studyplanner.vn', '123456'); await waitFor(at('/admin/students'))
  await waitFor('document.body.innerText.includes("Quản trị viên")')
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  await waitFor('!!document.querySelector("[role=alert]")')
  assert(!await evaluate('!!document.querySelector(".admin-stats")'))
  await click('a[href="/admin/overview"]'); await waitFor(at('/admin/overview'))
  await waitFor('document.querySelector(".admin-topbar strong")?.textContent === "Tổng quan"')
  assert.equal(await evaluate('document.querySelector("#admin-content").innerHTML'), '')
  assert.equal(await evaluate('document.querySelector(".admin-sidebar a[aria-current=page]").getAttribute("href")'), '/admin/overview')
  await go('/admin/overview'); await waitFor('!!document.querySelector("#admin-content")')
  assert.equal(await evaluate('document.querySelector("#admin-content").innerHTML'), '')
  await click('a[href="/admin/priority-rules"]'); await waitFor(at('/admin/priority-rules'))
  await waitFor('document.querySelector(".admin-topbar strong")?.textContent === "Quy tắc ưu tiên"')
  assert.equal(await evaluate('document.querySelector("#admin-content").innerHTML'), '')
  assert.equal(await evaluate('document.querySelector(".admin-sidebar a[aria-current=page]").getAttribute("href")'), '/admin/priority-rules')
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".admin-sidebar nav a")].map((link) => link.getAttribute("href"))'), ['/admin/overview', '/admin/students', '/admin/priority-rules'])
  await go('/admin/priority-rules'); await waitFor('!!document.querySelector("#admin-content")')
  assert.equal(await evaluate('document.querySelector("#admin-content").innerHTML'), '')
  await click('a[href="/admin/students"]'); await waitFor('!!document.querySelector("[role=alert]")')
  assert.equal(calls.length, 0, 'Admin demo login and restoration must not contact the backend')
  await go('/tasks'); await waitFor(at('/admin/students'))
  await click('.admin-logout'); await waitFor(at('/admin'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.demo.v1")'), null)

  await go('/profile'); await waitFor(at('/login'))
  await click('a[href="/register"]'); await waitFor('!!document.querySelector("input[name=fullName]")')
  await fillRegistration()
  for (const field of [...Object.keys(registrationFields), 'password', 'confirmPassword']) assert.equal(await evaluate('document.querySelector(' + JSON.stringify('input[name="' + field + '"]') + ').required'), true, field)
  for (const [field, message] of [['studentCode', 'MSSV'], ['schoolName', 'tên trường'], ['className', 'tên lớp'], ['major', 'ngành học']]) {
    await input(field, ' '); await click('button[type="submit"]'); await waitFor(alertHas(message))
    assert.equal(calls.filter((call) => call.route.includes('/register')).length, 0)
    await input(field, registrationFields[field])
  }
  await input('fullName', ' Nguyễn An '); await input('email', 'AN@example.com'); await input('confirmPassword', 'mismatch')
  await click('button[type="submit"]'); await waitFor(alertHas('không khớp'))
  assert.equal(calls.filter((call) => call.route.includes('/register')).length, 0)
  await input('confirmPassword', password); await click('button[type="submit"]'); await waitFor(at('/login'))
  assert.deepEqual(calls.find((call) => call.route.includes('/register')).body, { hoTen: registrationFields.fullName, email: registrationFields.email, maSoSinhVien: registrationFields.studentCode, tenTruong: registrationFields.schoolName, tenLop: registrationFields.className, nganhHoc: registrationFields.major, matKhau: password })
  assert((await evaluate('document.body.innerText')).includes('Đăng ký thành công'))
  await click('a[href="/register"]'); await waitFor('!!document.querySelector("input[name=fullName]")')
  await fillRegistration()
  await click('button[type="submit"]'); await waitFor(alertHas('Email đã tồn tại'))
  await click('a[href="/login"]'); await waitFor(at('/login'))
  await login('an@example.com', 'bad-password'); await waitFor(alertHas('không đúng'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  await login('disabled@example.com'); await waitFor(alertHas('vô hiệu hóa'))
  await login('0306231307'); await waitFor(at('/today'))
  assert.deepEqual(calls.filter((call) => call.route.includes('/auth/login')).at(-1).body, { taiKhoan: '0306231307', matKhau: password })
  assert.deepEqual(Object.keys(JSON.parse(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'))).sort(), ['expiresAt', 'token'])
  await openProfile()
  assert.equal(await evaluate('document.querySelector("input[name=email]").readOnly'), true)
  assert.equal(await evaluate('document.querySelector("input[name=studentCode]").readOnly'), false)
  await input('fullName', 'Nguyễn An mới'); await input('schoolName', 'Trường Đại học'); await input('className', 'CNTT02'); await input('major', 'Công nghệ thông tin')
  await click('.profile-form-panel button[type="submit"]'); await waitFor('document.body.innerText.includes("Đã lưu hồ sơ.")')
  assert((await evaluate('document.querySelector(".profile-summary").innerText')).includes('Nguyễn An mới'))
  assert.deepEqual(calls.find((call) => call.method === 'PATCH').body, { hoTen: 'Nguyễn An mới', maSoSinhVien: registrationFields.studentCode, tenTruong: 'Trường Đại học', tenLop: 'CNTT02', nganhHoc: 'Công nghệ thông tin' })
  await go('/profile'); await waitFor('!!document.querySelector("input[name=className]")')
  assert.equal(await evaluate('document.querySelector("input[name=className]").value'), 'CNTT02')
  await input('currentPassword', 'wrong'); await input('newPassword', 'NewStrong123!'); await input('confirmPassword', 'NewStrong123!')
  await click('.profile-password-panel button[type="submit"]'); await waitFor(at('/login'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  await login(); await waitFor(at('/today')); await openProfile()
  await input('currentPassword', password); await input('newPassword', 'NewStrong123!'); await input('confirmPassword', 'NewStrong123!')
  await click('.profile-password-panel button[type="submit"]'); await waitFor(at('/login'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  assert((await evaluate('document.body.innerText')).includes('Đổi mật khẩu thành công'))
  await login('an@example.com', 'Strong123!'); await waitFor(alertHas('không đúng'))
  await login(); await waitFor(at('/today')); await openProfile()
  patchFailure = 401
  await click('.profile-form-panel button[type="submit"]'); await waitFor(at('/login'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  patchFailure = 0
  await login(); await waitFor(at('/today'))
  meFailure = 503
  await go('/profile'); await waitFor('document.body.innerText.includes("Thử lại")')
  assert(!await evaluate('!!document.querySelector("input[name=className]")'))
  meFailure = 0
  await click('.auth-session-state .button-primary'); await waitFor('!!document.querySelector("input[name=className]")')
  meFailure = 403
  await go('/profile'); await waitFor(at('/login'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  meFailure = 0
  await go('/admin'); await waitFor('document.body.innerText.includes("Đăng nhập admin")')
  await login(); await waitFor(alertHas('không có quyền quản trị'))
  await login('admin@example.com'); await waitFor(at('/admin/students'))
  await waitFor(userRows + ' === 3')
  assert((await evaluate('document.querySelector(".admin-students-table").innerText')).includes('Lê Công Minh'))
  assert((await evaluate('document.querySelector(".admin-students-table").innerText')).includes('Quản trị viên'))
  const listCall = calls.find((call) => call.route === '/api/v1/admin/users')
  assert.equal(new URLSearchParams(listCall.query).get('Trang'), '1')
  assert.equal(new URLSearchParams(listCall.query).get('KichThuocTrang'), '20')
  await searchUsers('0306231303'); await waitFor(userRows + ' === 1 && document.querySelector(".admin-students-table").innerText.includes("Trần Hồng Kỳ")')
  await select('.admin-status-filter select', 'locked'); await waitFor(userRows + ' === 1 && new URLSearchParams(location.search).get("DangHoatDong") === "false"')
  await click('.admin-students-table tbody a'); await waitFor('!!document.querySelector(".admin-student-details")')
  assert(calls.some((call) => call.route === '/api/v1/admin/users/12' && call.method === 'GET'))
  await click('.admin-student-details button'); await waitFor('document.body.innerText.includes("Kích hoạt tài khoản thành công.")')
  assert.deepEqual(calls.find((call) => call.route === '/api/v1/admin/users/12/activate'), { route: '/api/v1/admin/users/12/activate', query: '', method: 'PATCH', body: undefined })
  await go('/admin/students/12'); await waitFor('!!document.querySelector(".admin-student-details")')
  assert((await evaluate('document.querySelector(".admin-student-details .admin-status").innerText')).includes('Đang hoạt động'))
  await click('.admin-student-details button'); await waitFor('document.body.innerText.includes("Vô hiệu hóa tài khoản thành công.")')
  assert(calls.some((call) => call.route === '/api/v1/admin/users/12/deactivate' && call.method === 'PATCH' && call.body === undefined))
  await go('/admin/students/demo-student-1'); await waitFor('document.querySelector("#student-details-title")?.textContent === "Không tìm thấy sinh viên"')
  assert(!await evaluate('!!document.querySelector(".admin-student-details")'))
  await go('/tasks'); await waitFor(at('/admin/students'))
  await click('.admin-logout'); await waitFor(at('/admin'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  expiresIn = 2
  await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
  await login(); await waitFor(at('/today')); await waitFor(at('/login'))
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  assert((await evaluate('document.body.innerText')).includes('hết hạn'))
  assert.deepEqual(errors, [])
  console.log('PASS: Swagger v1 Vietnamese DTO contract, student/admin demo navigation, registration, login, profile, password change and JWT expiry (' + calls.length + ' intercepted requests).')
  }
} finally {
  socket?.close()
  chrome?.kill()
  await vite.close()
  // Delete only this test's freshly created temporary browser profile.
  const resolved = path.resolve(userDir)
  if (resolved.startsWith(path.resolve(tempPrefix)) && path.dirname(resolved) === path.resolve(os.tmpdir())) {
    try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* Chrome may briefly retain file handles. */ }
  }
}
}
