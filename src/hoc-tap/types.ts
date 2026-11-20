export interface KetQua<T> { phienBan: number; duLieu: T }
export interface Trang<T> { danhSach: T[]; trang: number; kichThuocTrang: number; tongSo: number }
export interface MucChecklist { tieuDe: string; daXong: boolean }
export interface NhiemVuChaTomTat { ma: number; tieuDe: string; hanHoanThanh: string | null }
export interface NhiemVu {
  ma: number
  maHocKy: number | null
  maMonHoc: number | null
  maNhiemVuCha: number | null
  tieuDeNhiemVuCha?: string | null
  duongDanNhiemVuCha?: NhiemVuChaTomTat[]
  tieuDe: string
  moTa: string | null
  checklist?: MucChecklist[]
  loai: string
  mucDoUuTien: string
  daGhim?: boolean
  hanHoanThanh: string | null
  hanHieuLuc: string | null
  ngayHoanThanh: string | null
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
  coTheDanhDauHoanThanh?: boolean
  tienDoNhiemVu?: number | null
}
export interface Lich { muiGio: string; suKien: SuKien[] }
export interface GioRanh {
  ma: number; thuTrongTuan: number; gioBatDau: string; gioKetThuc: string
  ngayBatDau: string; ngayKetThuc: string; dangSuDung: boolean
}
export interface NgoaiLeGioRanh { maKhungGioRanh: number; ngay: string; boQua: boolean; gioBatDau: string | null; gioKetThuc: string | null }
export interface CauHinhHoc { phienHocPhut: number; nghiGiuaPhienPhut: number; gioiHanHocMoiNgayPhut: number }
export interface LopHoc {
  ma: number; maMonHoc: number; tenMonHoc: string; thuTrongTuan: number
  gioBatDau: string; gioKetThuc: string; phongHoc: string | null
  ngayApDungTu: string | null; ngayApDungDen: string | null
}
export interface Phien {
  ma: number; maNhiemVu: number; batDauDuKien: string; ketThucDuKien: string; trangThai: string; ghiChu: string | null
  tieuDeNhiemVu: string | null; maHocKy: number | null; maMonHoc: number | null
  batDauBamGio: string | null; soGiayDaHoc: number | null
}
export interface ApDungLich { maLanApDung: number; daApDungTruoc?: boolean; phien: Phien[] }
export interface DeXuat { maNhiemVu: number; tieuDe: string; batDauDuKien: string; ketThucDuKien: string; lyDo: string }
export interface GoiY {
  tokenPreview: string; phien: DeXuat[]; muiGio: string; hetHanLuc: string
  phienThayThe?: { ma: number; maNhiemVu: number; tieuDe: string; batDauDuKien: string; ketThucDuKien: string }[]
  maPhienThayThe?: number[]; cauHinhHoc?: CauHinhHoc; phienBanUuTien?: number
  tongPhutCanXep: number; tongPhutDaDat: number; tongPhutDeXuat: number; tongPhutChuaXep: number
  canhBao: { maNhiemVu: number; maLyDo: string; tieuDe: string; thongBao: string; soPhutChuaXep: number }[]
}
export interface AnhHuong { soNhiemVu?: number; maPhienBiHuy?: number[]; maPhienBiXoa?: number[]; phienBiAnhHuong?: number[]; lichHocTrung?: number[]; canKetThucPhienDangHoc?: boolean; maNhiemVuMoLai?: number[]; maChecklistChuyenThanhBuoc?: number[]; maTienDoChuyenThanhBuoc?: number[] }
export interface LichSu { ma: number; tieuDeNhiemVu: string; hanhDong: string; nguonThayDoi: string; ngayThayDoi: string; duLieuTruoc: string | null; duLieuSau: string | null }
