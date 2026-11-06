import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ define: { 'import.meta.env.VITE_USE_MOCK_API': '"false"' }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/academic.ts')
const originalFetch = globalThis.fetch
after(() => server.close())
afterEach(() => { globalThis.fetch = originalFetch })
const semester = { ma: 103, ten: 'Học kỳ I', ngayBatDau: '2026-09-01', ngayKetThuc: '2027-01-31' }
const course = { ma: 207, maHocKy: 103, ten: 'Lập trình', kyHieu: 'CS01', soTinChi: 3, giangVien: 'GV', mauSac: '#53A88C' }
const page = (danhSach, trang = 1, tongSo = danhSach.length) => ({ danhSach, trang, kichThuocTrang: 1, tongSo })
function replies(...values) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined })
    const value = values.shift()
    assert(value, 'Unexpected additional request')
    if (value instanceof Error) throw value
    return new Response(value[1] === undefined ? null : JSON.stringify(value[1]), { status: value[0] })
  }
  return calls
}
test('academic lists consume every Vietnamese page and send Bearer JWT', async () => {
  const calls = replies([200, page([semester], 1, 2)], [200, page([{ ...semester, ma: 104 }], 2, 2)], [200, page([course])])
  assert.deepEqual((await api.listSemesters('jwt')).map((item) => item.id), ['103', '104'])
  assert.equal((await api.listSubjects('jwt', '103'))[0].id, '207')
  assert.equal(calls[0].url, '/api/v1/semesters?Trang=1&KichThuocTrang=100')
  assert.equal(calls[1].url, '/api/v1/semesters?Trang=2&KichThuocTrang=100')
  assert.equal(calls[2].url, '/api/v1/semesters/103/courses?Trang=1&KichThuocTrang=100')
  assert(calls.every((call) => call.headers.Authorization === 'Bearer jwt'))
})
test('academic writes use returned IDs, PUT cannot send semester reassignment, and all colors use hex', async () => {
  const local = { id: '', name: ' Học kỳ I ', startDate: semester.ngayBatDau, endDate: semester.ngayKetThuc }
  const calls = replies([201, semester], [200, semester])
  const saved = await api.saveSemester('jwt', local)
  assert.equal(saved.id, '103')
  await api.saveSemester('jwt', saved)
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[1].method, 'PUT')
  assert.deepEqual(calls[0].body, { ten: 'Học kỳ I', ngayBatDau: semester.ngayBatDau, ngayKetThuc: semester.ngayKetThuc })
  for (const [color, hex] of Object.entries(api.subjectColors)) {
    const calls = replies([201, { ...course, mauSac: hex }], [200, { ...course, mauSac: hex }])
    const created = await api.saveSubject('jwt', { ...api.parseSubject(course), id: '', color, colorHex: undefined })
    assert.equal(created.id, '207'); assert.equal(created.color, color)
    await api.saveSubject('jwt', created)
    assert.equal(calls[0].url, '/api/v1/semesters/103/courses')
    assert.equal(calls[1].url, '/api/v1/courses/207')
    assert.equal(calls[1].method, 'PUT')
    assert.deepEqual(calls[1].body, { ten: course.ten, kyHieu: course.kyHieu, soTinChi: course.soTinChi, giangVien: course.giangVien, mauSac: hex })
  }
})
test('detail accepts nullable fields and preserves arbitrary BE hex colors on edit', async () => {
  const remote = { ...course, mauSac: '#123abc', kyHieu: null, soTinChi: null, giangVien: null }
  const calls = replies([200, remote], [200, remote])
  const item = await api.getSubject('jwt', '207')
  assert.equal(item.colorHex, '#123ABC'); assert.equal(item.credits, 0)
  await api.saveSubject('jwt', item)
  assert.equal(calls[1].body.mauSac, '#123ABC')
  assert.equal(calls[1].body.soTinChi, null)
})
test('deletion reads server impact then accepts empty 204; failures never mutate or fall back to mock', async () => {
  const calls = replies([200, { soMonHoc: 2, soBuoiHoc: 5, soNhiemVuBoLienKet: 7 }], [204], [409, { detail: 'Dữ liệu đã đổi' }])
  assert.deepEqual(await api.deletionPreview('jwt', 'semester', '103'), { courses: 2, sessions: 5, tasks: 7 })
  await api.deleteAcademic('jwt', 'semester', '103')
  await assert.rejects(api.deleteAcademic('jwt', 'subject', '207'), /Dữ liệu đã đổi/)
  assert.equal(calls[0].url, '/api/v1/semesters/103/deletion-preview')
  assert.equal(calls[1].method, 'DELETE'); assert.equal(calls[1].body, undefined)
  const failed = replies(new TypeError('offline'))
  await assert.rejects(api.listSemesters('jwt'), /kết nối/)
  assert.equal(failed.length, 1)
})
test('invalid pagination, ownership linkage, preview and resource IDs fail closed', async () => {
  replies([200, page([], 1, 5)])
  await assert.rejects(api.listSemesters('jwt'), /hợp đồng/)
  replies([200, page([{ ...course, maHocKy: 999 }])])
  await assert.rejects(api.listSubjects('jwt', '103'), /hợp đồng/)
  replies([200, { soBuoiHoc: 0 }])
  await assert.rejects(api.deletionPreview('jwt', 'subject', '207'), /hợp đồng/)
  const calls = replies()
  await assert.rejects(api.deleteAcademic('jwt', 'subject', '../users'), /hợp đồng/)
  assert.equal(calls.length, 0)
})
