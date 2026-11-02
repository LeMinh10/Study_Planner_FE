import type { RegisterInput } from '../types/auth'

export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 128

export function registrationError(input: RegisterInput, confirmPassword: string) {
  if (!input.fullName.trim()) return 'Vui lòng nhập họ và tên.'
  if (!input.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'Email chưa đúng định dạng.'
  if (!input.studentCode.trim()) return 'Vui lòng nhập MSSV.'
  if (!input.schoolName.trim()) return 'Vui lòng nhập tên trường.'
  if (!input.className.trim()) return 'Vui lòng nhập tên lớp.'
  if (!input.major.trim()) return 'Vui lòng nhập ngành học.'
  return newPasswordError(input.password, confirmPassword)
}
export function newPasswordError(password: string, confirmPassword: string) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return `Mật khẩu cần từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự.`
  if (password !== confirmPassword) return 'Mật khẩu xác nhận không khớp.'
  return ''
}

