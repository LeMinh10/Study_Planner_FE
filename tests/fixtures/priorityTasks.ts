import type { NhiemVu } from '../../src/hoc-tap/types'

export function priorityTestTasks(now: number): NhiemVu[] {
  const task = (ma: number, tieuDe: string, hours: number | null, mucDoUuTien: NhiemVu['mucDoUuTien'], trangThai: NhiemVu['trangThai'] = 'NotStarted'): NhiemVu => ({
    ma, tieuDe, maHocKy: null, maMonHoc: null, maNhiemVuCha: null, moTa: null, loai: 'Personal', mucDoUuTien, trangThai, tienDo: trangThai === 'InProgress' ? 30 : 0,
    hanHoanThanh: hours === null ? null : new Date(now + hours * 3600000).toISOString(),
    hanHieuLuc: hours === null ? null : new Date(now + hours * 3600000).toISOString(), maNhiemVuNguonHan: hours === null ? null : ma,
    batDauSuKien: null, ketThucSuKien: null, thoiLuongDuKienPhut: 60, thoiLuongConLaiPhut: 60, coNhiemVuCon: false, nhacTruocGio: null,
  })
  return [task(1, 'Bài đã quá hạn', -2, 'Low'), task(2, 'Bài hạn gần, quan trọng vừa', 2, 'Medium'),
    task(3, 'Bài hạn xa hơn, quan trọng cao', 6, 'High'), task(4, 'Bài cùng hạn, đang thực hiện', 6, 'High', 'InProgress'), task(5, 'Bài chưa đặt hạn', null, 'High')]
}
