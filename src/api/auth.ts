import type { AuthSession, AuthUser, ChangePasswordInput, RegisterInput } from '../types/auth'
import type { Profile } from '../types/planner'
import { jwtClaims, normalizeRole, tokenExpiry } from '../auth/session'
import { apiRequest, ApiError, record } from './client'
import { authEndpoints } from './config'

function unwrap(value: unknown) {
  const body = record(value)
  return record(body.data ?? body)
}
function text(value: unknown) { return typeof value === 'string' ? value : '' }

export function parseAuthUser(value: unknown, token: string): AuthUser {
  const body = unwrap(value)
  const user = record(body.nguoiDung ?? body.user ?? body.profile ?? body)
  const claims = jwtClaims(token)
  const role = normalizeRole(user.vaiTro ?? user.role ?? claims.role ?? claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'])
  if (!role || typeof (user.hoTen ?? user.fullName ?? user.name) !== 'string' || typeof user.email !== 'string') throw new ApiError('Thông tin tài khoản do máy chủ trả về chưa hợp lệ.')
  if ((user.dangHoatDong ?? user.isActive) === false) throw new ApiError('Tài khoản đã bị vô hiệu hóa.', 403, 'ACCOUNT_DISABLED')
  return {
    name: text(user.hoTen ?? user.fullName ?? user.name), email: user.email, studentId: text(user.maSoSinhVien ?? user.studentCode ?? user.studentId),
    school: text(user.tenTruong ?? user.schoolName ?? user.school), className: text(user.tenLop ?? user.className), major: text(user.nganhHoc ?? user.major), role, isActive: true,
  }
}

export async function registerStudent(input: RegisterInput) {
  await apiRequest(authEndpoints.register, { method: 'POST', body: {
    email: input.email.trim().toLowerCase(), hoTen: input.fullName.trim(), matKhau: input.password,
    maSoSinhVien: input.studentCode.trim(), tenTruong: input.schoolName.trim(), tenLop: input.className.trim(), nganhHoc: input.major.trim(),
  } })
}
export async function getCurrentUser(token: string, signal?: AbortSignal) {
  return parseAuthUser(await apiRequest(authEndpoints.profile, { token, signal }), token)
}
export async function loginAccount(taiKhoan: string, password: string): Promise<AuthSession> {
  const account = taiKhoan.trim()
  const body = unwrap(await apiRequest(authEndpoints.login, { method: 'POST', body: { taiKhoan: account.includes('@') ? account.toLowerCase() : account, matKhau: password } }))
  const token = text(body.tokenTruyCap ?? body.accessToken ?? body.token)
  const expiresAt = tokenExpiry(token, body.hetHanLuc ?? body.expiresAt)
  if (!token || expiresAt <= Date.now()) throw new ApiError('Máy chủ chưa trả về JWT hợp lệ hoặc token đã hết hạn.')
  const user = await getCurrentUser(token)
  if (expiresAt <= Date.now()) throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401)
  return { token, expiresAt, user }
}

export function profilePayload(profile: Profile) {
  return {
    hoTen: profile.name.trim(), maSoSinhVien: profile.studentId.trim() || null,
    tenTruong: profile.school.trim() || null, tenLop: profile.className.trim() || null, nganhHoc: profile.major.trim() || null,
  }
}
export async function updateCurrentUser(token: string, profile: Profile) {
  await apiRequest(authEndpoints.profile, { method: 'PATCH', token, body: profilePayload(profile) })
  return getCurrentUser(token)
}
export async function changeCurrentPassword(token: string, input: ChangePasswordInput) {
  await apiRequest(authEndpoints.changePassword, { method: 'POST', token, body: { matKhauHienTai: input.currentPassword, matKhauMoi: input.newPassword } })
}
