import type { ManagedUser, UserListOptions, UserPage } from '../types/admin'
import { normalizeRole } from '../auth/session'
import { ApiError, apiRequest, record } from './client'

const usersPath = '/admin/users'
function unwrap(value: unknown) { const body = record(value); return record(body.data ?? body) }
function text(value: unknown) { return typeof value === 'string' ? value : '' }
function validInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
}
function userId(value: string) {
  const id = Number(value)
  if (!/^\d+$/.test(value) || !validInteger(id, 1, 2147483647)) throw new ApiError('Mã người dùng chưa hợp lệ.', 400)
  return String(id)
}
function parseUser(value: unknown): ManagedUser {
  const user = unwrap(value)
  const role = normalizeRole(user.vaiTro)
  const optionalFields = ['maSoSinhVien', 'tenTruong', 'tenLop', 'nganhHoc']
  if (!validInteger(user.ma, 1, 2147483647) || typeof user.hoTen !== 'string' || typeof user.email !== 'string' || !role || typeof user.dangHoatDong !== 'boolean' ||
    typeof user.ngayTao !== 'string' || !Number.isFinite(Date.parse(user.ngayTao)) || typeof user.ngayCapNhat !== 'string' || !Number.isFinite(Date.parse(user.ngayCapNhat)) ||
    optionalFields.some((key) => user[key] != null && typeof user[key] !== 'string')) throw new ApiError('Dữ liệu người dùng do máy chủ trả về chưa hợp lệ.')
  return {
    id: String(user.ma), name: user.hoTen, email: user.email, studentId: text(user.maSoSinhVien), schoolName: text(user.tenTruong),
    className: text(user.tenLop), major: text(user.nganhHoc), role, status: user.dangHoatDong ? 'active' : 'locked',
    createdAt: user.ngayTao, updatedAt: user.ngayCapNhat,
  }
}

export async function listUsers(token: string, options: UserListOptions = {}): Promise<UserPage> {
  const page = options.page ?? 1, pageSize = options.pageSize ?? 20
  if (!validInteger(page, 1, 2147483647) || !validInteger(pageSize, 1, 100)) throw new ApiError('Trang hoặc số tài khoản mỗi trang chưa hợp lệ.', 400)
  const query = new URLSearchParams({ Trang: String(page), KichThuocTrang: String(pageSize) })
  if (options.search?.trim()) query.set('TuKhoa', options.search.trim())
  if (typeof options.isActive === 'boolean') query.set('DangHoatDong', String(options.isActive))
  const body = unwrap(await apiRequest(usersPath + '?' + query.toString(), { token, signal: options.signal }))
  if (!Array.isArray(body.danhSach) || !validInteger(body.trang, 1, 2147483647) || !validInteger(body.kichThuocTrang, 1, 100) || !validInteger(body.tongSo, 0) ||
    body.danhSach.length > body.kichThuocTrang || body.danhSach.length > body.tongSo) throw new ApiError('Dữ liệu phân trang do máy chủ trả về chưa hợp lệ.')
  return { items: body.danhSach.map(parseUser), page: body.trang, pageSize: body.kichThuocTrang, total: body.tongSo }
}

export async function getUser(token: string, id: string, signal?: AbortSignal): Promise<ManagedUser> {
  return parseUser(await apiRequest(usersPath + '/' + userId(id), { token, signal }))
}

export async function setUserActive(token: string, id: string, active: boolean): Promise<{ message: string; isActive: boolean }> {
  const body = unwrap(await apiRequest(usersPath + '/' + userId(id) + (active ? '/activate' : '/deactivate'), { method: 'PATCH', token }))
  if (typeof body.thongBao !== 'string' || typeof body.dangHoatDong !== 'boolean' || body.dangHoatDong !== active) throw new ApiError('Máy chủ chưa xác nhận trạng thái tài khoản được cập nhật.')
  return { message: body.thongBao, isActive: body.dangHoatDong }
}
