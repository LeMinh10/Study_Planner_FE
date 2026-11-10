export interface KetQua<T> { phienBan: number; duLieu: T }
export interface Trang<T> { danhSach: T[]; trang: number; kichThuocTrang: number; tongSo: number }
export interface NhiemVu {
  ma: number
  maHocKy: number | null
  maMonHoc: number | null
  maNhiemVuCha: number | null
  tieuDe: string
  moTa: string | null
  loai: string
  mucDoUuTien: string
  hanHoanThanh: string | null
  hanHieuLuc: string | null
  maNhiemVuNguonHan: number | null
  batDauSuKien: string | null
  ketThucSuKien: string | null
  trangThai: string
  tienDo: number
  thoiLuongDuKienPhut: number | null
  thoiLuongConLaiPhut: number | null
  coNhiemVuCon: boolean
  nhacTruocGio: number | null
}
export interface SuKien {
  ma: string; loai: string; maNguon: number; maMonHoc: number | null
  tieuDe: string; batDau: string; ketThuc: string | null; mauSac: string | null; trangThai: string | null
}
export interface Lich { muiGio: string; suKien: SuKien[] }
export interface GioRanh {
  ma: number; thuTrongTuan: number; gioBatDau: string; gioKetThuc: string
  ngayBatDau: string; ngayKetThuc: string; dangSuDung: boolean
}
export interface LopHoc {
  ma: number; maMonHoc: number; tenMonHoc: string; thuTrongTuan: number
  gioBatDau: string; gioKetThuc: string; phongHoc: string | null
  ngayApDungTu: string | null; ngayApDungDen: string | null
}
export interface Phien {
  ma: number; maNhiemVu: number; batDauDuKien: string; ketThucDuKien: string; trangThai: string; ghiChu: string | null
}
export interface DeXuat { maNhiemVu: number; tieuDe: string; batDauDuKien: string; ketThucDuKien: string; lyDo: string }
export interface GoiY {
  tokenPreview: string; phien: DeXuat[]; muiGio: string; hetHanLuc: string
  tongPhutCanXep: number; tongPhutDaDat: number; tongPhutDeXuat: number; tongPhutChuaXep: number
  canhBao: { tieuDe: string; thongBao: string; soPhutChuaXep: number }[]
}
export interface AnhHuong { soNhiemVu?: number; maPhienBiHuy?: number[]; maPhienBiXoa?: number[]; phienBiAnhHuong?: number[]; lichHocTrung?: number[]; canKetThucPhienDangHoc?: boolean }
export interface LichSu { ma: number; tieuDeNhiemVu: string; hanhDong: string; nguonThayDoi: string; ngayThayDoi: string; duLieuTruoc: string | null; duLieuSau: string | null }
