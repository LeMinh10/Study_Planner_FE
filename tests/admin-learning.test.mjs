import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ configFile: false, envDir: false, appType: 'custom', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
const { localDateRange, validateLearningData } = await vite.ssrLoadModule('/src/admin/AdminLearningPage.tsx')
after(() => vite.close())

test('khoảng ngày dùng múi giờ sinh viên và gồm hết ngày cuối', () => {
  assert.deepEqual(localDateRange('2026-11-18', '2026-11-18', 'Asia/Ho_Chi_Minh'), { tu: '2026-11-17T17:00:00.000Z', den: '2026-11-18T17:00:00.000Z' })
  assert.deepEqual(localDateRange('2026-03-08', '2026-03-08', 'America/New_York'), { tu: '2026-03-08T05:00:00.000Z', den: '2026-03-09T04:00:00.000Z' })
})
test('ngày đảo, ngày không tồn tại, múi giờ sai và khoảng quá dài không tạo truy vấn', () => {
  for (const [from, to, zone] of [['2026-11-19', '2026-11-18', 'UTC'], ['2026-02-30', '2026-03-01', 'UTC'], ['', '2026-11-18', 'UTC'], ['2026-01-01', '2026-11-18', 'UTC'], ['2026-11-18', '2026-11-18', 'wrong-zone']]) assert.equal(localDateRange(from, to, zone), null)
})
test('lỗi phản hồi không bị diễn giải thành không có dữ liệu hoặc tiến độ hợp lệ', () => {
  const summary = { tongNhiemVu: 0, hoanThanh: 0, dangLam: 0, chuaBatDau: 0, quaHan: 0, soSinhVienCoNhiemVu: 0, kiemTraLuc: '2026-11-18T00:00:00Z' }
  const page = { danhSach: [], trang: 1, kichThuocTrang: 20, tongSo: 0 }
  assert.doesNotThrow(() => validateLearningData(summary, page))
  assert.throws(() => validateLearningData({ ...summary, quaHan: -1 }, page))
  assert.throws(() => validateLearningData(summary, { ...page, danhSach: null }))
  assert.throws(() => validateLearningData(summary, { ...page, danhSach: [{ ma: 1, maSinhVien: 1, tieuDe: 'Bài', hoTen: 'An', trangThai: 'Completed', tienDo: 150, hanHieuLuc: null }], tongSo: 1 }))
})
