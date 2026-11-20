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
  if (options.role !== undefined) {
    if (!['admin', 'sinhvien'].includes(options.role)) throw new ApiError('Vai trò tài khoản chưa hợp lệ.', 400)
    query.set('VaiTro', options.role === 'admin' ? 'Admin' : 'Student')
  }
  for (const [key, value] of [['TaoTu', options.createdFrom], ['TaoDen', options.createdTo]]) {
    if (value !== undefined) {
      if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new ApiError('Khoảng ngày đăng ký chưa hợp lệ.', 400)
      query.set(key!, value)
    }
  }
  if (options.createdFrom && options.createdTo && Date.parse(options.createdFrom) > Date.parse(options.createdTo)) throw new ApiError('Khoảng ngày đăng ký chưa hợp lệ.', 400)
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

export interface ManagedStudentInput {
  name: string
  email: string
  studentId: string
  schoolName: string
  className: string
  major: string
  password?: string
}

// Chỉ gửi các trường hồ sơ được phép. Không nhận vai trò, hash mật khẩu hoặc
// mã chủ sở hữu từ form, kể cả khi đối tượng đầu vào có thêm các trường đó.
export async function saveManagedStudent(token: string, input: ManagedStudentInput, original?: ManagedUser): Promise<ManagedUser> {
  const name = input.name.trim(), email = input.email.trim()
  if (!name || name.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
    input.studentId.trim().length > 50 || [input.schoolName, input.className, input.major].some(v => v.trim().length > 200)) throw new ApiError('Kiểm tra họ tên, email và độ dài thông tin hồ sơ.', 400)
  if (!original && (!input.password || input.password.length < 8 || input.password.length > 128)) throw new ApiError('Mật khẩu tài khoản mới phải có từ 8 đến 128 ký tự.', 400)
  if (original && original.role !== 'sinhvien') throw new ApiError('Biểu mẫu này chỉ chỉnh sửa hồ sơ sinh viên.', 403)
  const payload = {
    hoTen: name, email, maSoSinhVien: input.studentId.trim() || null,
    tenTruong: input.schoolName.trim() || null, tenLop: input.className.trim() || null, nganhHoc: input.major.trim() || null,
    // Sửa hồ sơ giữ trạng thái đã đọc; backend kiểm tra mốc cập nhật trong cùng
    // giao dịch để không vô tình mở lại tài khoản vừa bị người khác khóa.
    dangHoatDong: original ? original.status === 'active' : true,
    ...(original ? { ngayCapNhatMongDoi: original.updatedAt } : { matKhau: input.password }),
  }
  return parseUser(await apiRequest(usersPath + (original ? '/' + userId(original.id) : ''), { token, method: original ? 'PUT' : 'POST', body: payload }))
}
