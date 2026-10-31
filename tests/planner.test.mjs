import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => { await server.close(); delete globalThis.localStorage; delete globalThis.sessionStorage })
const model = await server.ssrLoadModule('/src/utils/planner.ts')
const storage = await server.ssrLoadModule('/src/data/planner.ts')
const demoAuth = await server.ssrLoadModule('/src/utils/demoAuth.ts')
const adminAuth = await server.ssrLoadModule('/src/admin/adminAuth.ts')
const fixtures = await server.ssrLoadModule('/tests/fixtures/planner.ts')
const student = await server.ssrLoadModule('/src/utils/studentView.ts')
const workspace = await server.ssrLoadModule('/src/utils/workspace.ts')
const { TaskEditor } = await server.ssrLoadModule('/src/components/TaskEditor.tsx')
const { PlannerProvider } = await server.ssrLoadModule('/src/contexts/PlannerContext.tsx')
const { default: App } = await server.ssrLoadModule('/src/App.tsx')
const now = Date.parse('2026-10-15T12:00:00+07:00')
const task = (overrides = {}) => ({ id: 'test', subjectId: 'math', title: 'Nhiệm vụ thử', description: '', kind: 'assignment', dueDate: '2026-10-15', dueTime: '12:00', status: 'todo', importance: 'normal', subtasks: [], ...overrides })

test('overdue uses Vietnam deadline and does not reclassify finished tasks', () => {
  assert.equal(model.taskStatus(task(), now), 'todo')
  assert.equal(model.taskStatus(task(), now + 1), 'overdue')
  assert.equal(model.taskStatus(task({ status: 'doing' }), now + 1), 'overdue')
  assert.equal(model.taskStatus(task({ status: 'done' }), now + 1), 'done')
  assert.equal(model.isLateCompletion(task({ status: 'done', completedAt: '2026-10-15T12:01:00+07:00' })), true)
  assert.equal(model.isLateCompletion(task({ status: 'done', completedAt: '2026-10-15T11:59:00+07:00' })), false)
})

test('priority puts overdue first, then urgent tasks, and excludes completed work', () => {
  const tasks = [task({ id: 'far', dueDate: '2026-10-25', importance: 'high' }), task({ id: 'urgent', dueTime: '13:00' }), task({ id: 'overdue', dueTime: '10:00', importance: 'low' }), task({ id: 'done', status: 'done', dueDate: '2026-10-01' })]
  assert.deepEqual(model.prioritizedTasks(tasks, now).map((item) => item.id), ['overdue', 'urgent', 'far'])
  assert(model.priorityScore(task({ kind: 'exam' }), now) > model.priorityScore(task(), now))
  assert(model.priorityScore(task({ importance: 'high' }), now) > model.priorityScore(task({ importance: 'low' }), now))
})

test('alerts include overdue and the next 72 hours, and change key when a deadline expires', () => {
  const tasks = [task({ id: 'past', dueTime: '11:00' }), task({ id: 'edge', dueDate: '2026-10-18' }), task({ id: 'outside', dueDate: '2026-10-18', dueTime: '12:01' }), task({ id: 'done', status: 'done' })]
  assert.deepEqual(model.dueAlerts(tasks, now).map((alert) => alert.task.id), ['past', 'edge'])
  const before = model.dueAlerts([task()], now)[0]
  const after = model.dueAlerts([task()], now + 1)[0]
  assert.notEqual(before.key, after.key)
  assert(after.overdue)
})

test('completing all subtasks finishes the parent; reopening one resumes work', () => {
  let data = fixtures.createPlannerFixture()
  const target = { ...task(), subtasks: [{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B', done: false }] }
  data = model.plannerReducer(data, { type: 'save-task', value: target })
  data = model.plannerReducer(data, { type: 'toggle-subtask', taskId: target.id, subtaskId: 'b', now: new Date(now).toISOString() })
  assert.equal(data.tasks.find((item) => item.id === target.id).status, 'done')
  assert(data.tasks.find((item) => item.id === target.id).completedAt)
  data = model.plannerReducer(data, { type: 'toggle-subtask', taskId: target.id, subtaskId: 'a', now: new Date(now).toISOString() })
  assert.equal(data.tasks.find((item) => item.id === target.id).status, 'doing')
  assert.equal(data.tasks.find((item) => item.id === target.id).completedAt, undefined)
  const unchanged = model.plannerReducer(data, { type: 'toggle-subtask', taskId: target.id, subtaskId: 'missing', now: new Date(now).toISOString() })
  assert.deepEqual(unchanged.tasks, data.tasks)
})

test('task status completion finishes subtasks and keeps the first completion time', () => {
  let data = fixtures.createPlannerFixture()
  data = model.plannerReducer(data, { type: 'task-status', id: 'task-project', status: 'done', now: new Date(now).toISOString() })
  const result = data.tasks.find((item) => item.id === 'task-project')
  assert(result.subtasks.every((subtask) => subtask.done))
  data = model.plannerReducer(data, { type: 'task-status', id: 'task-project', status: 'done', now: new Date(now + 10000).toISOString() })
  assert.equal(data.tasks.find((item) => item.id === 'task-project').completedAt, result.completedAt)
})

test('subject deletion removes linked tasks, schedule and read markers without touching other subjects', () => {
  let data = fixtures.createPlannerFixture()
  const unrelated = data.tasks.filter((item) => item.subjectId !== 'math')
  data.readAlerts = ['task-math:2026-10-15:12:00:soon', 'task-project:2026-10-15:12:00:soon']
  data = model.plannerReducer(data, { type: 'delete-subject', id: 'math' })
  assert(!data.subjects.some((item) => item.id === 'math'))
  assert(!data.schedule.some((item) => item.subjectId === 'math'))
  assert.deepEqual(data.tasks, unrelated)
  assert.deepEqual(data.readAlerts, ['task-project:2026-10-15:12:00:soon'])
  assert(storage.isPlannerData(data))
})

test('semester CRUD selects a valid replacement and handles an entirely empty planner', () => {
  let data = fixtures.createPlannerFixture()
  data = model.plannerReducer(data, { type: 'delete-semester', id: 'semester-1' })
  assert.equal(data.selectedSemesterId, 'semester-2')
  assert.equal(data.subjects.length, 0)
  assert.equal(data.tasks.length, 0)
  data = model.plannerReducer(data, { type: 'delete-semester', id: 'semester-2' })
  assert.equal(data.selectedSemesterId, '')
  assert(storage.isPlannerData(data))
  data = model.plannerReducer(data, { type: 'save-semester', value: { id: 'new', name: 'Học kỳ mới', startDate: '2026-01-01', endDate: '2026-12-31' } })
  assert.equal(data.selectedSemesterId, 'new')
  assert.equal(model.completion([]), 0)
  assert(storage.isPlannerData(data))
})

test('moving a subject between semesters moves its tasks into that semester scope', () => {
  let data = fixtures.createPlannerFixture()
  const math = data.subjects.find((item) => item.id === 'math')
  data = model.plannerReducer(data, { type: 'save-subject', value: { ...math, semesterId: 'semester-2' } })
  assert(!model.semesterTasks(data).some((item) => item.subjectId === 'math'))
  data = model.plannerReducer(data, { type: 'select-semester', id: 'semester-2' })
  assert(model.semesterTasks(data).every((item) => item.subjectId === 'math'))
  assert(model.semesterTasks(data).length > 0)
})

test('schedule rejects actual overlaps but permits adjacent times and separate dates', () => {
  const slot = { id: 'a', weekday: 4, start: '08:00', end: '09:30' }
  assert(model.slotsOverlap(slot, { ...slot, id: 'b', start: '09:00' }))
  assert(!model.slotsOverlap(slot, { ...slot, id: 'b', start: '09:30', end: '11:00' }))
  assert(!model.slotsOverlap(slot, { ...slot, id: 'b', weekday: 5 }))
  assert(!model.slotsOverlap({ ...slot, date: '2026-10-15' }, { ...slot, id: 'b', date: '2026-10-22' }))
  assert(!model.slotsOverlap(slot, slot))
})

test('calendar shows recurring slots only inside their semester and dated slots only once', () => {
  const data = fixtures.createPlannerFixture()
  data.semesters[0] = { id: 'semester-1', name: 'Kỳ thử', startDate: '2026-10-01', endDate: '2026-10-31' }
  data.schedule = [{ id: 'weekly', subjectId: 'math', title: 'Weekly', weekday: 4, start: '08:00', end: '09:00', room: '', note: '' }, { id: 'once', subjectId: 'web', title: 'Once', weekday: 4, date: '2026-10-15', start: '10:00', end: '11:00', room: '', note: '' }]
  assert.equal(model.slotsOnDate(data, new Date('2026-10-15T12:00:00')).length, 2)
  assert.equal(model.slotsOnDate(data, new Date('2026-10-22T12:00:00')).length, 1)
  assert.equal(model.slotsOnDate(data, new Date('2026-11-05T12:00:00')).length, 0)
  assert.equal(model.slotsOnDate(data, new Date('2026-10-16T12:00:00')).length, 0)
  assert.equal(model.dateKey(model.moveMonth(new Date('2026-01-31T12:00:00'), 1)), '2026-02-28')
  assert.equal(model.dateKey(model.weekDates(new Date('2026-10-18T12:00:00'))[0]), '2026-10-12')
})

test('read markers are deduplicated and completion metrics count each task once', () => {
  let data = fixtures.createPlannerFixture()
  data = model.plannerReducer(data, { type: 'read-alerts', keys: ['one', 'one', 'two'] })
  data = model.plannerReducer(data, { type: 'read-alerts', keys: ['one', 'three'] })
  assert.deepEqual(data.readAlerts, ['one', 'two', 'three'])
  assert.equal(model.completion([task(), task({ status: 'done' })]), 50)
  assert.equal(model.completion([task({ status: 'done' })]), 100)
})

test('storage accepts valid data and rejects damaged relationships, statuses and times', () => {
  const data = fixtures.createPlannerFixture()
  assert(storage.isPlannerData(JSON.parse(JSON.stringify(data))))
  assert(!storage.isPlannerData({ ...data, tasks: [{ ...data.tasks[0], subjectId: 'missing' }] }))
  assert(!storage.isPlannerData({ ...data, tasks: [{ ...data.tasks[0], status: 'overdue' }] }))
  assert(!storage.isPlannerData({ ...data, tasks: [{ ...data.tasks[0], dueTime: '99:99' }] }))
  assert(!storage.isPlannerData({ ...data, selectedSemesterId: 'missing' }))
  assert(!storage.isPlannerData(null))
})

test('startup keeps an empty planner when browser storage is unavailable', () => {
  const fail = () => { throw new Error('Browser storage must not be used') }
  globalThis.localStorage = { getItem: fail, setItem: fail }
  globalThis.sessionStorage = { getItem: fail, setItem: fail }
  try {
    const markup = renderToString(createElement(MemoryRouter, { initialEntries: ['/tasks'] }, createElement(App)))
    assert(markup.includes('Chưa đăng nhập'))
    assert(markup.includes('Chưa có học kỳ'))
    assert(!markup.includes('Minh Anh'))
    assert(!markup.includes('Toán cao cấp'))
    assert(!markup.includes('Đăng xuất'))
  } finally { delete globalThis.localStorage; delete globalThis.sessionStorage }
})

test('demo login accepts only the sample credentials and normalizes email', () => {
  assert(demoAuth.matchesDemoAccount('demo@studyplanner.vn', '123456'))
  assert(demoAuth.matchesDemoAccount('  DEMO@studyplanner.vn  ', '123456'))
  assert(!demoAuth.matchesDemoAccount('other@example.com', '123456'))
  assert(!demoAuth.matchesDemoAccount('demo@studyplanner.vn', 'wrong-password'))
  assert(!demoAuth.matchesDemoAccount('demo@studyplanner.vn', '123456 '))
  assert(!demoAuth.matchesDemoAccount('', ''))
})

test('demo session restores the profile and logout clears it without storing the password', () => {
  const entries = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
  const render = () => renderToString(createElement(MemoryRouter, { initialEntries: ['/tasks'] }, createElement(App)))
  try {
    assert(!demoAuth.hasDemoSession())
    demoAuth.saveDemoSession(true)
    assert(demoAuth.hasDemoSession())
    assert(![...entries.values()].includes(demoAuth.DEMO_ACCOUNT.password))
    const signedIn = render()
    assert(signedIn.includes(demoAuth.DEMO_ACCOUNT.name))
    assert(signedIn.includes('Đăng xuất'))
    assert(!signedIn.includes('Chưa đăng nhập'))
    demoAuth.saveDemoSession(false)
    assert(!demoAuth.hasDemoSession())
    assert.equal(entries.size, 0)
    assert(render().includes('Chưa đăng nhập'))
  } finally { delete globalThis.sessionStorage }
})

test('admin entry renders its own login without the student navigation or account helpers', () => {
  const markup = renderToString(createElement(MemoryRouter, { initialEntries: ['/admin'] }, createElement(App)))
  assert(markup.includes('Đăng nhập admin'))
  assert(markup.includes('Email quản trị'))
  assert(!markup.includes('Menu chính'))
  assert(!markup.includes('id="main-content"'))
  assert(!markup.includes('Điền tài khoản mẫu'))
  assert(!markup.includes('Đăng ký'))
  assert(!markup.includes('admin-students-table'))
})

test('admin credentials are distinct from the student account', () => {
  assert(adminAuth.matchesAdminAccount('admin@studyplanner.vn', '123456'))
  assert(adminAuth.matchesAdminAccount(' ADMIN@studyplanner.vn ', '123456'))
  assert(!adminAuth.matchesAdminAccount(demoAuth.DEMO_ACCOUNT.email, demoAuth.DEMO_ACCOUNT.password))
  assert(!adminAuth.matchesAdminAccount('admin@studyplanner.vn', 'wrong-password'))
  assert(!adminAuth.matchesAdminAccount('', ''))
  assert(!demoAuth.matchesDemoAccount(adminAuth.ADMIN_ACCOUNT.email, adminAuth.ADMIN_ACCOUNT.password))
})

test('admin student list requires an independent admin session and starts empty', () => {
  const entries = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
  const render = (path) => renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
  try {
    assert(!render('/admin/students').includes('admin-students-table'))
    demoAuth.saveDemoSession(true)
    assert(!adminAuth.hasAdminSession())
    assert(!render('/admin/students').includes('admin-students-table'))
    adminAuth.saveAdminSession(true)
    assert(adminAuth.hasAdminSession())
    assert(demoAuth.hasDemoSession())
    assert.equal(entries.size, 2)
    assert(![...entries.values()].includes(adminAuth.ADMIN_ACCOUNT.password))
    const markup = render('/admin/students')
    assert(markup.includes('Menu quản trị'))
    assert(markup.includes('admin-students-table'))
    assert(markup.includes('Chưa có tài khoản sinh viên'))
    assert(markup.replaceAll('<!-- -->', '').includes('0 tài khoản'))
    assert(markup.includes('Đăng xuất'))
    assert(!markup.includes(demoAuth.DEMO_ACCOUNT.email))
    assert(!markup.includes('Menu chính'))
    assert(render('/admin').includes('Đăng nhập admin'))
    adminAuth.saveAdminSession(false)
    assert(!adminAuth.hasAdminSession())
    assert(demoAuth.hasDemoSession())
    assert(!render('/admin/students').includes('admin-students-table'))
    assert(render('/tasks').includes(demoAuth.DEMO_ACCOUNT.name))
  } finally { delete globalThis.sessionStorage }
})

test('initial planner has no personal information, seeded records or selection', () => {
  const data = storage.createEmptyPlannerData()
  assert(storage.isPlannerData(data))
  assert(Object.values(data.profile).every((value) => value === ''))
  for (const field of ['semesters', 'subjects', 'tasks', 'schedule', 'readAlerts']) assert.deepEqual(data[field], [])
  assert.equal(data.selectedSemesterId, '')
  const other = storage.createEmptyPlannerData()
  data.profile.name = 'Changed'
  assert.equal(other.profile.name, '')
})

test('all proposal pages render correct content and the desktop shell', () => {
  const routes = { '/today': 'Hôm nay', '/tasks?subject=math': 'Nhiệm vụ của tôi', '/semesters': 'Học kỳ', '/subjects': 'Môn học', '/subjects/math': 'Không tìm thấy môn học', '/subjects/missing': 'Không tìm thấy môn học', '/schedule': 'Thời khóa biểu', '/tasks': 'Nhiệm vụ của tôi', '/tasks?view=priority': 'Nhiệm vụ quá hạn, hạn gần', '/tasks?layout=board': 'Bảng trạng thái nhiệm vụ', '/tasks?layout=calendar': 'flow-calendar-days', '/calendar': 'Lịch', '/statistics': 'Tiến độ', '/profile': 'Hồ sơ cá nhân', '/login': 'Đăng nhập', '/register': 'Đăng ký', '/missing': 'Không tìm thấy trang' }
  for (const [path, heading] of Object.entries(routes)) {
    const markup = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
    assert(markup.includes(heading), `${path}: heading`)
    assert(!markup.includes('NaN'), `${path}: no invalid metrics`)
    assert(!markup.includes('mobile-menu'), `${path}: desktop only`)
    if (!['/login', '/register'].includes(path)) assert(markup.includes('id="main-content"'), `${path}: shared layout`)
    assert(!/Bản mô phỏng frontend|dữ liệu mẫu|dùng thử|bản demo/i.test(markup), `${path}: no demo notices`)
  }
})

test('workspace sidebar shows empty academic data and retains navigation', () => {
  const markup = renderToString(createElement(MemoryRouter, { initialEntries: ['/tasks'] }, createElement(App)))
  const navigation = markup.match(/<nav aria-label="Menu chính">([\s\S]*?)<\/nav>/)?.[1]
  assert(navigation)
  assert.deepEqual([...navigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/tasks', '/today', '/calendar'])
  assert(!markup.includes('href="/?subject=math"'))
  assert(!markup.includes('href="/?subject=web"'))
  assert(markup.includes('Chưa có môn học.'))
  assert(markup.includes('aria-label="Mở hồ sơ của tôi"'))
})

test('sidebar marks the current page consistently across main, academic and profile links', () => {
  const routes = [
    ['/tasks', '/tasks'],
    ['/tasks?layout=board', '/tasks'],
    ['/tasks?view=priority', '/tasks'],
    ['/today', '/today'],
    ['/calendar', '/calendar'],
    ['/subjects', '/subjects'],
    ['/subjects/missing', '/subjects'],
    ['/statistics', '/statistics'],
    ['/schedule', '/schedule'],
    ['/semesters', '/semesters'],
    ['/profile', '/profile'],
  ]
  for (const [path, expected] of routes) {
    const markup = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
    const sidebar = markup.match(/<aside class="sidebar"[^>]*>([\s\S]*?)<\/aside>/)?.[1]
    assert(sidebar, path + ': sidebar exists')
    const selected = [...sidebar.matchAll(/<a\b([^>]*)>/g)].filter(([, attributes]) => attributes.includes('aria-current="page"'))
    assert.equal(selected.length, 1, path + ': exactly one current destination')
    assert.equal(selected[0][1].match(/href="([^"]+)"/)?.[1], expected, path + ': correct destination')
    assert.match(selected[0][1], /class="[^"]*\bactive\b/, path + ': selected appearance')
  }
})

test('notifications use a collapsed header bell before search instead of a sidebar page', () => {
  const markup = renderToString(createElement(MemoryRouter, { initialEntries: ['/tasks'] }, createElement(App)))
  const header = markup.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1]
  assert(header)
  assert.match(header, /<button[^>]*aria-label="Thông báo"[^>]*aria-expanded="false"[^>]*aria-haspopup="dialog"/)
  assert(header.indexOf('student-notification-bell') < header.indexOf('class="search-container"'))
  assert(!markup.includes('student-notification-count'))
  assert(!markup.includes('role="dialog"'))
  assert(!markup.includes('href="/notifications"'))
  assert(!markup.includes('Lời nhắc'))
})

test('academic and statistics pages display empty states instead of seeded records or charts', () => {
  const render = (path) => renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
  assert(render('/subjects').includes('Chưa có môn học'))
  assert(render('/semesters').includes('Chưa có học kỳ'))
  assert(render('/subjects/math').includes('Không tìm thấy môn học'))
  const statistics = render('/statistics')
  assert(statistics.includes('Chưa có dữ liệu thống kê'))
  assert(!statistics.includes('status-chart'))
  const profile = render('/profile')
  assert(profile.includes('Chưa có thông tin cá nhân'))
  assert(profile.includes('<fieldset class="form-fields">'))
  assert(!profile.includes('hiện chưa khả dụng.'))
  assert(!profile.includes('Đã lưu hồ sơ.'))
})

test('authentication and create controls remain enabled without opening dialogs or claiming success', () => {
  const render = (path) => renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
  for (const path of ['/login', '/register']) {
    const markup = render(path)
    assert(markup.includes('<fieldset class="form-fields">'), path)
    assert(markup.includes('noValidate=""'), path)
    assert.match(markup, /<button type="submit" class="button button-primary auth-submit"/)
    assert(!markup.includes('hiện chưa khả dụng.'))
  }
  for (const [path, label] of [['/semesters', 'Thêm học kỳ'], ['/subjects', 'Thêm môn học'], ['/schedule', 'Thêm lịch học'], ['/tasks', 'Thêm nhiệm vụ'], ['/tasks?layout=calendar', 'Thêm nhiệm vụ ngày']]) {
    const markup = render(path)
    const buttons = [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    const createButtons = buttons.filter(([, attributes, body]) => attributes.includes(label) || body.includes(label))
    assert(createButtons.length, path + ': create controls exist')
    assert(createButtons.every(([, attributes]) => !attributes.includes('disabled=""')), path + ': create controls enabled')
    assert(!markup.includes('<dialog'), path + ': no dialog')
  }
  const editor = renderToString(createElement(PlannerProvider, null, createElement(TaskEditor, { task: null, onClose: () => {} })))
  assert.match(editor, /<button type="submit" class="button button-primary"/)
})

test('daily task groups separate late work from today and keep completed work out of pending groups', () => {
  assert.equal(student.taskGroup(task({ dueTime: '13:00' }), now), 'today')
  assert.equal(student.taskGroup(task({ dueTime: '11:00' }), now), 'overdue')
  assert.equal(student.taskGroup(task({ dueDate: '2026-10-16' }), now), 'upcoming')
  assert.equal(student.taskGroup(task({ status: 'done', dueDate: '2026-10-01' }), now), 'done')
  const nearMidnight = Date.parse('2026-10-15T23:30:00+07:00')
  assert.equal(student.taskDueLabel(task({ dueDate: '2026-10-16', dueTime: '08:00' }), nearMidnight), 'Ngày mai, 08:00')
  assert.equal(student.taskGroup(task({ dueTime: '23:59' }), nearMidnight), 'today')
})

test('next class ignores ended sessions, includes classes in progress, and respects semester scope', () => {
  const data = fixtures.createPlannerFixture()
  data.semesters[0] = { id: 'semester-1', name: 'Kỳ hiện tại', startDate: '2026-10-01', endDate: '2026-10-16' }
  data.semesters[1] = { id: 'semester-2', name: 'Kỳ khác', startDate: '2026-10-01', endDate: '2026-10-31' }
  data.subjects.find((subject) => subject.id === 'english').semesterId = 'semester-2'
  const slot = { subjectId: 'math', title: 'Buổi học', weekday: 4, start: '08:00', end: '09:00', room: 'A.1', note: '' }
  data.schedule = [
    { ...slot, id: 'ended' },
    { ...slot, id: 'next', start: '13:00', end: '15:00' },
    { ...slot, id: 'tomorrow', weekday: 5, date: '2026-10-16', start: '10:00', end: '11:00' },
    { ...slot, id: 'other-semester', subjectId: 'english', start: '12:30', end: '13:30' },
  ]
  assert.deepEqual(student.upcomingClasses(data, now).map((item) => item.slot.id), ['next', 'tomorrow'])
  const inProgress = student.upcomingClasses(data, now + 2 * 3600000)[0]
  assert.equal(inProgress.slot.id, 'next')
  assert(inProgress.startsAt <= now + 2 * 3600000)
  assert.equal(student.upcomingClasses(data, now, 'english', 1)[0].slot.id, 'other-semester')
  assert.equal(student.upcomingClasses(data, Date.parse('2026-10-17T12:00:00+07:00')).length, 0)
})

test('stale browser records cannot reappear on any study page', () => {
  const data = fixtures.createPlannerFixture()
  globalThis.localStorage = { getItem: () => JSON.stringify(data) }
  globalThis.sessionStorage = { getItem: () => 'true' }
  try {
    for (const path of ['/semesters', '/subjects', '/schedule', '/tasks', '/calendar', '/notifications', '/statistics', '/priorities', '/profile']) {
      const markup = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
      assert(markup.includes('id="main-content"'), path)
      assert(!markup.includes('NaN'), path)
      assert(!markup.includes('undefined'), path)
      assert(!markup.includes('Minh Anh'), path)
      assert(!markup.includes('Toán cao cấp'), path)
      assert(!markup.includes('Hoàn thành bài tập chương 3'), path)
      assert(!markup.includes('Đăng xuất'), path)
    }
  } finally { delete globalThis.localStorage; delete globalThis.sessionStorage }
})

test('workspace filters search subtasks and retain semester subject scope across views', () => {
  const tasks = [task({ id: 'a', title: 'Bài toán', dueTime: '13:00', subtasks: [{ id: 'sub', title: 'Giải tích phân', done: false }] }), task({ id: 'b', subjectId: 'web', title: 'Code React', status: 'doing', dueDate: '2026-10-16' }), task({ id: 'c', title: 'Đã xong', status: 'done' })]
  const options = { subject: 'all', view: 'all', search: '', kind: 'all', status: 'all', sort: 'due' }
  assert.deepEqual(workspace.filterWorkspaceTasks(tasks, { ...options, search: 'tích phân' }, now).map((item) => item.id), ['a'])
  assert.deepEqual(workspace.filterWorkspaceTasks(tasks, { ...options, subject: 'web' }, now).map((item) => item.id), ['b'])
  assert.deepEqual(workspace.filterWorkspaceTasks(tasks, { ...options, view: 'today' }, now).map((item) => item.id), ['a'])
  assert.deepEqual(workspace.filterWorkspaceTasks(tasks, { ...options, view: 'priority' }, now).map((item) => item.id), ['a', 'b'])
  assert.deepEqual(workspace.filterWorkspaceTasks(tasks, { ...options, status: 'done' }, now).map((item) => item.id), ['c'])
})

test('quick add trims titles, binds the selected subject, and initializes a consistent status', () => {
  const subjects = fixtures.createPlannerFixture().subjects
  const input = { title: '  Bài tập mới  ', subjectId: 'web', date: '2026-10-16', status: 'todo' }
  const result = workspace.makeQuickTask(input, subjects, now, 'quick')
  assert.equal(result.title, 'Bài tập mới')
  assert.equal(result.subjectId, 'web')
  assert.equal(result.dueTime, '23:59')
  assert.equal(result.completedAt, undefined)
  assert.equal(workspace.makeQuickTask({ ...input, status: 'done' }, subjects, now, 'done').completedAt, new Date(now).toISOString())
  assert.throws(() => workspace.makeQuickTask({ ...input, title: '  ' }, subjects, now, 'bad'))
  assert.throws(() => workspace.makeQuickTask({ ...input, subjectId: 'missing' }, subjects, now, 'bad'))
  assert.throws(() => workspace.makeQuickTask({ ...input, date: '2026-02-30' }, subjects, now, 'bad'))
})

test('board drops affect only visible tasks and reuse completion rules for subtasks', () => {
  let data = fixtures.createPlannerFixture()
  const source = data.tasks.find((item) => item.id === 'task-project')
  const action = workspace.boardDropAction([source], source.id, 'done', now)
  assert(action)
  data = model.plannerReducer(data, action)
  const finished = data.tasks.find((item) => item.id === source.id)
  assert.equal(finished.status, 'done')
  assert(finished.subtasks.every((item) => item.done))
  assert.equal(finished.completedAt, new Date(now).toISOString())
  assert.equal(workspace.boardDropAction([finished], finished.id, 'done', now), null)
  assert.equal(workspace.boardDropAction([finished], 'task-math', 'done', now), null)
  data = model.plannerReducer(data, workspace.boardDropAction([finished], finished.id, 'doing', now))
  assert.equal(data.tasks.find((item) => item.id === source.id).completedAt, undefined)
})

test('calendar rescheduling preserves task content and cannot alter hidden tasks', () => {
  const original = task({ status: 'doing', dueTime: '09:30', description: 'Ghi chú', subtasks: [{ id: 'sub', title: 'Bước một', done: true }] })
  const moved = workspace.rescheduleTask([original], original.id, '2026-10-20')
  assert.deepEqual(moved, { ...original, dueDate: '2026-10-20' })
  assert.equal(original.dueDate, '2026-10-15')
  assert.equal(workspace.rescheduleTask([original], 'unknown', '2026-10-20'), null)
  assert.equal(workspace.rescheduleTask([original], original.id, '2026-02-30'), null)
  assert.equal(workspace.rescheduleTask([original], original.id, original.dueDate), null)
})

test('all task filters keep the three status groups visible when no tasks match', () => {
  for (const view of ['all', 'today', 'upcoming', 'overdue', 'done', 'priority']) {
    const markup = renderToString(createElement(MemoryRouter, { initialEntries: ['/tasks?view=' + view] }, createElement(App)))
    const groups = [...markup.matchAll(/class="flow-list-group flow-group-([^"]+)"/g)].map((match) => match[1])
    assert.deepEqual(groups, ['todo', 'doing', 'done'], view + ': all status groups remain visible')
    assert.equal([...markup.matchAll(/class="flow-group-count">0<\/span>/g)].length, 3, view + ': each empty group shows zero')
    assert(!markup.includes('Không có nhiệm vụ phù hợp'), view + ': empty state does not replace the groups')
    assert(!markup.includes('flow-group-priority'), view + ': priority keeps the status groups')
  }
})

test('list, board and calendar contain no tasks and do not create data locally', () => {
  const render = (path) => renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(App)))
  const outputs = ['list', 'board', 'calendar'].map((layout) => render('/tasks?layout=' + layout))
  const counts = outputs.map((markup) => markup.match(/class="flow-task-total">([^<]+)/)?.[1])
  assert(counts.every((count) => count === '0'))
  assert(outputs[0].includes('flow-list-view'))
  assert(!outputs[1].includes('draggable="true"'))
  assert(outputs[2].includes('flow-calendar-days'))
  assert(outputs.every((markup) => !markup.includes('quick-task-form')))
})
