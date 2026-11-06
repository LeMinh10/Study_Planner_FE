// Run from StudyPlanner.AcademicChecks with STUDYPLANNER_FE_ROOT set to this repo.
// Tokens and API address belong to its temporary database and host, never printed.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const target = process.env.TEST_ACADEMIC_API_URL
const token = process.env.TEST_ACADEMIC_TOKEN
const otherToken = process.env.TEST_ACADEMIC_OTHER_TOKEN
if (!target || !token || !otherToken || !/^http:\/\/127\.0\.0\.1:\d+$/.test(target)) throw new Error('Use the isolated AcademicChecks host.')
const server = await createServer({ define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { host: '127.0.0.1', port: 0, hmr: false, ws: false, proxy: { '/api': { target, changeOrigin: true } } } })
const originalFetch = globalThis.fetch
let semesterId, courseId, api
try {
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  globalThis.fetch = (url, options) => originalFetch(new URL(url, origin), options)
  api = await server.ssrLoadModule('/src/api/academic.ts')
  const created = await api.saveSemester(token, { id: '', name: 'FE qua Vite proxy', startDate: '2026-09-01', endDate: '2027-01-31' })
  semesterId = created.id
  assert((await api.listSemesters(token)).some((item) => item.id === semesterId))
  await assert.rejects(api.listSubjects(otherToken, semesterId), (error) => error.status === 404)
  for (const color of Object.keys(api.subjectColors)) {
    const course = await api.saveSubject(token, { id: '', semesterId, name: 'FE ' + color, code: '', credits: 0, teacher: '', color })
    courseId = course.id
    assert.equal(course.color, color)
    assert.equal(course.colorHex, api.subjectColors[color])
    assert.equal((await api.getSubject(token, courseId)).semesterId, semesterId)
    const updated = await api.saveSubject(token, { ...course, name: 'FE đã sửa ' + color })
    assert.equal(updated.name, 'FE đã sửa ' + color)
    assert.equal((await api.listSubjects(token, semesterId)).length, 1)
    assert.deepEqual(await api.deletionPreview(token, 'subject', courseId), { courses: 0, sessions: 0, tasks: 0 })
    await api.deleteAcademic(token, 'subject', courseId)
    await assert.rejects(api.getSubject(token, courseId), (error) => error.status === 404)
    courseId = undefined
  }
  await api.saveSemester(token, { ...created, name: 'FE kỳ đã sửa' })
  assert.deepEqual(await api.deletionPreview(token, 'semester', semesterId), { courses: 0, sessions: 0, tasks: 0 })
  await api.deleteAcademic(token, 'semester', semesterId); semesterId = undefined
  console.log('PASS: real FE adapters → Vite /api/v1 proxy → BE JWT → PostgreSQL; semester/course CRUD, colors, preview, 204 and ownership.')
} finally {
  try {
    if (api && courseId) await api.deleteAcademic(token, 'subject', courseId)
    if (api && semesterId) await api.deleteAcademic(token, 'semester', semesterId)
  } finally { globalThis.fetch = originalFetch; await server.close() }
}
