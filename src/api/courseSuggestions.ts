import { ApiError, apiRequest, record } from './client'

export interface CourseSuggestion { ma: number; maHocKyMau: number; tenHocKy: string; kyHieu: string; ten: string; soTinChi: number }
export interface CourseSuggestions { rows: CourseSuggestion[]; page: number; total: number }
const integer = (value: unknown, min = 1): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= 2147483647
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
function invalid(): never { throw new ApiError('Dữ liệu môn học gợi ý chưa hợp lệ. Bạn vẫn có thể tự nhập môn.') }
export async function loadCourseSuggestions(token: string, keyword: string, page = 1, signal?: AbortSignal): Promise<CourseSuggestions> {
  if (!integer(page) || keyword.length > 200) invalid()
  const query = new URLSearchParams({ tuKhoa: keyword.trim(), trang: String(page) })
  const body = record(await apiRequest('/catalog/courses?' + query, { token, signal }))
  if (body.trang !== page || body.kichThuocTrang !== 20 || !integer(body.tongSo, 0) || !Array.isArray(body.danhSach) || body.danhSach.length > 20 || body.danhSach.length > body.tongSo) invalid()
  const rows = body.danhSach.map(value => {
    const row = record(value)
    if (!integer(row.ma) || !integer(row.maHocKyMau) || !text(row.tenHocKy) || !text(row.ten) || typeof row.kyHieu !== 'string' || !/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(row.kyHieu) || !integer(row.soTinChi) || row.soTinChi > 30) invalid()
    return row as unknown as CourseSuggestion
  })
  if (new Set(rows.map(row => row.ma)).size !== rows.length) invalid()
  return { rows, page, total: body.tongSo }
}
