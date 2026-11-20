import assert from 'node:assert/strict'
import fs from 'node:fs'

export function createLearningFixture() {
  const state = { fail: false }
  const tasks = Array.from({ length: 25 }, (_, i) => ({ ma: i + 1, maSinhVien: 11, hoTen: 'Lê Công Minh', maSoSinhVien: 'SV001', maHocKy: i % 2 + 1, tenHocKy: `Học kỳ ${i % 2 + 1}`, maMonHoc: 10 + i % 2, tenMonHoc: i % 2 ? 'Lập trình web' : 'Cơ sở dữ liệu', maNhiemVuCha: null, tieuDe: `Bài tập ${i + 1}`, trangThai: i === 1 ? 'Completed' : i % 3 ? 'InProgress' : 'NotStarted', mucDoUuTien: 'High', tienDo: i === 1 ? 100 : i % 3 ? 30 : 0, hanHieuLuc: i === 0 ? '2026-01-01T00:00:00Z' : '2027-01-01T00:00:00Z', ngayHoanThanh: i === 1 ? '2026-11-01T00:00:00Z' : null, coBuocNho: i === 0 }))
  return { state, async handle(url, method, role) {
    if (!url.pathname.startsWith('/api/v1/admin/learning/')) return null
    if (role !== 'admin') return { status: 403, response: { detail: 'Không có quyền.' } }
    if (state.fail) return { status: 503, response: { detail: 'Theo dõi tạm gián đoạn.' } }
    assert.equal(method, 'GET')
    const q = url.searchParams
    if (url.pathname.endsWith('/students/11')) return { status: 200, response: { ma: 11, hoTen: 'Lê Công Minh', maSoSinhVien: 'SV001', dangHoatDong: true, muiGio: 'Asia/Ho_Chi_Minh', hocKy: [{ ma: 1, ten: 'Học kỳ 1', maHocKy: null }, { ma: 2, ten: 'Học kỳ 2', maHocKy: null }], monHoc: [{ ma: 10, ten: 'Cơ sở dữ liệu', maHocKy: 1 }, { ma: 11, ten: 'Lập trình web', maHocKy: 2 }] } }
    if (url.pathname.endsWith('/sessions')) return { status: 200, response: { danhSach: [{ ma: 1, maNhiemVu: 1, tieuDeNhiemVu: 'Bài tập 1', batDauDuKien: '2026-11-18T01:00:00Z', ketThucDuKien: '2026-11-18T01:25:00Z', trangThai: 'Planned' }], trang: 1, kichThuocTrang: 20, tongSo: 1 } }
    if (url.pathname.endsWith('/focus-summary')) return { status: 200, response: { soPhien: 3, tongMiliGiay: 3600000, bamGioMiliGiay: 3000000, nhapTayMiliGiay: 600000 } }
    let rows = q.get('GomBuocNho') === 'true' ? [...tasks, { ...tasks[0], ma: 26, maNhiemVuCha: 1, tieuDe: 'Bước nhỏ', coBuocNho: false }] : tasks
    rows = rows.filter(t => (!q.get('MaHocKy') || t.maHocKy === Number(q.get('MaHocKy'))) && (!q.get('MaMonHoc') || t.maMonHoc === Number(q.get('MaMonHoc'))) && (!q.get('TrangThai') || t.trangThai === q.get('TrangThai')) && (!q.get('ChiQuaHan') || t.ma === 1 || t.ma === 26) && (!q.get('TuKhoa') || t.tieuDe.toLowerCase().includes(q.get('TuKhoa').toLowerCase())))
    if (url.pathname.endsWith('/summary')) return { status: 200, response: { tongNhiemVu: rows.length, hoanThanh: rows.filter(t => t.trangThai === 'Completed').length, dangLam: rows.filter(t => t.trangThai === 'InProgress').length, chuaBatDau: rows.filter(t => t.trangThai === 'NotStarted').length, quaHan: rows.filter(t => t.ma === 1 || t.ma === 26).length, soSinhVienCoNhiemVu: rows.length ? 1 : 0, kiemTraLuc: '2026-11-18T09:00:00Z' } }
    const page = Number(q.get('Trang') || 1)
    return { status: 200, response: { danhSach: rows.slice((page - 1) * 20, page * 20), trang: page, kichThuocTrang: 20, tongSo: rows.length } }
  } }
}
export async function runLearningChecks({ go, click, select, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  await go('/admin/learning'); await waitFor('location.pathname === "/login"')
  await login('admin@example.com'); await waitFor('location.pathname === "/admin/overview"')
  await click('a[href="/admin/learning"]')
  await waitFor('document.querySelectorAll(".learning-panel tbody tr").length === 20')
  assert.equal(await evaluate('document.querySelector(".learning-metrics strong").textContent'), '25')
  await click('.learning-panel .admin-pagination button:last-child'); await waitFor('document.querySelectorAll(".learning-panel tbody tr").length === 5')
  await go('/admin/learning?student=11'); await waitFor('!!document.querySelector("select[aria-label]") && document.querySelectorAll(".learning-study-metrics article").length === 4')
  await select('select[aria-label="Học kỳ"]', '1'); await waitFor('document.querySelector(".learning-metrics strong")?.textContent === "13"')
  await select('select[aria-label="Môn học"]', '10'); await waitFor('document.querySelector(".learning-metrics strong")?.textContent === "13"')
  await go('/admin/learning?student=11&overdue=true&children=true'); await waitFor('document.querySelector(".learning-metrics strong")?.textContent === "2"')
  assert((await evaluate('document.querySelector(".learning-study-metrics").innerText')).includes('50 phút'))
  assert.equal(await evaluate('document.querySelectorAll(".admin-learning button").length > 0 && !Array.from(document.querySelectorAll(".admin-learning button")).some(b => /Xóa nhiệm vụ|Sửa nhiệm vụ/.test(b.textContent))'), true)
  await go('/admin/learning?q=khongkhop'); await waitFor('document.querySelector(".learning-empty")?.textContent.includes("Không có nhiệm vụ")')
  fixture.state.fail = true
  await go('/admin/learning'); await waitFor('!!document.querySelector(".learning-feedback[role=alert]")')
  fixture.state.fail = false
  await click('.learning-feedback[role=alert] button'); await waitFor('document.querySelectorAll(".learning-panel tbody tr").length === 20')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/admin-learning.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await waitFor('document.documentElement.scrollWidth <= innerWidth + 1')
  assert(calls.filter(c => c.route.startsWith('/api/v1/admin/learning/')).every(c => c.method === 'GET'))
  assert.deepEqual(errors, [])
  console.log('PASS: admin learning browser filtering, pagination, student scope, empty/error/retry, actual/manual time, read-only UI and mobile layout.')
}
