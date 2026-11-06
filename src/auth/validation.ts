import type { RegisterInput } from '../types/auth'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const PROFILE_MAX_LENGTH = 200
export const STUDENT_CODE_MAX_LENGTH = 50
export const EMAIL_MAX_LENGTH = 320

export function registrationError(input: RegisterInput, confirmPassword: string) {
  if (!input.fullName.trim()) return 'Vui lòng nhập họ và tên.'
  if (!input.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'Email chưa đúng định dạng.'
  if (!input.studentCode.trim()) return 'Vui lòng nhập MSSV.'
  if (!input.schoolName.trim()) return 'Vui lòng nhập tên trường.'
  if (!input.className.trim()) return 'Vui lòng nhập tên lớp.'
  if (!input.major.trim()) return 'Vui lòng nhập ngành học.'
  if (input.email.length > EMAIL_MAX_LENGTH) return `Email không được dài quá ${EMAIL_MAX_LENGTH} ký tự.`
  if (input.studentCode.length > STUDENT_CODE_MAX_LENGTH) return `MSSV không được dài quá ${STUDENT_CODE_MAX_LENGTH} ký tự.`
  if ([input.fullName, input.schoolName, input.className, input.major].some((value) => value.length > PROFILE_MAX_LENGTH)) return `Thông tin sinh viên không được dài quá ${PROFILE_MAX_LENGTH} ký tự mỗi trường.`
  return newPasswordError(input.password, confirmPassword)
}
export function newPasswordError(password: string, confirmPassword: string) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return `Mật khẩu cần từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự.`
  if (password !== confirmPassword) return 'Mật khẩu xác nhận không khớp.'
  return ''
}

