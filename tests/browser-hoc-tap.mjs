import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

// Browser fixture exercises the production routes and forms without writing to a user's database.
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync)
assert(browserPath, 'A Chromium browser is required')
const tempPrefix = path.join(os.tmpdir(), 'studyplanner-core-ui-')
const userDir = fs.mkdtempSync(tempPrefix)
const vite = await createServer({ define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
let browser, socket
try {
  await vite.listen()
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + userDir, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('Browser startup timed out')), 20000)
    browser.once('error', reject)
    browser.stderr.on('data', chunk => {
      output += chunk
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
  socket = new WebSocket(endpoint)
  await once(socket, 'open')
  const waiting = new Map()
  const handlers = new Map()
  let counter = 0
  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data)
    if (event.id) {
      const task = waiting.get(event.id)
      if (!task) return
      clearTimeout(task.timer); waiting.delete(event.id)
      if (event.error) task.reject(new Error(JSON.stringify(event.error)))
      else task.resolve(event.result)
    } else handlers.get(event.method)?.(event.params)
  })
  function send(method, params = {}, sessionId) {
    const id = ++counter
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error('Browser timeout: ' + method)) }, 20000)
      waiting.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cdp = (method, params) => send(method, params, sessionId)
  const errors = []
  const calls = []
  const user = { ma: 2, hoTen: 'Sinh viên kiểm thử', email: 'core@example.test', maSoSinhVien: 'SVTEST', tenTruong: 'Trường kiểm thử', tenLop: 'CNTT', nganhHoc: 'CNTT', vaiTro: 'Student', dangHoatDong: true, muiGio: 'Asia/Ho_Chi_Minh' }
  const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, role: 'Student' })).toString('base64url') + '.fixture'
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const makeTask = (ma, body = {}) => ({ ma, maHocKy: 103, maMonHoc: 207, maNhiemVuCha: null, tieuDe: 'Ôn cơ sở dữ liệu', moTa: null, loai: 'Assignment', mucDoUuTien: 'Medium', hanHoanThanh: null, hanHieuLuc: null, maNhiemVuNguonHan: null, batDauSuKien: null, ketThucSuKien: null, trangThai: 'NotStarted', tienDo: 0, thoiLuongDuKienPhut: 50, thoiLuongConLaiPhut: 50, coNhiemVuCon: false, nhacTruocGio: null, ...body })
  const tasks = [
    makeTask(1, { tieuDe: 'aaa', maHocKy: null, maMonHoc: null, loai: 'Personal', coNhiemVuCon: true }),
    makeTask(2, { tieuDe: 'aa', maHocKy: null, maMonHoc: null, loai: 'Personal', maNhiemVuCha: 1 }),
    makeTask(3, { tieuDe: 'vbbbb', maHocKy: null, maMonHoc: null, loai: 'Personal' }),
    makeTask(4, { mucDoUuTien: 'High' }),
  ]
  let nextTask = 5
  const histories = []
  let taskReadFailure = false
  function remember(task, action, before = null) {
    histories.push({ ma: histories.length + 1, maNhiemVu: task.ma, tieuDeNhiemVu: task.tieuDe, hanhDong: action, nguonThayDoi: 'User', ngayThayDoi: new Date().toISOString(), duLieuTruoc: before, duLieuSau: JSON.stringify(task) })
  }
  function branch(id) {
    const ids = new Set([id])
    for (let depth = 0; depth < 10; depth++) for (const t of tasks) if (ids.has(t.maNhiemVuCha)) ids.add(t.ma)
    return tasks.filter(t => ids.has(t.ma))
  }
  let revision = 5
  let availability = []
  let classes = []
  let confirmClassOverlap = true
  let sessions = []
  let applied = false
  let loseApplyResponse = true
  const envelope = duLieu => ({ phienBan: revision, duLieu })
  const page = danhSach => ({ danhSach, trang: 1, kichThuocTrang: 100, tongSo: danhSach.length })
  let failNextDelete = false
  handlers.set('Page.javascriptDialogOpening', () => {
    errors.push('Unexpected native browser dialog')
    void cdp('Page.handleJavaScriptDialog', { accept: false })
  })
  handlers.set('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text))
  handlers.set('Fetch.requestPaused', async ({ requestId, request }) => {
    try {
      const url = new URL(request.url)
      const route = url.pathname.replace('/api/v1', '')
      const body = request.postData ? JSON.parse(request.postData) : undefined
      const method = request.method
      calls.push({ route, query: url.searchParams.toString(), method, body, headers: request.headers })
      let status = 200, response
      if (route === '/auth/login') response = { tokenTruyCap: token, loaiToken: 'Bearer', hetHanLuc: new Date(Date.now() + 3600000).toISOString(), nguoiDung: user }
      else if (route === '/users/me') response = user
      else if (route === '/semesters') response = page([{ ma: 103, ten: 'Học kỳ thực hành', ngayBatDau: '2026-01-01', ngayKetThuc: '2027-12-31' }])
      else if (route === '/semesters/103/courses') response = page([{ ma: 207, maHocKy: 103, ten: 'Cơ sở dữ liệu', kyHieu: 'CSDL', soTinChi: 3, giangVien: null, mauSac: '#306BB5' }])
      else if (route === '/tasks' && method === 'GET') {
        const q = url.searchParams
        let list = tasks.filter(t => (q.get('chiLa') === 'true' || ['today', 'upcoming', 'overdue', 'undated', 'completed'].includes(q.get('cheDo')) ? !t.coNhiemVuCon : !t.maNhiemVuCha))
        if (q.has('maHocKy')) list = list.filter(t => String(t.maHocKy) === q.get('maHocKy'))
        if (q.has('maMonHoc')) list = list.filter(t => String(t.maMonHoc) === q.get('maMonHoc'))
        if (q.get('cheDo') === 'inbox') list = list.filter(t => t.maHocKy === null && t.maMonHoc === null)
        if (q.get('cheDo') === 'completed') list = list.filter(t => t.trangThai === 'Completed')
        else if (!q.has('trangThai')) list = list.filter(t => t.trangThai !== 'Completed')
        for (const key of ['mucDoUuTien', 'loai', 'trangThai']) if (q.has(key)) list = list.filter(t => t[key] === q.get(key))
        if (q.get('tuKhoa')) list = list.filter(t => t.tieuDe.toLowerCase().includes(q.get('tuKhoa').toLowerCase()))
        if (q.get('sapXep') === 'created') list.sort((a, b) => b.ma - a.ma)
        response = envelope(page(list))
        if (taskReadFailure) { status = 503; response = { detail: 'Dịch vụ nhiệm vụ đang gián đoạn.' } }
      } else if (route === '/tasks' && method === 'POST') {
        revision++; const task = makeTask(nextTask++, body); tasks.push(task); remember(task, 'Created'); response = envelope(task); status = 201
      } else if (route.endsWith('/change-preview')) response = envelope({ maPhienBiHuy: [], phienBiAnhHuong: [], lichHocTrung: [], canKetThucPhienDangHoc: false })
      else if (/^\/tasks\/\d+\/tree$/.test(route)) {
        const id = Number(route.split('/')[2]); response = envelope(branch(id))
      } else if (/^\/tasks\/\d+\/children$/.test(route)) {
        const parent = tasks.find(t => t.ma === Number(route.split('/')[2])); parent.coNhiemVuCon = true
        const children = body.danhSach.map(item => makeTask(nextTask++, { ...item, maNhiemVuCha: parent.ma }))
        tasks.push(...children); children.forEach(t => remember(t, 'Created')); revision++; response = envelope(children); status = 201
      } else if (/^\/tasks\/\d+\/progress$/.test(route)) {
        const task = tasks.find(t => t.ma === Number(route.split('/')[2])); const before = JSON.stringify(task); task.tienDo = body.tienDo; task.trangThai = body.tienDo === 100 ? 'Completed' : body.tienDo ? 'InProgress' : 'NotStarted'; remember(task, 'Updated', before); revision++; response = envelope(task)
      } else if (/^\/tasks\/\d+\/(parent|scope|complete|reopen)$/.test(route)) {
        const task = tasks.find(t => t.ma === Number(route.split('/')[2])); const before = JSON.stringify(task)
        if (route.endsWith('/parent')) task.maNhiemVuCha = body.maNhiemVuCha
        else if (route.endsWith('/scope')) branch(task.ma).forEach(t => { t.maHocKy = body.maHocKy; t.maMonHoc = body.maMonHoc })
        else { task.tienDo = route.endsWith('/complete') ? 100 : 0; task.trangThai = task.tienDo === 100 ? 'Completed' : 'NotStarted' }
        remember(task, 'Updated', before); revision++; response = envelope(task)
      } else if (/^\/tasks\/\d+\/deletion-preview$/.test(route)) response = envelope({ soNhiemVu: branch(Number(route.split('/')[2])).length, soLichNhac: 0, soThongBao: 0, soTep: 0, maPhienBiXoa: [] })
      else if (/^\/tasks\/\d+$/.test(route)) {
        const task = tasks.find(t => t.ma === Number(route.split('/')[2]))
        if (method === 'DELETE') {
          if (failNextDelete) {
            failNextDelete = false; status = 503; response = { detail: 'Chưa xóa được nhiệm vụ. Hãy thử lại.' }
          } else {
            await new Promise(resolve => setTimeout(resolve, 150))
            const ids = new Set(branch(task.ma).map(t => t.ma))
            for (let i = tasks.length - 1; i >= 0; i--) if (ids.has(tasks[i].ma)) tasks.splice(i, 1)
            revision++; status = 204
          }
        } else { if (method === 'PUT') { remember({ ...task, ...body }, 'Updated', JSON.stringify(task)); Object.assign(task, body); revision++ }; response = envelope(task) }
      } else if (route === '/task-history') response = envelope(page(histories.filter(h => h.maNhiemVu === Number(url.searchParams.get('maNhiemVu')))))
      else if (route === '/availability-windows' && method === 'POST') { revision++; availability.push({ ma: 8, ...body }); response = envelope(availability[0]); status = 201 }
      else if (route === '/availability-windows') response = envelope(availability)
      else if (route === '/availability-windows/8') {
        if (method === 'PUT') { revision++; Object.assign(availability[0], body) }
        if (method === 'DELETE') { revision++; availability = []; status = 204 }
        else response = envelope(availability[0])
      }
      else if (route.startsWith('/courses/') && route.endsWith('/class-sessions')) {
        if (method === 'POST' && confirmClassOverlap && !body.xacNhanTrungLich) { status = 409; response = { code: 'CLASS_OVERLAP_CONFIRMATION_REQUIRED', detail: 'Lịch lớp bị trùng.' } }
        else {
          if (method === 'POST') { confirmClassOverlap = false; revision++; classes.push({ ma: 10, maMonHoc: 207, tenMonHoc: 'Cơ sở dữ liệu', ...body }); status = 201 }
          response = envelope(method === 'POST' ? classes[0] : classes)
        }
      } else if (route === '/class-sessions/10') {
        if (method === 'PUT') { revision++; Object.assign(classes[0], body) }
        if (method === 'DELETE') { revision++; classes = []; status = 204 }
        else response = envelope(classes[0])
      } else if (route === '/study-sessions') {
        if (method === 'POST') { revision++; const session = { ma: 100 + sessions.length, ...body, trangThai: 'Planned' }; sessions.push(session); response = envelope(session); status = 201 }
        else response = envelope(sessions.filter(p => !url.searchParams.has('maNhiemVu') || p.maNhiemVu === Number(url.searchParams.get('maNhiemVu'))))
      } else if (/^\/study-sessions\/\d+(\/(start|finish|miss|cancel))?$/.test(route)) {
        const session = sessions.find(p => p.ma === Number(route.split('/')[2]))
        if (method === 'PUT') { Object.assign(session, body); revision++ }
        else if (method === 'POST') { session.trangThai = { start: 'InProgress', finish: 'Completed', miss: 'Missed', cancel: 'Cancelled' }[route.split('/')[3]]; revision++ }
        response = envelope(session)
      }
      else if (route === '/calendar') response = envelope({ muiGio: user.muiGio, suKien: sessions.filter(p => p.trangThai !== 'Cancelled').map(p => ({ ma: 'session-' + p.ma, loai: 'PhienTuHoc', maNguon: p.ma, maMonHoc: 207, tieuDe: tasks.find(t => t.ma === p.maNhiemVu).tieuDe, batDau: p.batDauDuKien, ketThuc: p.ketThucDuKien, trangThai: p.trangThai })) })
      else if (route === '/planning/preview') response = envelope({ tokenPreview: 'signed-fixture', muiGio: user.muiGio, hetHanLuc: new Date(Date.now() + 600000).toISOString(), tongPhutCanXep: 50, tongPhutDaDat: 0, tongPhutDeXuat: 50, tongPhutChuaXep: 0, canhBao: [], phien: [{ maNhiemVu: tasks.find(t => t.tieuDe === 'Luyện truy vấn SQL').ma, tieuDe: 'Luyện truy vấn SQL', batDauDuKien: tomorrow + 'T12:00:00Z', ketThucDuKien: tomorrow + 'T12:50:00Z', lyDo: 'Còn 50 phút, phù hợp giờ rảnh' }] })
      else if (route === '/planning/apply') {
        if (!applied) { revision++; applied = true; sessions = body.phien.map((p, i) => ({ ...p, ma: i + 20, trangThai: 'Planned', ghiChu: null })) }
        if (loseApplyResponse) { loseApplyResponse = false; await cdp('Fetch.failRequest', { requestId, errorReason: 'ConnectionReset' }); return }
        response = envelope({ phien: sessions })
      } else { status = 404; response = { detail: 'Unexpected fixture route ' + route }; errors.push(method + ' ' + route) }
      await cdp('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'ETag', value: '"ht-' + revision + '"' }], ...(response === undefined ? {} : { body: Buffer.from(JSON.stringify(response)).toString('base64') }) })
    } catch (error) { if (!String(error).includes('Invalid InterceptionId')) errors.push(String(error)) }
  })
  await cdp('Runtime.enable'); await cdp('Page.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: Number(process.env.CORE_VIEWPORT_WIDTH ?? 1440), height: Number(process.env.CORE_VIEWPORT_HEIGHT ?? 1000), deviceScaleFactor: 1, mobile: false })
  await cdp('Fetch.enable', { patterns: [{ urlPattern: origin + '/api/v1/*' }] })
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function waitFor(expression) {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return
      await new Promise(resolve => setTimeout(resolve, 75))
    }
    throw new Error('Wait failed: ' + expression + '\n' + await evaluate('document.body.innerText'))
  }
  const click = async selector => { await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`) }
  const button = async text => {
    const expression = `Array.from((Array.from(document.querySelectorAll('dialog[open]')).at(-1) || document).querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)})`
    await waitFor('!!(' + expression + ') && !(' + expression + ').disabled'); await evaluate('(' + expression + ').click()')
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  }
  async function field(selector, value) {
    await evaluate(`(() => { const field = (document.querySelector('dialog[open]') || document).querySelector(${JSON.stringify(selector)}); if (field?.closest('.ht-filter-panel')?.hidden) document.querySelector('.ht-filter-toggle').click(); })()`)
    await waitFor(`!!(document.querySelector('dialog[open]') || document).querySelector(${JSON.stringify(selector)})`)
    await waitFor(`(() => { const field = (document.querySelector('dialog[open]') || document).querySelector(${JSON.stringify(selector)}); return field && (field.tagName !== 'SELECT' || Array.from(field.options).some(option => option.value === ${JSON.stringify(String(value))})); })()`)
    await evaluate(`(() => { const field = (document.querySelector('dialog[open]') || document).querySelector(${JSON.stringify(selector)}); const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
  }
  async function submit(confirmLabel) {
    await waitFor('!!document.querySelector("dialog:modal form")')
    await evaluate('document.querySelector("dialog form").requestSubmit()')
    if (confirmLabel) await button(confirmLabel)
    await waitFor('!document.querySelector("dialog[open]")')
  }
  await cdp('Page.navigate', { url: origin + '/login' })
  await field('input[name=taiKhoan]', user.email); await field('input[name=password]', 'Fixture123!'); await click('button[type=submit]')
  await waitFor('location.pathname === "/today"')
  await click('.sidebar a[href="/tasks"]')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("aaa")')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  const unchecked = 'input[aria-label="Hoàn thành vbbbb"]'
  const checked = 'input[aria-label="Mở lại vbbbb"]'
  const syncIsSpinning = 'document.querySelector(".ht-sidebar-sync-icon")?.getAnimations().some(animation => animation.playState === "running")'
  const completionWrites = () => calls.filter(c => c.method === 'POST' && c.route === '/tasks/3/complete').length
  revision++
  await click(unchecked)
  await waitFor('document.querySelector(".ht-error button")?.textContent === "Tải dữ liệu mới"')
  assert.equal(completionWrites(), 0)
  assert(!await evaluate(syncIsSpinning))
  assert(!await evaluate('document.querySelector(".ht-success-toast")'))
  await button('Tải dữ liệu mới')
  await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  await waitFor(`!!document.querySelector(${JSON.stringify(unchecked)})`)
  await evaluate(`(() => { const checkbox = document.querySelector(${JSON.stringify(unchecked)}); checkbox.click(); checkbox.click() })()`)
  await waitFor('document.querySelector(".ht-success-toast")?.textContent.includes("Đã hoàn thành “vbbbb”.")')
  assert(await evaluate(syncIsSpinning))
  await button("Đã hoàn thành")
  await waitFor(`document.querySelector(${JSON.stringify(checked)})?.checked`)
  assert(await evaluate(`!!document.querySelector(${JSON.stringify(checked)})?.closest('.ht-task-completed')`))
  assert.equal(completionWrites(), 1)
  await click(checked)
  await waitFor('document.querySelector(".ht-success-toast")?.textContent.includes("Đã mở lại “vbbbb”.")')
  await button("Tất cả nhiệm vụ")
  await waitFor(`document.querySelector(${JSON.stringify(unchecked)})?.checked === false`)
  assert(!await evaluate(`document.querySelector(${JSON.stringify(unchecked)})?.closest('.ht-task-completed')`))
  await waitFor('document.querySelector(".ht-filter-toggle")?.getAttribute("aria-expanded") === "false"')
  assert(await evaluate('document.querySelector(".ht-filter-panel").hidden'))
  assert(await evaluate('document.querySelector(".ht-task-search input").getBoundingClientRect().height > 0'))
  const beforeFilterToggle = await evaluate('location.href')
  const beforeFilterTop = await evaluate('document.querySelector(".ht-task-list").getBoundingClientRect().top')
  const readsBeforeFilterToggle = calls.filter(c => c.route === '/tasks' && c.method === 'GET').length
  await button('Mở bộ lọc')
  await waitFor('!document.querySelector(".ht-filter-panel").hidden')
  assert(await evaluate('document.querySelector(".ht-task-list").getBoundingClientRect().top') > beforeFilterTop + 100)
  await button('Thu gọn bộ lọc')
  await waitFor('document.querySelector(".ht-filter-panel").hidden')
  assert.equal(await evaluate('location.href'), beforeFilterToggle)
  assert.equal(calls.filter(c => c.route === '/tasks' && c.method === 'GET').length, readsBeforeFilterToggle)
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-filters-collapsed.png'), Buffer.from(shot.data, 'base64'))
  }
  assert.equal(await evaluate(`document.querySelector('select[aria-label="Lọc theo học kỳ"]')?.value`), '')
  assert(calls.filter(call => call.route === '/tasks' && call.method === 'GET').every(call => !new URLSearchParams(call.query).has('maHocKy')))
  assert(await evaluate('document.querySelector(".ht-toolbar").textContent.includes("Học kỳ thực hành")'))
  assert(await evaluate('document.querySelector(".ht-toolbar").textContent.includes("Cơ sở dữ liệu")'))
  assert(!await evaluate('/bung cây|Nhập mã học kỳ|Nhập mã môn/i.test(document.body.innerText)'))
  for (const [name, view] of [['Hôm nay', 'today'], ['7 ngày tới', 'upcoming'], ['Tất cả nhiệm vụ', 'all'], ['Chưa phân loại', 'inbox'], ['Quá hạn', 'overdue'], ['Không có hạn', 'undated'], ['Đã hoàn thành', 'completed']]) {
    await button(name)
    await waitFor('new URLSearchParams(location.search).get("view") === ' + JSON.stringify(view))
    await waitFor(`document.querySelector('.ht-task-shortcuts button[aria-current="page"]')?.textContent === ${JSON.stringify(name)}`)
  }
  await button('Tất cả nhiệm vụ')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("aaa")')
  assert(await evaluate(`(() => {
    const nav = document.querySelector('.ht-tabs')
    const buttons = Array.from(nav.querySelectorAll('button'))
    const boxes = buttons.map(button => button.getBoundingClientRect())
    const content = document.querySelector('.ht-page-body').getBoundingClientRect()
    return getComputedStyle(nav).flexDirection === 'column' && buttons.length === 14 &&
      boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom) &&
      nav.getBoundingClientRect().right <= content.left
  })()`), 'Learning navigation must be vertical and positioned to the left of content')
  assert(await evaluate('document.querySelector(".ht-workspace").getBoundingClientRect().width >= document.querySelector("#main-content").clientWidth - 2'))
  await field('select[aria-label="Lọc theo học kỳ"]', '103')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("Ôn cơ sở dữ liệu") && !document.querySelector(".ht-task-list")?.textContent.includes("aaa")')
  await field('select[aria-label="Lọc mức ưu tiên"]', 'High')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("Ôn cơ sở dữ liệu")')
  await field('select[aria-label="Lọc loại công việc"]', 'Assignment')
  await waitFor('location.search.includes("type=Assignment")')
  await waitFor('!!document.querySelector(".ht-task-list")')
  await field('select[aria-label="Lọc trạng thái nhiệm vụ"]', 'NotStarted')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("Ôn cơ sở dữ liệu")')
  assert(calls.some(call => call.route === '/tasks' && call.query.includes('mucDoUuTien=High')))
  await waitFor('location.search.includes("status=NotStarted")')
  const filteredUrl = await evaluate('location.href')
  await button('Thu gọn bộ lọc')
  await waitFor('document.querySelector(".ht-filter-panel").hidden')
  assert.equal(await evaluate('location.href'), filteredUrl)
  assert(await evaluate('document.querySelector(".ht-filter-summary").textContent.includes("Học kỳ thực hành") && document.querySelector(".ht-filter-summary").textContent.includes("Cao")'))
  assert.equal(await evaluate('document.querySelector(\'select[aria-label="Lọc mức ưu tiên"]\').value'), 'High')
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-filters-active.png'), Buffer.from(shot.data, 'base64'))
  }
  await button('Xóa bộ lọc')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("aaa")')
  assert(!await evaluate('!!document.querySelector(".ht-filter-summary")'))
  assert(await evaluate('document.querySelector(".ht-filter-panel").hidden'))
  await button('Bảng trạng thái'); await waitFor('document.querySelectorAll(".ht-board-column").length === 3')
  assert(await evaluate('location.search.includes("layout=board")'))
  await button('Nhiệm vụ'); await waitFor('!!document.querySelector(".ht-task-list")')
  await click('input[aria-label="Hoàn thành vbbbb"]')
  await waitFor('!document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await field('select:has(option[value="completed"])', 'completed')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await click(checked)
  await waitFor('!document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await button('Xóa bộ lọc')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await field('.ht-quick-add input', 'Ghi nhanh việc cá nhân')
  await button('+ Thêm nhanh')
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Ghi nhanh việc cá nhân"')
  const quickTask = tasks.find(task => task.tieuDe === 'Ghi nhanh việc cá nhân')
  await waitFor('!!document.querySelector(".ht-detail-divider")')
  const dividerBox = await evaluate(`(() => {
    const box = document.querySelector('.ht-detail-divider').getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + 150 }
  })()`)
  const initialWidth = await evaluate('document.querySelector(".ht-detail-panel").getBoundingClientRect().width')
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dividerBox.x, y: dividerBox.y })
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: dividerBox.x, y: dividerBox.y, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dividerBox.x - 100, y: dividerBox.y, button: 'left', buttons: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dividerBox.x - 100, y: dividerBox.y, button: 'left', clickCount: 1 })
  await waitFor('Number(document.querySelector(".ht-detail-divider").getAttribute("aria-valuenow")) > ' + (initialWidth + 80))
  const draggedWidth = await evaluate('document.querySelector(".ht-detail-panel").getBoundingClientRect().width')
  assert(draggedWidth > initialWidth + 80)
  assert(!await evaluate('!!document.querySelector(".ht-resizing")'))
  await cdp('Page.reload')
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Ghi nhanh việc cá nhân"')
  await waitFor('!!document.querySelector(".ht-detail-divider")')
  assert(Math.abs(await evaluate('document.querySelector(".ht-detail-panel").getBoundingClientRect().width') - draggedWidth) < 2, 'Dragged width survives reload')
  await evaluate('document.querySelector(".ht-detail-divider").focus()')
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' })
  await waitFor('Number(document.querySelector(".ht-detail-divider").getAttribute("aria-valuenow")) < ' + draggedWidth)
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home' })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home' })
  await waitFor('document.querySelector(".ht-detail-divider").getAttribute("aria-valuenow") === "260"')
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End' })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End' })
  await waitFor('document.querySelector(".ht-detail-divider").getAttribute("aria-valuenow") === document.querySelector(".ht-detail-divider").getAttribute("aria-valuemax")')
  assert(await evaluate('document.querySelector(".ht-page-main").getBoundingClientRect().width >= 360'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 950, height: 720, deviceScaleFactor: 1, mobile: false })
  await waitFor('getComputedStyle(document.querySelector(".ht-detail-divider")).display === "none"')
  await cdp('Emulation.setDeviceMetricsOverride', { width: Number(process.env.CORE_VIEWPORT_WIDTH ?? 1440), height: Number(process.env.CORE_VIEWPORT_HEIGHT ?? 1000), deviceScaleFactor: 1, mobile: false })
  await waitFor('getComputedStyle(document.querySelector(".ht-detail-divider")).display !== "none"')
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  await evaluate('document.querySelector(".ht-detail-divider").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))')
  await waitFor('document.querySelector(".ht-detail-divider").getAttribute("aria-valuenow") === "310"')
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-personal.png'), Buffer.from(shot.data, 'base64'))
  }
  assert.equal(quickTask.maHocKy, null)
  assert.equal(quickTask.maMonHoc, null)
  await button('Sao chép liên kết')
  await waitFor(`!!document.querySelector('input[aria-label="Liên kết nhiệm vụ"]')`)
  const deepLink = await evaluate(`document.querySelector('input[aria-label="Liên kết nhiệm vụ"]').value`)
  assert(deepLink.endsWith('/tasks?task=' + quickTask.ma))
  await cdp('Page.navigate', { url: deepLink })
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Ghi nhanh việc cá nhân"')
  await button('Chưa đặt hạn')
  await field('input[name=tieuDe]', 'Việc cá nhân đã sửa')
  await submit()
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Việc cá nhân đã sửa"')
  await button('Xem lịch sử thay đổi')
  await waitFor('document.querySelector(".ht-history")?.textContent.includes("Trước thay đổi")')
  await button('Chỉnh sửa')
  await field('input[name=tieuDe]', 'Nội dung từ biểu mẫu cũ')
  const beforeStaleWrite = calls.filter(call => call.method === 'PUT' && call.route.startsWith('/tasks/')).length
  revision++
  await evaluate('document.querySelector("dialog form").requestSubmit()')
  await waitFor('document.querySelector("dialog [role=alert]")?.textContent.includes("Dữ liệu đã đổi")')
  assert.equal(calls.filter(call => call.method === 'PUT' && call.route.startsWith('/tasks/')).length, beforeStaleWrite)
  await button('Đóng'); await click('.ht-sidebar-sync')
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Việc cá nhân đã sửa"')
  const deletesBefore = calls.filter(call => call.method === 'DELETE').length
  await button('Xóa nhiệm vụ')
  await waitFor('!!document.querySelector(".ht-confirm[open]")')
  assert(await evaluate('document.querySelector(".ht-confirm").textContent.includes("Việc cá nhân đã sửa")'))
  assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Hủy')
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-delete.png'), Buffer.from(shot.data, 'base64'))
  }
  await button('Hủy')
  await waitFor('!document.querySelector(".ht-confirm")')
  assert(tasks.includes(quickTask))
  assert.equal(calls.filter(call => call.method === 'DELETE').length, deletesBefore)
  await button('Xóa nhiệm vụ')
  await waitFor('!!document.querySelector(".ht-confirm[open]")')
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor('!document.querySelector(".ht-confirm")')
  assert.equal(calls.filter(call => call.method === 'DELETE').length, deletesBefore)
  await button('Xóa nhiệm vụ')
  await waitFor('!!document.querySelector(".ht-confirm[open]")')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  assert(await evaluate('(() => { const b = document.querySelector(".ht-confirm").getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; })()'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: Number(process.env.CORE_VIEWPORT_WIDTH ?? 1440), height: Number(process.env.CORE_VIEWPORT_HEIGHT ?? 1000), deviceScaleFactor: 1, mobile: false })
  failNextDelete = true
  await button('Xóa nhiệm vụ')
  await waitFor('document.querySelector(".ht-confirm [role=alert]")?.textContent.includes("Chưa xóa được")')
  assert(tasks.includes(quickTask))
  assert(!await evaluate('!!document.querySelector(".ht-success-toast")'))
  await evaluate('(() => { const b = document.querySelector(".ht-confirm-delete"); b.click(); b.click(); })()')
  await waitFor('document.querySelector(".ht-confirm-delete")?.disabled === true')
  assert(await evaluate('Array.from(document.querySelector(".ht-confirm").querySelectorAll("button")).every(b => b.disabled)'))
  await waitFor('!document.querySelector(".ht-detail-panel") && !document.querySelector(".ht-task-list")?.textContent.includes("Việc cá nhân đã sửa")')
  assert(!tasks.includes(quickTask))
  assert.equal(calls.filter(call => call.method === 'DELETE').length, deletesBefore + 2)
  await waitFor('document.querySelector(".ht-success-toast")?.textContent.includes("Đã xóa nhiệm vụ")')
  await click('.ht-sidebar-sync')
  await waitFor('!!document.querySelector(".ht-task-list")')
  await click('.flow-global-create:not(:disabled)')
  await waitFor('!!document.querySelector("dialog:modal")')
  await field('input[name=tieuDe]', 'Làm bài tập tuần')
  await field('select[name=maHocKy]', '103'); await field('select[name=maMonHoc]', '207')
  await submit()
  assert(calls.some(call => call.route === '/tasks' && call.method === 'POST' && call.body.tieuDe === 'Làm bài tập tuần' && call.body.maMonHoc === 207 && call.body.maHocKy === 103))
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Làm bài tập tuần"')
  await button('+ Thêm bước nhỏ')
  await field('input[name=tieuDe]', 'Luyện truy vấn SQL')
  await field('input[name=thoiLuongDuKienPhut]', '50')
  await field('textarea[name=nhieuTieuDe]', 'Đọc tài liệu SQL\nKiểm thử truy vấn')
  await submit()
  assert.equal(calls.findLast(call => call.route.endsWith('/children')).body.danhSach.length, 3)
  if (process.env.CORE_SCREENSHOT) {
    await waitFor('document.querySelector(".ht-detail-panel")?.textContent.includes("Luyện truy vấn SQL")')
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-detail.png'), Buffer.from(screenshot.data, 'base64'))
  }
  await waitFor('!!document.querySelector(' + JSON.stringify('button[aria-label="Xem các bước nhỏ"]') + ')')
  await click('button[aria-label="Xem các bước nhỏ"]')
  await waitFor('document.querySelector(".ht-task-list").textContent.includes("Luyện truy vấn SQL")')
  await evaluate('Array.from(document.querySelectorAll(".ht-task-name")).find(button => button.querySelector("strong").textContent === "Luyện truy vấn SQL").click()')
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Luyện truy vấn SQL"')
  await button('Cập nhật tiến độ')
  await field('input[name=tienDo]', '25'); await submit()
  await waitFor('document.querySelector(".ht-detail-panel")?.textContent.includes("25%")')
  await button('Chuyển vào nhiệm vụ lớn / tách riêng')
  await field('select[name=nhomNhiemVu]', 'tach-rieng'); await submit()
  const studying = tasks.find(task => task.tieuDe === 'Luyện truy vấn SQL')
  assert.equal(studying.maNhiemVuCha, null)
  await button('Đổi học kỳ hoặc môn')
  await field('select[name=maHocKy]', ''); await submit()
  assert.equal(studying.maHocKy, null)
  assert.equal(studying.maMonHoc, null)
  await button('Chuyển vào nhiệm vụ lớn / tách riêng')
  await field('select[name=nhomNhiemVu]', '1')
  await waitFor('!!document.querySelector(' + JSON.stringify('select[name="maNhiemVuCha"] option[value="2"]') + ')')
  await field('select[name=maNhiemVuCha]', '2'); await submit()
  assert.equal(studying.maNhiemVuCha, 2)
  await button('Chuyển vào nhiệm vụ lớn / tách riêng')
  await field('select[name=nhomNhiemVu]', 'tach-rieng'); await submit()
  assert.equal(studying.maNhiemVuCha, null)
  await button('Xem phiên học của nhiệm vụ')
  await waitFor('document.body.innerText.includes("Các phiên của “Luyện truy vấn SQL”")')
  await button('+ Đặt phiên tự học')
  await field('input[name=batDau]', tomorrow + 'T20:00')
  await field('input[name=ketThuc]', tomorrow + 'T20:50'); await submit()
  assert.equal(sessions[0].maNhiemVu, studying.ma)
  await button('Xem và cập nhật'); await button('Dời phiên')
  await field('input[name=batDau]', tomorrow + 'T21:00')
  await field('input[name=ketThuc]', tomorrow + 'T21:50'); await submit()
  await button('Xem và cập nhật'); await button('Hủy phiên')
  assert.equal(sessions[0].trangThai, 'Cancelled')
  const moment = Date.now()
  for (const [ma, start, end] of [[200, -10, 10], [201, -60, -10], [202, -120, -90]]) {
    sessions.push({ ma, maNhiemVu: studying.ma, batDauDuKien: new Date(moment + start * 60000).toISOString(), ketThucDuKien: new Date(moment + end * 60000).toISOString(), trangThai: 'Planned', ghiChu: null })
  }
  revision++
  await click('.ht-sidebar-sync')
  await waitFor('!!document.querySelector(\'[data-session-id="200"]\')')
  await click('[data-session-id="200"] button'); await button('Bắt đầu học')
  assert.equal(sessions.find(p => p.ma === 200).trangThai, 'InProgress')
  await click('[data-session-id="200"] button'); await button('Kết thúc phiên')
  assert.equal(sessions.find(p => p.ma === 200).trangThai, 'Completed')
  await click('[data-session-id="201"] button'); await button('Xác nhận đã học xong')
  assert.equal(sessions.find(p => p.ma === 201).trangThai, 'Completed')
  await click('[data-session-id="202"] button'); await button('Xác nhận bỏ lỡ')
  assert.equal(sessions.find(p => p.ma === 202).trangThai, 'Missed')
  await button('Giờ rảnh của tôi'); await button('+ Thêm giờ rảnh')
  await submit()
  assert.equal(availability.length, 1)
  await button('Chỉnh sửa')
  await field('input[name=gioKetThuc]', '22:00'); await submit()
  assert.equal(availability[0].gioKetThuc, '22:00:00')
  await button('Lịch học theo môn'); await button('+ Thêm buổi học')
  assert(await evaluate('document.querySelector("input[name=toanHocKy]").checked'))
  assert(!await evaluate('!!document.querySelector("dialog input[name=ngayBatDau]")'))
  assert(!await evaluate('document.querySelector("dialog").textContent.includes("Để trống cả hai ngày")'))
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-whole-semester.png'), Buffer.from(shot.data, 'base64'))
  }
  await field('select[name=maHocKy]', '103')
  await field('select[name=maMonHoc]', '207'); await submit('Vẫn lưu lịch học')
  assert.equal(classes.length, 1)
  assert(calls.some(call => call.route === '/courses/207/class-sessions' && call.method === 'POST' && call.body.xacNhanTrungLich === true))
  const lesson = calls.find(call => call.route === '/courses/207/class-sessions' && call.method === 'POST')
  assert.equal(lesson.body.ngayApDungTu, null)
  await waitFor('!!document.querySelector(".ht-item")')
  await button('Chỉnh sửa')
  await click('dialog input[name=toanHocKy]')
  await field('input[name=ngayBatDau]', '2026-11-09')
  const writesBeforeIncompleteDates = calls.filter(c => c.route === '/class-sessions/10' && c.method === 'PUT').length
  await evaluate('document.querySelector("dialog form").requestSubmit()')
  assert(await evaluate('document.querySelector("input[name=ngayKetThuc]").validity.valueMissing'))
  assert.equal(calls.filter(c => c.route === '/class-sessions/10' && c.method === 'PUT').length, writesBeforeIncompleteDates)
  await field('input[name=ngayKetThuc]', '2026-11-30')
  await click('dialog input[name=toanHocKy]')
  assert(!await evaluate('!!document.querySelector("dialog input[name=ngayBatDau]")'))
  await click('dialog input[name=toanHocKy]')
  assert.equal(await evaluate('document.querySelector("input[name=ngayBatDau]").value'), '2026-11-09')
  assert.equal(await evaluate('document.querySelector("input[name=ngayKetThuc]").value'), '2026-11-30')
  await field('input[name=phongHoc]', 'A101'); await submit()
  assert.equal(classes[0].phongHoc, 'A101')
  assert.equal(classes[0].ngayApDungTu, '2026-11-09')
  assert.equal(classes[0].ngayApDungDen, '2026-11-30')
  await button('Chỉnh sửa')
  assert(!await evaluate('document.querySelector("input[name=toanHocKy]").checked'))
  assert.equal(await evaluate('document.querySelector("input[name=ngayKetThuc]").value'), '2026-11-30')
  await click('dialog input[name=toanHocKy]'); await submit()
  assert.equal(classes[0].ngayApDungTu, null)
  assert.equal(classes[0].ngayApDungDen, null)
  await button('Xóa'); await button('Xóa lịch học'); await waitFor('document.querySelectorAll(".ht-item").length === 0')
  assert.equal(classes.length, 0)
  await button('Xóa bộ lọc')
  await button('Gợi ý lịch học')
  await button('Tạo gợi ý lịch học')
  await waitFor('!!document.querySelector(".ht-proposal")')
  await button('Áp dụng 1 phiên đã chọn')
  await button('Áp dụng lịch')
  await waitFor('document.body.innerText.includes("Mất kết nối")')
  await cdp('Page.reload')
  await waitFor('document.body.innerText.includes("Có yêu cầu áp dụng chưa xác định kết quả")')
  await button('Thử lại cùng yêu cầu áp dụng')
  await waitFor('document.body.innerText.includes("Đã lưu các phiên tự học")')
  const applyCall = calls.find(call => call.route === '/planning/apply')
  assert(applyCall.headers['Idempotency-Key'] || applyCall.headers['idempotency-key'])
  assert.equal(applyCall.body.tokenPreview, 'signed-fixture')
  const retries = calls.filter(call => call.route === '/planning/apply')
  assert.equal(retries.length, 2)
  assert.deepEqual(retries[0].body, retries[1].body)
  assert.equal(retries[0].headers['Idempotency-Key'], retries[1].headers['Idempotency-Key'])
  await button('Xóa bộ lọc')
  await button('Phiên tự học')
  await waitFor('document.body.innerText.includes("Luyện truy vấn SQL")').catch(error => {
    throw new Error(error.message + '\nFixture state ' + JSON.stringify({ sessions, task: tasks.find(t => t.tieuDe === 'Luyện truy vấn SQL'), lastReads: calls.filter(c => c.method === 'GET').slice(-10).map(c => ({ route: c.route, query: c.query })) }))
  })
  await button('Xem và cập nhật')
  await waitFor('!!document.querySelector("dialog:modal")')
  assert(await evaluate('document.querySelector("dialog").textContent.includes("Hủy phiên")'))
  assert(!await evaluate('document.querySelector("dialog").textContent.includes("Bắt đầu học")'))
  await button('Đóng')
  await button('Thời khóa biểu')
  await waitFor('document.querySelectorAll(".ht-time-column").length === 7')
  if (process.env.CORE_SCREENSHOT) {
    await evaluate('document.querySelector(".ht-time-grid-wrap").scrollTop = 18 * 60')
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-week.png'), Buffer.from(screenshot.data, 'base64'))
  }
  await button('+ Thêm vào lịch')
  assert(await evaluate('document.querySelector("dialog").textContent.includes("Nhiệm vụ hoặc sự kiện")'))
  await button('Đóng')
  await field('select:has(option[value="month"])', 'month')
  await waitFor('document.querySelectorAll(".ht-day").length === 42')
  if (process.env.CORE_SCREENSHOT) {
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT, Buffer.from(screenshot.data, 'base64'))
  }
  await button('Nhiệm vụ')
  if (process.env.CORE_SCREENSHOT) {
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-tasks.png'), Buffer.from(screenshot.data, 'base64'))
  }
  taskReadFailure = true
  await click('.ht-sidebar-sync')
  assert(await evaluate(syncIsSpinning))
  await waitFor('document.body.innerText.includes("Dịch vụ nhiệm vụ đang gián đoạn")')
  assert(!await evaluate('document.body.innerText.includes("Chưa có nhiệm vụ phù hợp")'))
  taskReadFailure = false
  await button('Thử tải lại')
  await waitFor('!!document.querySelector(".ht-task-list")')
  await button('Giờ rảnh của tôi')
  await waitFor('!!document.querySelector(".ht-item")')
  await button('Xóa')
  await button('Xóa giờ rảnh')
  await waitFor('document.querySelectorAll(".ht-item").length === 0')
  assert.equal(availability.length, 0)
  assert.deepEqual(errors, [])
  const writes = calls.filter(call => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(call.method) && call.route !== '/auth/login')
  assert(writes.every(call => /^\/(tasks|availability-windows|calendar|planning|study-sessions)(\/|$)/.test(call.route) || /^\/courses\/\d+\/class-sessions$/.test(call.route) || /^\/class-sessions\/\d+$/.test(call.route)))
  console.log('PASS core UI: named selectors, task creation, small steps, availability, planning preview/apply, session actions and month calendar. ' + calls.length + ' fixture requests. Academic/auth mutations stayed untouched.')
} finally {
  socket?.close(); browser?.kill(); await vite.close()
  const resolved = path.resolve(userDir)
  if (resolved.startsWith(path.resolve(tempPrefix)) && path.dirname(resolved) === path.resolve(os.tmpdir())) {
    try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* Browser may briefly retain its profile. */ }
  }
}
