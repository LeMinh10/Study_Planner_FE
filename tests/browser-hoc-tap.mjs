import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { createFocusFixture } from './focus-fixture.mjs'
import { runAttachmentChecks } from './browser-tep-dinh-kem.mjs'
import { runFocusChecks } from './browser-focus.mjs'
import { createTaskProgressFixture } from './task-progress-fixture.mjs'
import { runTaskProgressChecks } from './browser-task-progress.mjs'
import { createPlanningUpgradeFixture } from './upgrade-fixture.mjs'
import { runPlanningUpgradeChecks } from './browser-planning-upgrade.mjs'
import { runReminderChecks } from './browser-planning-reminders.mjs'
import { createSessionLockFixture } from './browser-session-lock.mjs'

// Dữ liệu giả lập kiểm tra các trang và biểu mẫu thật mà không ghi vào cơ sở dữ liệu người dùng.
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync)
assert(browserPath, 'A Chromium browser is required')
const tempPrefix = path.join(os.tmpdir(), 'studyplanner-core-ui-')
const userDir = fs.mkdtempSync(tempPrefix)
const sessionFixture = createSessionLockFixture()
// Mỗi lượt có cache riêng để các bộ kiểm thử chạy song song không ghi đè bộ tối ưu Vite.
const vite = await createServer({ cacheDir: path.join(userDir, 'vite-cache'), plugins: [{ name: 'session-fixture-stream', configureServer(server) { server.middlewares.use(sessionFixture.middleware) } }], define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
let browser, socket
let checksPassed = false
const waiting = new Map()
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
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error('Browser timeout: ' + method)) }, 40000)
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
  function remember(task, action, before = null, after = task) {
    histories.push({ ma: histories.length + 1, maNhiemVu: task.ma, tieuDeNhiemVu: task.tieuDe, hanhDong: action, nguonThayDoi: 'User', ngayThayDoi: new Date().toISOString(), duLieuTruoc: before, duLieuSau: JSON.stringify(after) })
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
  const trashedTasks = []
  let applied = false
  let loseApplyResponse = true
  const envelope = duLieu => ({ phienBan: revision, duLieu })
  const page = danhSach => ({ danhSach, trang: 1, kichThuocTrang: 100, tongSo: danhSach.length })
  let failNextDelete = false
  const focusFixture = createFocusFixture({ tasks, sessions: () => sessions, revision: () => revision, bump: () => revision++, zone: user.muiGio })
  const taskProgressFixture = createTaskProgressFixture({ tasks, makeTask, nextId: () => nextTask++, envelope, bump: () => revision++ })
  const planningFixture = createPlanningUpgradeFixture({ envelope, bump: () => revision++, tasks, windows: () => availability, addWindows: rows => availability.push(...rows), sessions: () => sessions, addSessions: rows => sessions.push(...rows) })
  handlers.set('Page.javascriptDialogOpening', () => {
    errors.push('Unexpected native browser dialog')
    void cdp('Page.handleJavaScriptDialog', { accept: false })
  })
  handlers.set('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text))
  const attachments = []; const attachmentControls = { failUpload: false, nextUpload: null }
  const attachmentBytes = new Map(); let nextAttachment = 1
  handlers.set('Fetch.requestPaused', async ({ requestId, request }) => {
    try {
      const url = new URL(request.url)
      const route = url.pathname.replace('/api/v1', '')
      // Cho luồng phiên đăng nhập đi qua HTTP streaming thật của fixture, không giả thành JSON.
      if (route === '/users/me/session-events') { await cdp('Fetch.continueRequest', { requestId }); return }
      const multipart = Object.entries(request.headers).some(([k,v]) => k.toLowerCase() === 'content-type' && v.startsWith('multipart/form-data'))
      const body = request.postData ? multipart ? request.postData : JSON.parse(request.postData) : undefined
      const method = request.method
      calls.push({ route, query: url.searchParams.toString(), method, body, headers: request.headers })
      let status = 200, response
      const focusResponse = focusFixture.handle(url, method, body)
      const childrenMatch = method === 'POST' ? route.match(/^\/tasks\/(\d+)\/children$/) : null
      const parent = childrenMatch ? tasks.find(task => task.ma === Number(childrenMatch[1])) : null
      const beforeSplit = parent && JSON.stringify(parent)
      const calendarAffected = process.env.CORE_CALENDAR_DEADLINES_ONLY === '1' && route.endsWith('/change-preview') && body?.thaoTac === 'complete'
        ? sessions.filter(row => row.maNhiemVu === Number(route.split('/')[2]) && row.trangThai === 'Planned') : null
      const progressResponse = calendarAffected ? { status: 200, response: envelope({ maPhienBiHuy: calendarAffected.map(row => row.ma), phienBiAnhHuong: [], canKetThucPhienDangHoc: false }) } : taskProgressFixture.handle(route, method, body)
      if (parent && progressResponse?.status === 201) remember(parent,
        JSON.parse(beforeSplit).trangThai === 'Completed' && parent.trangThai !== 'Completed' ? 'Reopened' : 'Updated', beforeSplit,
        { ...parent, loaiHoatDong: 'StepsAdded', cacBuocDaThem: body.danhSach.map(step => step.tieuDe) })
      const planningResponse = planningFixture.handle(url, method, body, request.headers)
      if (/^\/tasks\/\d+\/attachments(?:\/\d+(?:\/download)?)?$/.test(route)) {
        const id = Number(route.split('/')[4])
        if (route.endsWith('/download')) {
          const bytes = attachmentBytes.get(id)
          await cdp('Fetch.fulfillRequest', { requestId, responseCode: bytes ? 200 : 404,
            responseHeaders: [{ name: 'Content-Type', value: 'application/octet-stream' }, { name: 'Content-Disposition', value: 'attachment' }],
            body: (bytes ?? Buffer.alloc(0)).toString('base64') })
          return
        }
        if (method === 'POST' && attachmentControls.failUpload) {
          attachmentControls.failUpload = false; status = 503; response = { detail: 'Kho tệp đang bận. Hãy thử lại.' }
        } else if (method === 'POST') {
          const { name, bytes } = attachmentControls.nextUpload ?? { name: 'Bao cao.pdf', bytes: Buffer.from('%PDF-test') }
          attachmentControls.nextUpload = null
          const file = { ma: nextAttachment++, tenTep: name, kichThuocByte: bytes.length, ngayTao: new Date().toISOString() }
          attachmentBytes.set(file.ma, bytes)
          revision++; attachments.push(file); status = 201; response = envelope(file)
          const ownerTask = tasks.find(task => task.ma === Number(route.split('/')[2]))
          if (ownerTask) remember(ownerTask, 'Updated', null, { loaiHoatDong: 'AttachmentAdded', tenTep: file.tenTep })
        } else if (method === 'DELETE') {
          const offset = attachments.findIndex(file => file.ma === id)
          if (offset >= 0) {
            const [removed] = attachments.splice(offset, 1); attachmentBytes.delete(id); revision++
            const ownerTask = tasks.find(task => task.ma === Number(route.split('/')[2]))
            if (ownerTask) remember(ownerTask, 'Updated', null, { loaiHoatDong: 'AttachmentRemoved', tenTep: removed.tenTep })
          }
          status = offset >= 0 ? 204 : 404
        } else response = envelope(attachments)
      }
      else if (planningResponse) { status = planningResponse.status; response = planningResponse.response }
      else if (progressResponse) { status = progressResponse.status; response = progressResponse.response }
      else if (focusResponse) { status = focusResponse.status; response = focusResponse.response }
      else if (process.env.CORE_FOCUS_ONLY && method !== 'GET' && /^\/tasks\/\d+$/.test(route) && focusFixture.controls.failNextTaskUpdate) {
        focusFixture.controls.failNextTaskUpdate = false; status = 503; response = { detail: 'Chưa lưu được nhiệm vụ. Hãy thử lại.' }
      } else if (process.env.CORE_FOCUS_ONLY && method !== 'GET' && /^\/tasks\/\d+$/.test(route) && focusFixture.controls.conflictNextTaskUpdate) {
        focusFixture.controls.conflictNextTaskUpdate = false; revision++; status = 409; response = { code: 'DATA_VERSION_CONFLICT', detail: 'Dữ liệu đã đổi. Hãy tải dữ liệu mới.' }
      } else if (process.env.CORE_FOCUS_ONLY && method !== 'GET' && Object.entries(request.headers).some(([key, value]) => key.toLowerCase() === 'if-match' && value !== '\"ht-' + revision + '\"')) {
        status = 409; response = { code: 'DATA_VERSION_CONFLICT', detail: 'Phiên bản chưa được làm mới sau khi sửa nhiệm vụ.' }
      }
      else if (route === '/auth/login') response = { tokenTruyCap: token, loaiToken: 'Bearer', hetHanLuc: new Date(Date.now() + 3600000).toISOString(), nguoiDung: user }
      else if (route === '/users/me') response = user
      else if (route === '/priority-rules/active') response = { ma: 0, ten: 'Mặc định', phienBan: 0, dangSuDung: true, cauHinh: { phienBanSchema: 1, tieuChi: ['Importance', 'Deadline', 'InProgress'] }, ngayTao: null }
      else if (route === '/notifications' && method === 'GET') response = { danhSach: [], trang: Number(url.searchParams.get('trang') ?? 1), kichThuocTrang: 20, tongSo: 0, tongChuaDoc: 0, muiGio: user.muiGio, docDenLuc: new Date().toISOString() }
      else if (route === '/semesters') response = page([{ ma: 103, ten: 'Học kỳ thực hành', ngayBatDau: '2026-01-01', ngayKetThuc: '2027-12-31' }])
      else if (route === '/semesters/103/courses') response = page([{ ma: 207, maHocKy: 103, ten: 'Cơ sở dữ liệu', kyHieu: 'CSDL', soTinChi: 3, giangVien: null, mauSac: '#306BB5' }])
      else if (route === '/tasks' && method === 'GET') {
        const q = url.searchParams
        const pinFirst = q.get('ghimTruoc') === 'true' && q.get('cheDo') !== 'completed' && q.get('trangThai') !== 'Completed'
        let list = tasks.filter(t => (q.get('chiLa') === 'true' || ['today', 'upcoming', 'overdue', 'undated', 'completed'].includes(q.get('cheDo')) ? !t.coNhiemVuCon : !t.maNhiemVuCha || (pinFirst && t.daGhim)))
        if (q.has('maHocKy')) list = list.filter(t => String(t.maHocKy) === q.get('maHocKy'))
        if (q.has('maMonHoc')) list = list.filter(t => String(t.maMonHoc) === q.get('maMonHoc'))
        if (q.get('cheDo') === 'inbox') list = list.filter(t => t.maHocKy === null && t.maMonHoc === null)
        if (q.get('cheDo') === 'completed') list = list.filter(t => t.trangThai === 'Completed')
        else if (!q.has('trangThai')) list = list.filter(t => t.trangThai !== 'Completed')
        for (const key of ['mucDoUuTien', 'loai', 'trangThai']) if (q.has(key)) list = list.filter(t => t[key] === q.get(key))
        if (q.get('tuKhoa')) list = list.filter(t => t.tieuDe.toLowerCase().includes(q.get('tuKhoa').toLowerCase()))
        if (q.get('sapXep') === 'created') list.sort((a, b) => b.ma - a.ma)
        if (pinFirst) list.sort((a, b) => Number(!!b.daGhim) - Number(!!a.daGhim))
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
      } else if (/^\/tasks\/\d+\/pin$/.test(route) && method === 'PATCH') {
        const task = tasks.find(t => t.ma === Number(route.split('/')[2]))
        task.daGhim = body.daGhim
        revision++
        response = envelope(task)
      } else if (/^\/tasks\/\d+\/progress$/.test(route)) {
        const task = tasks.find(t => t.ma === Number(route.split('/')[2])); const before = JSON.stringify(task); task.tienDo = body.tienDo; task.trangThai = body.tienDo === 100 ? 'Completed' : body.tienDo ? 'InProgress' : 'NotStarted'; remember(task, 'Updated', before); revision++; response = envelope(task)
      } else if (/^\/tasks\/\d+\/(parent|scope|complete|reopen)$/.test(route)) {
        const task = tasks.find(t => t.ma === Number(route.split('/')[2])); const before = JSON.stringify(task)
        if (route.endsWith('/parent')) task.maNhiemVuCha = body.maNhiemVuCha
        else if (route.endsWith('/scope')) branch(task.ma).forEach(t => { t.maHocKy = body.maHocKy; t.maMonHoc = body.maMonHoc })
        else { task.tienDo = route.endsWith('/complete') ? 100 : 0; task.trangThai = task.tienDo === 100 ? 'Completed' : 'NotStarted' }
        if (process.env.CORE_CALENDAR_DEADLINES_ONLY === '1' && route.endsWith('/complete') && body.huyPhienLienQuan) for (const row of sessions) if (row.maNhiemVu === task.ma && row.trangThai === 'Planned') row.trangThai = 'Cancelled'
        remember(task, 'Updated', before); revision++; response = envelope(task)
      } else if (/^\/tasks\/\d+\/trash$/.test(route) && method === 'POST') {
        if (failNextDelete) { failNextDelete = false; status = 503; response = { detail: 'Chưa chuyển vào thùng rác. Hãy thử lại.' } }
        else {
          const rows = branch(Number(route.split('/')[2])); const ids = new Set(rows.map(row => row.ma)); trashedTasks.push(...rows)
          for (let index = tasks.length - 1; index >= 0; index--) if (ids.has(tasks[index].ma)) tasks.splice(index, 1)
          revision++; response = envelope({ soNhiemVu: rows.length })
        }
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
        } else { if (method === 'PUT') { remember({ ...task, ...body }, 'Updated', JSON.stringify(task)); Object.assign(task, body);
          if (process.env.CORE_FOCUS_ONLY && body.checklist?.length) {
            task.tienDo = Math.round(body.checklist.filter(item => item.daXong).length / body.checklist.length * 100);
            task.trangThai = task.tienDo === 100 ? 'Completed' : task.tienDo > 0 ? 'InProgress' : 'NotStarted'
          }
          revision++ }; response = envelope(task) }
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
        else response = envelope(sessions.filter(p =>
          (!url.searchParams.has('maNhiemVu') || p.maNhiemVu === Number(url.searchParams.get('maNhiemVu'))) &&
          (!url.searchParams.has('maLanApDung') || p.maLanApDung === Number(url.searchParams.get('maLanApDung')))
        ).map(p => {
          const task = tasks.find(t => t.ma === p.maNhiemVu)
          return { ...p, tieuDeNhiemVu: task.tieuDe, maHocKy: task.maHocKy, maMonHoc: task.maMonHoc }
        }))
      } else if (/^\/study-sessions\/\d+(\/(start|finish|miss|cancel))?$/.test(route)) {
        const session = sessions.find(p => p.ma === Number(route.split('/')[2]))
        if (method === 'PUT') { Object.assign(session, body); revision++ }
        else if (method === 'POST') {
          const action = route.split('/')[3]
          if (action === 'start' && session.trangThai !== 'InProgress') {
            session.batDauBamGio = new Date().toISOString()
            session.soGiayDaHoc = 0
          }
          if (action === 'finish' && session.batDauBamGio) {
            session.soGiayDaHoc += Math.max(0, Math.floor((Date.now() - Date.parse(session.batDauBamGio)) / 1000))
            session.batDauBamGio = null
          }
          session.trangThai = { start: 'InProgress', finish: 'Completed', miss: 'Missed', cancel: 'Cancelled' }[action]
          revision++
        }
        response = envelope(session)
      }
      else if (route === '/calendar' && process.env.CORE_CALENDAR_DEADLINES_ONLY === '1') {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: user.muiGio }).format(new Date())
        const dateTime = time => date + 'T' + time + ':00+07:00'
        const taskEvent = (task, loai, start, end = null) => ({
          ma: loai + '-' + task.ma, loai, maNguon: task.ma, tieuDe: task.tieuDe,
          batDau: dateTime(start), ketThuc: end && dateTime(end), trangThai: task.trangThai,
          tienDoNhiemVu: task.tienDo, coTheDanhDauHoanThanh: !task.coNhiemVuCon && !task.checklist?.length,
        })
        response = envelope({ muiGio: user.muiGio, suKien: [
          ...['16:50', '17:05', '18:00', '20:00'].map((time, index) => taskEvent(tasks[index], 'HanNhiemVu', time)),
          taskEvent(tasks[2], 'SuKien', '10:00', '11:30'),
          { ma: 'class-10', loai: 'LichHoc', maNguon: 10, tieuDe: 'Cơ sở dữ liệu', batDau: dateTime('09:00'), ketThuc: dateTime('10:00'), trangThai: null },
        ] })
      }
      else if (route === '/calendar') response = envelope({ muiGio: user.muiGio, suKien: sessions.filter(p => p.trangThai !== 'Cancelled').map(p => ({ ma: 'session-' + p.ma, loai: 'PhienTuHoc', maNguon: p.ma, maMonHoc: 207, tieuDe: tasks.find(t => t.ma === p.maNhiemVu).tieuDe, batDau: p.batDauDuKien, ketThuc: p.ketThucDuKien, trangThai: p.trangThai })) })
      else if (route === '/planning/preview') response = envelope({ tokenPreview: 'signed-fixture', cauHinhHoc: { phienHocPhut: 25, nghiGiuaPhienPhut: 5, gioiHanHocMoiNgayPhut: 180 }, maPhienThayThe: [], muiGio: user.muiGio, hetHanLuc: new Date(Date.now() + 600000).toISOString(), tongPhutCanXep: 50, tongPhutDaDat: 0, tongPhutDeXuat: 50, tongPhutChuaXep: 0, canhBao: [], phien: [{ maNhiemVu: tasks.find(t => t.tieuDe === 'Luyện truy vấn SQL').ma, tieuDe: 'Luyện truy vấn SQL', batDauDuKien: tomorrow + 'T12:00:00Z', ketThucDuKien: tomorrow + 'T12:50:00Z', lyDo: 'Còn 50 phút, phù hợp giờ rảnh' }] })
      else if (route === '/planning/apply') {
        if (!applied) { revision++; applied = true; sessions = body.phien.map((p, i) => ({ ...p, ma: i + 20, maLanApDung: 1, trangThai: 'Planned', ghiChu: null })) }
        if (loseApplyResponse) { loseApplyResponse = false; await cdp('Fetch.failRequest', { requestId, errorReason: 'ConnectionReset' }); return }
        response = envelope({ maLanApDung: 1, phien: sessions })
      } else { status = 404; response = { detail: 'Unexpected fixture route ' + route }; errors.push(method + ' ' + route) }
      if (status < 300 && method !== 'GET' && /^\/tasks/.test(route) && !route.endsWith('change-preview')) taskProgressFixture.normalize()
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
  const click = async selector => { await waitFor(`!!document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`) }
  const button = async text => {
    const expression = `Array.from((Array.from(document.querySelectorAll('dialog[open]')).at(-1) || document).querySelectorAll('button')).find(b => b.getClientRects().length && b.textContent.trim() === ${JSON.stringify(text)})`
    await waitFor('!!(' + expression + ') && !(' + expression + ').disabled'); await evaluate('(' + expression + ').click()')
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  }
  async function detailAction(text) {
    await click('.ht-detail-header-actions .ht-row-actions-trigger:not(:disabled)')
    await button(text)
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
  async function checkEarlySession(earlySession, task) {
    const returnUrl = await evaluate('location.href')
    const plannedInterval = [earlySession.batDauDuKien, earlySession.ketThucDuKien]
    const progressBefore = task.tienDo
    await button('Bắt đầu ngay')
    await waitFor('!!document.querySelector("#ht-focus-mode-heading")')
    await button('Quay lại')
    assert.equal(earlySession.trangThai, 'Planned')
    assert.equal(focusFixture.active(), null)
    await button('Bắt đầu ngay')
    await click('button[role=radio][aria-label="Đếm lên"]')
    assert.equal(earlySession.trangThai, 'Planned', 'Choosing a timer mode does not start studying until confirmed')
    await button('Bắt đầu học')
    await waitFor('location.pathname === "/focus" && !!document.querySelector(".focus-note-panel")')
    assert.equal(earlySession.trangThai, 'InProgress')
    assert.equal(focusFixture.active()?.cheDo, 'Stopwatch')
    assert.deepEqual([earlySession.batDauDuKien, earlySession.ketThucDuKien], plannedInterval)
    const actualStart = earlySession.batDauBamGio
    assert(Date.parse(actualStart) < Date.parse(earlySession.batDauDuKien))
    focusFixture.advance(2000)
    await cdp('Page.reload')
    await waitFor('!!document.querySelector(".focus-note-panel")')
    assert.equal(earlySession.batDauBamGio, actualStart)
    await button('Kết thúc')
    await button('Lưu và kết thúc')
    await waitFor('!!document.querySelector(".focus-completion")')
    assert.equal(earlySession.trangThai, 'Completed')
    assert(earlySession.soGiayDaHoc >= 2)
    assert.equal(task.tienDo, progressBefore)
    await cdp('Page.navigate', { url: returnUrl })
    await waitFor('!!document.querySelector(".ht-item[data-session-id]")')
    await button('Mở phiên')
    await waitFor('document.querySelector("dialog").textContent.includes("Cập nhật tiến độ nhiệm vụ")')
    await button('Cập nhật tiến độ nhiệm vụ')
    await field('input[name=tienDo]', '50')
    await submit()
    assert.equal(task.tienDo, 50)
  }
  await cdp('Page.navigate', { url: origin + '/login' })
  await field('input[name=taiKhoan]', user.email); await field('input[name=password]', 'Fixture123!'); await click('button[type=submit]')
  await waitFor('location.pathname === "/today"')
  if (process.env.CORE_CALENDAR_DEADLINES_ONLY === '1') {
    tasks[0].tieuDe = 'hihi'
    tasks[1].tieuDe = 'Bản báo cáo đồ án phần kết quả kiểm thử và đánh giá'
    tasks[2].tieuDe = 'Nộp bài tập SQL'
    Object.assign(tasks[3], { tieuDe: 'Chuẩn bị đề cương môn học', tienDo: 100, trangThai: 'Completed', checklist: [{ tieuDe: 'Lập dàn ý', daXong: true }] })
    await cdp('Page.navigate', { url: origin + '/calendar' })
    const more = '.ht-calendar-deadlines .ht-calendar-more[popovertarget]'
    await waitFor('!!document.querySelector(' + JSON.stringify(more) + ')')
    assert(calls.some(call => call.route === '/calendar' && new URLSearchParams(call.query).get('gomHanKeThua') === 'true'))
    assert(await evaluate('document.querySelector(".ht-calendar-deadlines").textContent.includes("hihi")'))
    assert(await evaluate('getComputedStyle(document.querySelector(".ht-calendar-deadlines")).overflowY === "visible"'))
    assert(await evaluate('getComputedStyle(document.querySelector(".ht-calendar-deadlines strong")).webkitLineClamp === "2"'))
    const desktopScroll = await evaluate('innerWidth >= 1051')
    if (desktopScroll) {
      assert(await evaluate('(() => { const page=document.querySelector(".ht-page-main"); const grid=document.querySelector(".ht-time-grid-wrap"); return page.scrollHeight > page.clientHeight && getComputedStyle(page).overflowY === "scroll" && getComputedStyle(grid).overflowY === "visible" })()'))
    }
    await click(more)
    await waitFor('document.querySelectorAll(".ht-calendar-deadline-popover:popover-open li").length === 4')
    assert(await evaluate('document.querySelector(".ht-calendar-deadline-popover:popover-open").textContent.includes("Bản báo cáo đồ án phần kết quả kiểm thử và đánh giá")'))
    assert.equal(await evaluate('document.querySelector(\'select[aria-label="Chế độ xem"]\').value'), 'week')
    const popup = '.ht-calendar-deadline-popover:popover-open '
    const complete = popup + 'input[aria-label="Hoàn thành Nộp bài tập SQL"]'
    const reopen = popup + 'input[aria-label="Mở lại Nộp bài tập SQL"]'
    const timed = '.ht-calendar-block.ht-event-SuKien'
    const finishedColor = 'getComputedStyle(document.querySelector(' + JSON.stringify(timed) + ')).backgroundColor'
    const activeColor = await evaluate(finishedColor)
    assert(await evaluate('!document.querySelector(\'' + popup + 'input[aria-label="Hoàn thành hihi"]\')'))
    assert(await evaluate('!document.querySelector(\'' + popup + 'input[aria-label="Mở lại Chuẩn bị đề cương môn học"]\')'))
    assert(await evaluate('!document.querySelector(".ht-calendar-block.ht-event-LichHoc input")'))
    await click(complete)
    await waitFor('!!document.querySelector(' + JSON.stringify(reopen) + ') && document.querySelector(' + JSON.stringify(timed) + ').dataset.completed === "true"')
    assert.notEqual(await evaluate(finishedColor), activeColor)
    assert(await evaluate('!document.querySelector("dialog:modal")'))
    assert.equal(tasks[2].tienDo, 100)
    await click(reopen)
    await waitFor('!!document.querySelector(' + JSON.stringify(complete) + ') && !document.querySelector(' + JSON.stringify(timed) + ').dataset.completed')
    assert.equal(tasks[2].tienDo, 0)
    await button('Đóng')
    await waitFor('!document.querySelector(".ht-calendar-deadline-popover:popover-open")')
    const relatedTask = tasks[1]
    const pendingSessions = [900, 901].map((ma, index) => ({ ma, maNhiemVu: relatedTask.ma, batDauDuKien: new Date(Date.now() + (index + 1) * 3600000).toISOString(), ketThucDuKien: new Date(Date.now() + (index + 1) * 3600000 + 25 * 60000).toISOString(), trangThai: 'Planned' }))
    sessions.push(...pendingSessions)
    const target = '.ht-calendar-deadlines input[aria-label="Hoàn thành ' + relatedTask.tieuDe + '"]'
    const scheduleScroll = desktopScroll ? '.ht-page-main' : '.ht-time-grid-wrap'
    await evaluate('document.querySelector(' + JSON.stringify(scheduleScroll) + ').scrollTop = 450')
    const positionBefore = await evaluate('document.querySelector(' + JSON.stringify(scheduleScroll) + ').scrollTop')
    const writesBefore = calls.filter(call => call.route === '/tasks/' + relatedTask.ma + '/complete').length
    await evaluate('document.querySelector(' + JSON.stringify(target) + ').focus({ preventScroll: true })')
    await click(target)
    await waitFor('document.querySelector(".ht-confirm-description")?.textContent.includes("2 phiên")')
    assert.equal(relatedTask.trangThai, 'NotStarted', 'Opening the impact confirmation does not complete the task')
    await button('Giữ nguyên')
    await waitFor('!document.querySelector(".ht-confirm-host")')
    assert.equal(calls.filter(call => call.route === '/tasks/' + relatedTask.ma + '/complete').length, writesBefore, 'Cancel sends no completion request')
    assert(pendingSessions.every(row => row.trangThai === 'Planned'))
    assert.equal(await evaluate('document.querySelector(' + JSON.stringify(target) + ').checked'), false)
    assert.equal(await evaluate('document.querySelector(' + JSON.stringify(scheduleScroll) + ').scrollTop'), positionBefore, 'Returning focus after cancel keeps calendar scroll')
    await click(target)
    await waitFor('!!document.querySelector(".ht-confirm-host")')
    await button('Hoàn thành và hủy phiên')
    await waitFor('document.querySelector(' + JSON.stringify(target.replace('Hoàn thành ', 'Mở lại ')) + ')?.checked === true')
    assert(pendingSessions.every(row => row.trangThai === 'Cancelled'))
    assert.equal(calls.filter(call => call.route === '/tasks/' + relatedTask.ma + '/complete').at(-1).body.huyPhienLienQuan, true)
    assert.equal(await evaluate('document.querySelector(' + JSON.stringify(scheduleScroll) + ').scrollTop'), positionBefore, 'Confirmed save also keeps the current time range visible')
    const expandedHeight = await evaluate('document.querySelector(".ht-time-heading").offsetHeight')
    await button('Thu gọn hạn')
    await waitFor('!!document.querySelector(".ht-calendar-deadline-count") && !document.querySelector(".ht-calendar-deadlines")')
    assert(await evaluate('document.querySelector(".ht-time-heading").offsetHeight') < expandedHeight)
    const scrollSelector = desktopScroll ? '.ht-page-main' : '.ht-time-grid-wrap'
    await evaluate('document.querySelector(' + JSON.stringify(scrollSelector) + ').scrollTop += ' + (desktopScroll ? 270 : 120))
    assert(await evaluate('(() => { const grid=document.querySelector(' + JSON.stringify(scrollSelector) + ').getBoundingClientRect(); const count=document.querySelector(".ht-calendar-deadline-count").getBoundingClientRect(); return count.top >= grid.top && count.bottom <= grid.top + 75 })()'))
    if (desktopScroll) {
      assert(await evaluate('(() => { const top=document.querySelector(".ht-page-main").getBoundingClientRect().top; return document.querySelector(".ht-calendar-toolbar").getBoundingClientRect().bottom < top && Math.abs(document.querySelector(".ht-time-heading").getBoundingClientRect().top - top) <= 1 })()'))
      if (process.env.CORE_DESKTOP_SCREENSHOT) {
        const shot = await cdp('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(process.env.CORE_DESKTOP_SCREENSHOT, Buffer.from(shot.data, 'base64'))
      }
    }
    await click('.ht-calendar-deadline-count')
    await waitFor('document.querySelectorAll(".ht-calendar-deadline-popover:popover-open li").length === 4')
    await button('Đóng')
    if (desktopScroll) await evaluate('document.querySelector(".ht-page-main").scrollTop = 0')
    await button('Hiện dải hạn')
    await waitFor('!!document.querySelector(".ht-calendar-deadlines")')
    await field('select[aria-label="Chế độ xem"]', 'day')
    await waitFor('document.querySelector(".ht-time-grid")?.dataset.singleDay === "true" && document.querySelectorAll(".ht-calendar-deadlines > .ht-event").length === 2')
    const dayLayout = await evaluate('(() => { const grid=document.querySelector(".ht-calendar-deadlines"); return { width:grid.clientWidth, display:getComputedStyle(grid).display, cards:[...grid.querySelectorAll(":scope > .ht-event")].map(card => ({ top:card.getBoundingClientRect().top, width:card.getBoundingClientRect().width })) } })()')
    assert(Math.abs(dayLayout.cards[0].top - dayLayout.cards[1].top) < 1, JSON.stringify(dayLayout))
    await field('select[aria-label="Chế độ xem"]', 'week')
    await waitFor('!!document.querySelector(' + JSON.stringify(more) + ')')
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 670, deviceScaleFactor: 1, mobile: true })
    await evaluate('document.querySelector(' + JSON.stringify(more) + ').scrollIntoView({block:"nearest",inline:"nearest"})')
    await click(more)
    await waitFor('!!document.querySelector(".ht-calendar-deadline-popover:popover-open")')
    await waitFor('(() => { const r=document.querySelector(".ht-calendar-deadline-popover:popover-open").getBoundingClientRect();return r.left >= 0 && r.right <= window.innerWidth + 1 && r.top >= 0 && r.bottom <= window.innerHeight + 1 })()')
    if (process.env.CORE_SCREENSHOT) {
      const shot = await cdp('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(process.env.CORE_SCREENSHOT, Buffer.from(shot.data, 'base64'))
    }
    await click('.ht-calendar-deadline-popover:popover-open .ht-calendar-deadline-item')
    await waitFor('!!document.querySelector("dialog:modal .ht-detail-title") && !document.querySelector(".ht-calendar-deadline-popover:popover-open")')
    assert(await evaluate('document.querySelector("dialog:modal .ht-detail-title h2").textContent === "hihi"'))
    assert.deepEqual(errors, [])
    await button('Đóng')
    await field('select[aria-label="Chế độ xem"]', 'day')
    await waitFor('document.querySelector(".ht-time-grid")?.dataset.singleDay === "true"')
    await click('.ht-calendar-options summary')
    await click('.ht-calendar-options input')
    await waitFor('!document.querySelector(".ht-event[data-completed=true]")')
    await evaluate('window.calendarBeforeReload = true')
    await cdp('Page.reload')
    await waitFor('window.calendarBeforeReload !== true && !!document.querySelector(".ht-calendar-options input") && !document.querySelector(".ht-calendar-options input").checked && !!document.querySelector(".ht-time-grid")')
    assert.equal(await evaluate("document.querySelector('select[aria-label=\"Chế độ xem\"]').value"), 'day', 'Calendar view and completed-item visibility survive reload')
    assert(!await evaluate('!!document.querySelector(".ht-event[data-completed=true]")'))
    assert.deepEqual(errors, [])
    console.log('PASS calendar: task completion/reopen, cancel versus confirm two sessions, unchanged checkbox on cancel, preserved scroll, view preferences, completed visibility, overflow, day view and mobile.')
  } else if (process.env.CORE_TASK_SCROLL_ONLY === '1') {
    for (let id = 900; id < 915; id++) {
      tasks.push(makeTask(id, { tieuDe: 'Bước dài ' + id, maHocKy: null, maMonHoc: null, maNhiemVuCha: 1, loai: 'Personal' }))
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 550, deviceScaleFactor: 1, mobile: false })
    await cdp('Page.navigate', { url: origin + '/tasks?view=all&task=3' })
    await waitFor('!!document.querySelector(".ht-detail-title")')
    const sizes = 'Array.from(document.querySelectorAll(".ht-task-list, .ht-detail-body"), node => node.clientWidth)'
    const initialSizes = await evaluate(sizes)
    const divider = '.ht-detail-divider'
    const line = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(divider)}); return {
      width: getComputedStyle(el, '::before').width, hitWidth: el.clientWidth, children: el.childElementCount,
      background: getComputedStyle(el).backgroundColor
    } })()`)
    assert.deepEqual(line, { width: '1px', hitWidth: 8, children: 0, background: 'rgba(0, 0, 0, 0)' })
    assert(await evaluate('document.querySelector(".ht-page-main").scrollHeight === document.querySelector(".ht-page-main").clientHeight'))
    assert(await evaluate('getComputedStyle(document.querySelector(".ht-tabs")).scrollbarColor === "rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)"'))
    assert(await evaluate('document.querySelector(".ht-tabs").scrollHeight > document.querySelector(".ht-tabs").clientHeight'))
    await click('.ht-task-list .ht-parent-toggle')
    await waitFor('document.querySelector(".ht-task-list").textContent.includes("Bước dài 914")')
    assert(await evaluate('document.querySelector(".ht-page-main").scrollHeight > document.querySelector(".ht-page-main").clientHeight'))
    assert.deepEqual(await evaluate(sizes), initialSizes)
    await evaluate("Array.from(document.querySelectorAll('.ht-task-name')).find(b => b.querySelector('strong').textContent === 'aaa').click()")
    await waitFor('document.querySelector(".ht-detail-title")?.textContent.includes("aaa")')
    assert(await evaluate('document.querySelector(".ht-detail-panel").scrollHeight > document.querySelector(".ht-detail-panel").clientHeight'))
    assert.deepEqual(await evaluate(sizes), initialSizes)
    assert(await evaluate('(() => {const list=document.querySelector(".ht-page-main");const detail=document.querySelector(".ht-detail-panel");list.scrollTop=25;detail.scrollTop=30;return list.scrollTop===25 && detail.scrollTop===30 && document.scrollingElement.scrollTop===0})()'))
    const handle = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(divider)}); const box = el.getBoundingClientRect(); return {
      x: box.x + box.width / 2, y: box.y + box.height / 2, width: Number(el.getAttribute('aria-valuenow'))
    } })()`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: handle.x, y: handle.y })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: handle.x - 32, y: handle.y })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: handle.x - 32, y: handle.y })
    await waitFor(`Number(document.querySelector(${JSON.stringify(divider)}).getAttribute('aria-valuenow')) === ${handle.width + 32}`)
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
    await waitFor(`Number(document.querySelector(${JSON.stringify(divider)}).getAttribute('aria-valuenow')) === ${handle.width + 16}`)
    await cdp('Emulation.setDeviceMetricsOverride', { width: 980, height: 550, deviceScaleFactor: 1, mobile: false })
    await waitFor(`getComputedStyle(document.querySelector(${JSON.stringify(divider)})).display === "none"`)
    await waitFor('getComputedStyle(document.querySelector(".ht-page-main")).overflowY === "visible"')
    assert(await evaluate('getComputedStyle(document.querySelector(".ht-page-body")).overflowY === "auto"'))
    assert(await evaluate('getComputedStyle(document.querySelector(".ht-detail-panel")).overflowY === "visible"'))
    await cdp('Emulation.setDeviceMetricsOverride', { width: 700, height: 550, deviceScaleFactor: 1, mobile: false })
    await waitFor('getComputedStyle(document.querySelector(".ht-page-body")).overflowY === "visible"')
    assert(await evaluate('getComputedStyle(document.querySelector(".ht-task-workspace")).overflowY === "auto"'))
    assert.deepEqual(errors, [])
    console.log('PASS cuộn nhiệm vụ: danh sách/chi tiết dài và ngắn giữ kích thước, thanh bên gọn và vùng cuộn đúng trên desktop/cửa sổ hẹp.')
  } else if (process.env.CORE_TASK_DEPTH_ONLY === '1') {
    const depthTasks = []
    for (let level = 1; level <= 6; level++) {
      depthTasks.push(makeTask(900 + level, {
        tieuDe: 'Lồng cấp ' + level,
        maNhiemVuCha: depthTasks.at(-1)?.ma ?? null,
        coNhiemVuCon: level < 6,
        daGhim: level === 5,
        duongDanNhiemVuCha: depthTasks.map(n => ({ ma: n.ma, tieuDe: n.tieuDe, hanHoanThanh: null })),
      }))
    }
    tasks.push(...depthTasks)
    const depth5Menu = '.ht-task-list .ht-row-actions-trigger[aria-label="Thao tác với Lồng cấp 5"]'
    await cdp('Page.navigate', { url: origin + '/tasks' })
    await click(depth5Menu)
    await waitFor('!!document.querySelector(".ht-row-actions-panel:popover-open")')
    assert.equal(await evaluate('document.querySelector(".ht-row-actions-panel:popover-open").textContent.includes("Thêm bước nhỏ")'), false)
    await evaluate('document.querySelector(".ht-row-actions-panel:popover-open").hidePopover()')

    await evaluate("Array.from(document.querySelectorAll('.ht-task-name')).find(b => b.querySelector('strong').textContent === 'Lồng cấp 1').click()")
    await waitFor('document.querySelectorAll(".ht-detail-body .ht-child-link").length === 5')
    const nestedTitles = await evaluate('Array.from(document.querySelectorAll(".ht-detail-body .ht-child-link"), b => b.textContent)')
    assert.deepEqual(nestedTitles, ['Lồng cấp 2', 'Lồng cấp 3', 'Lồng cấp 4', 'Lồng cấp 5', 'Lồng cấp 6'])
    assert(await evaluate('!document.querySelector(".ht-attachments") && document.querySelector(".ht-attachment-input").nextElementSibling.textContent.includes("Các bước nhỏ")'))
    await click('.ht-detail-step-toggle[aria-label="Thu gọn Lồng cấp 2"]')
    await waitFor('document.querySelectorAll(".ht-detail-body .ht-child-link").length === 1')
    await click('.ht-detail-step-toggle[aria-label="Mở rộng Lồng cấp 2"]')
    await waitFor('document.querySelectorAll(".ht-detail-body .ht-child-link").length === 5')
    const openStep = title => evaluate(`Array.from(document.querySelectorAll('.ht-child-link')).find(b => b.textContent === ${JSON.stringify(title)}).click()`)
    await openStep('Lồng cấp 4')
    await waitFor('document.querySelector(".ht-detail-title")?.textContent.includes("Lồng cấp 4") && document.querySelectorAll(".ht-child-link").length === 2')
    await button('+ Thêm bước nhỏ')
    await waitFor(`!!document.querySelector(${JSON.stringify('.ht-detail-body form[aria-label="Thêm bước nhỏ"]')})`)
    await openStep('Lồng cấp 5')
    await waitFor('document.querySelector(".ht-detail-title")?.textContent.includes("Lồng cấp 5") && document.querySelectorAll(".ht-child-link").length === 1')
    assert.equal(await evaluate('document.querySelector(".ht-detail-body").textContent.includes("Thêm bước nhỏ")'), false)
    await openStep('Lồng cấp 6')
    await waitFor('document.querySelector(".ht-detail-title")?.textContent.includes("Lồng cấp 6")')
    assert.equal(await evaluate('document.querySelector(".ht-detail-body").textContent.includes("Các bước nhỏ")'), false)
    assert.deepEqual(errors, [])
    console.log('PASS giới hạn cấp trên giao diện: cây thu gọn/mở rộng, cấp 4 được thêm, cấp 5 ghim ẩn thao tác, cấp 6 cũ vẫn mở được.')
  } else if (process.env.CORE_PIN_ONLY === '1') {
    const branch = '.ht-task-list > .ht-task-branch'
    const childMenu = '.ht-task-list [aria-label="Thao tác với aa"].ht-row-actions-trigger'
    await cdp('Page.navigate', { url: origin + '/tasks' })
    await click(branch + ' .ht-parent-toggle')
    await click(childMenu)
    await button('Ghim nhiệm vụ')
    await waitFor('document.querySelector(".ht-pin-heading")?.textContent === "Đã ghim"')
    assert(await evaluate(`document.querySelector(${JSON.stringify(branch + ' .ht-pin-mark')})?.closest('.ht-task-row').querySelector('strong').textContent.endsWith('aa')`))
    assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(childMenu)}).length`), 1, 'Pinned child renders as one row even while its parent is expanded')
    await cdp('Page.reload')
    await waitFor('document.querySelector(".ht-pin-heading")?.textContent === "Đã ghim"')
    await click(branch + ' .ht-task-name')
    await detailAction('Bỏ ghim nhiệm vụ')
    await waitFor('!document.querySelector(".ht-pin-heading") && !document.querySelector(".ht-detail-title .ht-pin-mark")')
    assert.equal(tasks.find(task => task.ma === 2).daGhim, false)
    assert.equal(calls.filter(call => call.method === 'PATCH' && call.route === '/tasks/2/pin').length, 2)
    assert.deepEqual(errors, [])
    console.log('PASS ghim nhiệm vụ: menu bước nhỏ, lên đầu, một hàng khi cây đang mở, tải lại và bỏ ghim từ chi tiết.')
  } else if (process.env.CORE_ATTACHMENTS_ONLY === '1') {
    await runAttachmentChecks({ origin, cdp, evaluate, waitFor, click, button, calls, errors, userDir, controls: attachmentControls })
  } else if (process.env.CORE_REMINDERS_ONLY === '1') {
    await runReminderChecks({ origin, cdp, evaluate, waitFor, click, button, calls, errors, settingsFixture: planningFixture.controls })
  } else if (process.env.CORE_PLANNING_ONLY === '1') {
    sessions.push({ ma: 900, maNhiemVu: 4, batDauDuKien: tomorrow + 'T12:00:00Z', ketThucDuKien: tomorrow + 'T12:25:00Z', trangThai: 'Planned' })
    await runPlanningUpgradeChecks({ origin, cdp, evaluate, waitFor, click, button, field, tasks, calls, errors })
  } else if (process.env.CORE_PROGRESS_ONLY === '1') {
    await runTaskProgressChecks({ origin, cdp, evaluate, waitFor, click, button, field, submit, tasks, calls, errors })
  } else if (process.env.CORE_FOCUS_ONLY === '1') {
    await runFocusChecks({ origin, cdp, evaluate, waitFor, click, button, field, submit, fixture: focusFixture, tasks, calls, errors })
  } else if (process.env.CORE_SESSION_ONLY === '1') {
    const task = makeTask(999, { tieuDe: 'B1 bắt đầu sớm', maHocKy: null, maMonHoc: null, tienDo: 25, trangThai: 'InProgress' })
    tasks.push(task)
    sessions = [{ ma: 999, maNhiemVu: task.ma, batDauDuKien: tomorrow + 'T10:00:00Z', ketThucDuKien: tomorrow + 'T10:50:00Z', trangThai: 'Planned' }]
    await cdp('Page.navigate', { url: origin + '/tasks?tab=sessions' })
    await waitFor('!!document.querySelector(".ht-item[data-session-id]")')
    await click('[data-session-status=Completed]')
    await waitFor('!document.querySelector(".ht-item[data-session-id]") && document.body.innerText.includes("Chưa có phiên trong nhóm này")')
    await cdp('Page.reload')
    await waitFor('document.querySelector("[data-session-status=Completed]")?.getAttribute("aria-pressed") === "true"')
    await button('Xem tất cả phiên')
    await button('Mở phiên')
    await checkEarlySession(sessions[0], task)

    const plannedStart = new Date(Date.now() - 5 * 60000).toISOString()
    const plannedEnd = new Date(Date.now() + 20 * 60000).toISOString()
    const pomodoroSession = { ma: 1000, maNhiemVu: task.ma, batDauDuKien: plannedStart, ketThucDuKien: plannedEnd, trangThai: 'Planned' }
    sessions = [pomodoroSession]
    await cdp('Page.reload')
    await waitFor(`!!document.querySelector('.ht-item[data-session-id="1000"]')`)
    await click('.ht-item[data-session-id="1000"] button.ht-primary')
    await waitFor('!!document.querySelector("#ht-focus-mode-heading")')
    if (process.env.FOCUS_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.FOCUS_SCREENSHOT_DIR, { recursive: true })
      fs.writeFileSync(path.join(process.env.FOCUS_SCREENSHOT_DIR, 'planning-mode-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
      await waitFor('document.querySelector("dialog[open]").getBoundingClientRect().width <= innerWidth')
      fs.writeFileSync(path.join(process.env.FOCUS_SCREENSHOT_DIR, 'planning-mode-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
      await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    }
    await evaluate("const radio = document.querySelector('button[role=radio][aria-label=\"Pomodoro\"]'); radio.focus(); radio.dispatchEvent(new KeyboardEvent(\"keydown\", { key: \"ArrowRight\", bubbles: true }))")
    await waitFor("document.querySelector('button[role=radio][aria-label=\"Đếm lên\"]').getAttribute(\"aria-checked\") === \"true\"")
    await click('button[role=radio][aria-label="Pomodoro"]')
    assert.equal(focusFixture.active(), null)
    await button('Bắt đầu học')
    await waitFor('location.pathname === "/focus" && !!document.querySelector(".focus-note-panel")')
    assert.equal(focusFixture.active()?.cheDo, 'Pomodoro')
    assert.equal(focusFixture.active()?.maPhienTuHoc, pomodoroSession.ma)
    assert.deepEqual([pomodoroSession.batDauDuKien, pomodoroSession.ketThucDuKien], [plannedStart, plannedEnd])
    focusFixture.advance(3000)
    await button('Kết thúc')
    await button('Lưu và kết thúc')
    await waitFor('!!document.querySelector(".focus-completion")')
    const record = focusFixture.records.find(row => row.maPhienTuHoc === pomodoroSession.ma)
    const before = record.soMiliGiayDaHoc
    await click('.focus-record-open')
    await button('Sửa thời gian')
    await waitFor('!!document.querySelector("dialog input[name=end]")')
    await field('input[name=end]', await evaluate('document.querySelector("dialog input[name=start]").value'))
    await button('Lưu thời gian')
    await waitFor('document.querySelector("dialog [role=alert]")?.textContent.includes("phải trước")')
    const corrected = new Date(Date.parse(record.ketThuc) - 1000)
    const local = new Intl.DateTimeFormat('sv-SE', { timeZone: user.muiGio, dateStyle: 'short', timeStyle: 'medium' }).format(corrected).replace(' ', 'T')
    await field('input[name=end]', local + corrected.toISOString().slice(19, -1))
    await button('Lưu thời gian')
    await waitFor(`!!document.querySelector('dialog[aria-label="Chi tiết lần tập trung"]')`)
    assert.equal(record.soMiliGiayDaHoc, before - 1000)
    assert.equal(task.tienDo, 50)
    await button('Sửa thời gian')
    await click('dialog details summary')
    await waitFor('document.querySelector("dialog details[open]").textContent.includes("Trước") && document.querySelector("dialog details[open]").textContent.includes("Sau")')
    await button('Hủy')
    await waitFor(`!!document.querySelector('dialog[aria-label="Chi tiết lần tập trung"]')`)
    assert.deepEqual(errors, [])
    console.log('PASS session UI: cancel mode selection, scheduled Stopwatch and Pomodoro, reload, progress, time edit validation and audit. ' + calls.length + ' fixture requests.')
  } else {
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
  await waitFor('document.querySelector(".ht-success-toast p")?.textContent === "Đã hoàn thành “vbbbb”"')
  assert(await evaluate(syncIsSpinning))
  await button("Đã hoàn thành")
  await waitFor(`document.querySelector(${JSON.stringify(checked)})?.checked`)
  assert(await evaluate(`!!document.querySelector(${JSON.stringify(checked)})?.closest('.ht-task-completed')`))
  assert.equal(completionWrites(), 1)
  await click(checked)
  await waitFor('document.querySelector(".ht-success-toast p")?.textContent === "Đã mở lại “vbbbb”"')
  await button("Tất cả nhiệm vụ")
  await waitFor(`document.querySelector(${JSON.stringify(unchecked)})?.checked === false`)
  assert(!await evaluate(`document.querySelector(${JSON.stringify(unchecked)})?.closest('.ht-task-completed')`))
  await waitFor('document.querySelector(".ht-filter-toggle")?.getAttribute("aria-expanded") === "false"')
  assert(await evaluate('document.querySelector(".ht-filter-panel").hidden'))
  assert(await evaluate('document.querySelector(".ht-task-search input").getBoundingClientRect().height === 0'))
  const beforeFilterToggle = await evaluate('location.href')
  const beforeFilterTop = await evaluate('document.querySelector(".ht-task-list").getBoundingClientRect().top')
  const readsBeforeFilterToggle = calls.filter(c => c.route === '/tasks' && c.method === 'GET').length
  await button('Mở bộ lọc')
  await waitFor('!document.querySelector(".ht-filter-panel").hidden')
  assert(await evaluate('document.querySelector(".ht-task-search input").getBoundingClientRect().height > 0'))
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
    return getComputedStyle(nav).flexDirection === 'column' && ['Nhiệm vụ', 'Bảng trạng thái'].every(label => buttons.some(button => button.textContent.trim() === label)) &&
      boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom) &&
      nav.getBoundingClientRect().right <= content.left
  })()`), 'Learning navigation must be vertical and positioned to the left of content')
  assert(await evaluate('document.querySelector(".ht-workspace").getBoundingClientRect().width >= document.querySelector("#main-content").clientWidth - 2'))
  await button('Mở bộ lọc')
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
  await button('Đã hoàn thành')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await click(checked)
  await waitFor('!document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await button('Tất cả nhiệm vụ')
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("vbbbb")')
  await field('.ht-quick-add input', 'Ghi nhanh việc cá nhân')
  await button('Thêm nhanh')
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
  await waitFor('document.querySelector(".ht-detail-divider").getAttribute("aria-valuenow") === "400"')
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(process.env.CORE_SCREENSHOT.replace('.png', '-personal.png'), Buffer.from(shot.data, 'base64'))
  }
  assert.equal(quickTask.maHocKy, null)
  assert.equal(quickTask.maMonHoc, null)
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Fixture clipboard unavailable') } } })`)
  await detailAction('Sao chép liên kết')
  await waitFor(`!!document.querySelector('input[aria-label="Liên kết nhiệm vụ"]')`)
  const deepLink = await evaluate(`document.querySelector('input[aria-label="Liên kết nhiệm vụ"]').value`)
  assert(deepLink.endsWith('/tasks?task=' + quickTask.ma))
  await cdp('Page.navigate', { url: deepLink })
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Ghi nhanh việc cá nhân"')
  await button('Chưa đặt hạn')
  await field('input[name=tieuDe]', 'Việc cá nhân đã sửa')
  await submit()
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Việc cá nhân đã sửa"')
  await detailAction('Hoạt động nhiệm vụ')
  await waitFor('document.querySelector(".ht-task-history[open] .ht-history")?.textContent.includes("Đã đổi tên")')
  assert.equal(await evaluate('document.querySelectorAll(".ht-task-history pre").length'), 0)
  await button('Đóng')
  await waitFor('!document.querySelector(".ht-task-history") && !!document.querySelector(".ht-detail-panel")')
  await detailAction('Chỉnh sửa')
  await field('input[name=tieuDe]', 'Nội dung từ biểu mẫu cũ')
  const beforeStaleWrite = calls.filter(call => call.method === 'PUT' && call.route.startsWith('/tasks/')).length
  revision++
  await evaluate('document.querySelector("dialog form").requestSubmit()')
  await waitFor('document.querySelector("dialog [role=alert]")?.textContent.includes("Dữ liệu đã đổi")')
  assert.equal(calls.filter(call => call.method === 'PUT' && call.route.startsWith('/tasks/')).length, beforeStaleWrite)
  await button('Đóng'); await click('.ht-sidebar-sync')
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Việc cá nhân đã sửa"')
  const deletesBefore = calls.filter(call => call.method === 'DELETE').length
  failNextDelete = true
  await detailAction('Chuyển vào thùng rác')
  await waitFor('document.querySelector(".ht-error")?.textContent.includes("Chưa chuyển vào thùng rác")')
  assert(tasks.includes(quickTask) && !trashedTasks.includes(quickTask), 'A failed trash request retains the task')
  await detailAction('Chuyển vào thùng rác')
  await waitFor('!document.querySelector(".ht-detail-panel") && !document.querySelector(".ht-task-list")?.textContent.includes("Việc cá nhân đã sửa")')
  assert(!tasks.includes(quickTask) && trashedTasks.includes(quickTask), 'Trash preserves the removed task instead of permanently deleting it')
  assert.equal(calls.filter(call => call.method === 'DELETE').length, deletesBefore)
  await waitFor('document.querySelector(".ht-success-toast")?.textContent.includes("vào thùng rác")')
  await click('.ht-sidebar-sync')
  await waitFor('!!document.querySelector(".ht-task-list")')
  await click('.flow-global-create:not(:disabled)')
  await waitFor('!!document.querySelector("dialog:modal")')
  await field('input[name=tieuDe]', 'Làm bài tập tuần')
  await field('select[name=maHocKy]', '103'); await field('select[name=maMonHoc]', '207')
  await submit()
  assert(calls.some(call => call.route === '/tasks' && call.method === 'POST' && call.body.tieuDe === 'Làm bài tập tuần' && call.body.maMonHoc === 207 && call.body.maHocKy === 103))
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Làm bài tập tuần"')
  await click('button[aria-label="Thao tác với Làm bài tập tuần"]')
  await button('Thêm bước nhỏ')
  await field('input[name=tenBuocNho]', 'Bước nhanh từ chi tiết')
  await evaluate('document.querySelector(".ht-inline-child").requestSubmit()')
  await waitFor('document.querySelector(".ht-detail-panel")?.textContent.includes("Bước nhanh từ chi tiết")')
  const quickStep = calls.findLast(call => call.route.endsWith('/children')).body.danhSach[0]
  assert.equal(quickStep.tieuDe, 'Bước nhanh từ chi tiết')
  assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: user.muiGio, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(quickStep.hanHoanThanh)), '23:59')
  await button('+ Thêm bước nhỏ')
  await button('Thêm nhiều bước hoặc tùy chọn')
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
  await waitFor('document.querySelector(".ht-task-list")?.textContent.includes("Luyện truy vấn SQL")')
  assert(await evaluate(`!!document.querySelector('button[aria-label="Thu gọn các bước nhỏ"]')`))
  await evaluate('Array.from(document.querySelectorAll(".ht-task-name")).find(button => button.querySelector("strong").textContent === "Luyện truy vấn SQL").click()')
  await waitFor('document.querySelector(".ht-detail-panel h2")?.textContent === "Luyện truy vấn SQL"')
  await click('button[aria-label="Thao tác với Luyện truy vấn SQL"]')
  await waitFor('!!document.querySelector(".ht-row-actions-panel:popover-open")')
  await evaluate('Array.from(document.querySelectorAll(".ht-row-actions-panel:popover-open button")).find(b => b.textContent === "Cập nhật tiến độ").click()')
  await field('input[name=tienDo]', '25')
  assert.equal(await evaluate(`document.querySelector('dialog input[type="range"]').value`), '25')
  await submit()
  await waitFor('document.querySelector(".ht-detail-panel")?.textContent.includes("25%")')
  await detailAction('Chuyển hoặc tách nhiệm vụ')
  await field('select[name=nhomNhiemVu]', 'tach-rieng'); await submit()
  const studying = tasks.find(task => task.tieuDe === 'Luyện truy vấn SQL')
  assert.equal(studying.maNhiemVuCha, null)
  await detailAction('Đổi học kỳ hoặc môn')
  await field('select[name=maHocKy]', ''); await submit()
  assert.equal(studying.maHocKy, null)
  assert.equal(studying.maMonHoc, null)
  await detailAction('Chuyển vào nhiệm vụ lớn')
  await field('select[name=nhomNhiemVu]', '1')
  await waitFor('!!document.querySelector(' + JSON.stringify('select[name="maNhiemVuCha"] option[value="2"]') + ')')
  await field('select[name=maNhiemVuCha]', '2'); await submit()
  assert.equal(studying.maNhiemVuCha, 2)
  await detailAction('Chuyển hoặc tách nhiệm vụ')
  await field('select[name=nhomNhiemVu]', 'tach-rieng'); await submit()
  assert.equal(studying.maNhiemVuCha, null)
  await detailAction('Xem phiên tự học')
  await waitFor('document.querySelector(".ht-study-view")?.textContent.includes("Luyện truy vấn SQL")')
  await button('+ Đặt phiên tự học')
  await field('input[name=batDau]', tomorrow + 'T20:00')
  await field('input[name=ketThuc]', tomorrow + 'T20:50'); await submit()
  assert.equal(sessions[0].maNhiemVu, studying.ma)
  await button('Mở phiên'); await button('Dời phiên')
  await field('input[name=batDau]', tomorrow + 'T21:00')
  await field('input[name=ketThuc]', tomorrow + 'T21:50'); await submit()
  await button('Mở phiên'); await button('Hủy phiên')
  assert.equal(sessions[0].trangThai, 'Cancelled')
  const moment = Date.now()
  for (const [ma, start, end] of [[200, -10, 10], [201, -60, -10], [202, -120, -90]]) {
    sessions.push({ ma, maNhiemVu: studying.ma, batDauDuKien: new Date(moment + start * 60000).toISOString(), ketThucDuKien: new Date(moment + end * 60000).toISOString(), trangThai: 'Planned', ghiChu: null })
  }
  revision++
  await click('.ht-sidebar-sync')
  await waitFor('!!document.querySelector(\'[data-session-id="200"]\')')
  await click('[data-session-id="200"] button'); await button('Bắt đầu học')
  await waitFor('location.pathname === "/focus" && !!document.querySelector(".focus-note-panel")')
  assert.equal(sessions.find(p => p.ma === 200).trangThai, 'InProgress')
  await button('Kết thúc'); await button('Lưu và kết thúc')
  assert.equal(sessions.find(p => p.ma === 200).trangThai, 'Completed')
  await cdp('Page.navigate', { url: origin + '/tasks?tab=sessions' })
  await waitFor('!!document.querySelector(\'[data-session-id="201"]\')')
  await click('[data-session-id="201"] button'); await button('Xác nhận đã học xong')
  assert.equal(sessions.find(p => p.ma === 201).trangThai, 'Completed')
  await click('[data-session-id="202"] button'); await button('Xác nhận bỏ lỡ')
  assert.equal(sessions.find(p => p.ma === 202).trangThai, 'Missed')
  await button('Đóng')
  await click('.sidebar a[href="/planning"]')
  await waitFor('!!document.querySelector(".ht-planning-overview")')
  await button('Giờ rảnh của tôi'); await button('+ Thêm giờ rảnh')
  await submit()
  assert.equal(availability.length, 1)
  await button('Danh sách')
  await button('Sửa lịch lặp')
  await field('input[name=gioKetThuc]', '22:00'); await submit()
  assert.equal(availability[0].gioKetThuc, '22:00:00')
  await button('Lịch học theo môn')
  await field('select[aria-label="Lọc theo học kỳ"]', '103')
  await field('select[aria-label="Lọc theo môn học"]', '207')
  await button('+ Thêm buổi học')
  await waitFor('!!document.querySelector("dialog[open] input[name=toanHocKy]")')
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
  await waitFor('document.body.innerText.includes("Chưa rõ lịch đã được lưu chưa")')
  await cdp('Page.reload')
  await waitFor('document.body.innerText.includes("Có yêu cầu áp dụng chưa xác định kết quả")')
  await button('Thử lại cùng yêu cầu áp dụng')
  await waitFor('!!document.querySelector("#planning-complete-title")')
  await button('Xem phiên tự học')
  await waitFor('new URLSearchParams(location.search).get("studyBatch") === "1"')
  const applyCall = calls.find(call => call.route === '/planning/apply')
  assert(applyCall.headers['Idempotency-Key'] || applyCall.headers['idempotency-key'])
  assert.equal(applyCall.body.tokenPreview, 'signed-fixture')
  const retries = calls.filter(call => call.route === '/planning/apply')
  assert.equal(retries.length, 2)
  assert.deepEqual(retries[0].body, retries[1].body)
  assert.equal(retries[0].headers['Idempotency-Key'], retries[1].headers['Idempotency-Key'])
  await waitFor('document.querySelector(".ht-item[data-session-id]")?.textContent.includes("Luyện truy vấn SQL")').catch(error => {
    throw new Error(error.message + '\nFixture state ' + JSON.stringify({ sessions, task: tasks.find(t => t.tieuDe === 'Luyện truy vấn SQL'), lastReads: calls.filter(c => c.method === 'GET').slice(-10).map(c => ({ route: c.route, query: c.query })) }))
  })
  await button('Mở phiên')
  await waitFor('!!document.querySelector("dialog:modal")')
  assert(await evaluate('document.querySelector("dialog").textContent.includes("Hủy phiên")'))
  assert(await evaluate('document.querySelector("dialog").textContent.includes("Bắt đầu ngay")'))
  await checkEarlySession(sessions[0], studying)
  await button('Xem trên thời khóa biểu')
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
  await click('.sidebar a[href="/tasks"]')
  await waitFor('!!document.querySelector(".ht-task-list")')
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
  await click('.sidebar a[href="/planning"]')
  await waitFor('!!document.querySelector(".ht-planning-overview")')
  await button('Giờ rảnh của tôi')
  await button('Danh sách')
  await waitFor('!!document.querySelector(".ht-item")')
  await button('Xóa')
  await button('Xóa giờ rảnh')
  await waitFor('document.querySelectorAll(".ht-item").length === 0')
  assert.equal(availability.length, 0)
  assert.deepEqual(errors, [])
  const writes = calls.filter(call => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(call.method) && call.route !== '/auth/login')
  const unexpectedWrites = writes.filter(call => !(/^\/(tasks|availability-windows|calendar|planning|study-sessions)(\/|$)/.test(call.route) || /^\/courses\/\d+\/class-sessions$/.test(call.route) || /^\/class-sessions\/\d+$/.test(call.route) || /^\/focus\/(start|\d+\/(pause|resume|finish))$/.test(call.route)))
  assert.deepEqual(unexpectedWrites.map(call => ({ route: call.route, method: call.method })), [], 'Only intended task, planning and focus operations may mutate fixture data')
  console.log('PASS core UI: named selectors, task creation, small steps, availability, planning preview/apply, session actions and month calendar. ' + calls.length + ' fixture requests. Academic/auth mutations stayed untouched.')
  }
  checksPassed = true
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: 1000000, method: 'Browser.close' }))
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  for (const task of waiting.values()) clearTimeout(task.timer)
  waiting.clear()
  socket?.close(); browser?.kill()
  sessionFixture.close()
  vite.httpServer?.closeAllConnections()
  let closeTimer
  await Promise.race([vite.close(), new Promise(resolve => { closeTimer = setTimeout(resolve, 3000) })])
  clearTimeout(closeTimer)
  const resolved = path.resolve(userDir)
  if (resolved.startsWith(path.resolve(tempPrefix)) && path.dirname(resolved) === path.resolve(os.tmpdir())) {
    try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* Trình duyệt có thể còn giữ tạm thư mục hồ sơ. */ }
  }
  if (checksPassed) process.exit(0)
}
