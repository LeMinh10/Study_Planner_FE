import type { Profile } from './planner'

export type UserRole = 'sinhvien' | 'admin'
export interface AuthUser extends Profile { role: UserRole; isActive: boolean }
export interface AuthCredentials { token: string; expiresAt: number }
export interface AuthSession extends AuthCredentials { user: AuthUser }
export interface RegisterInput {
  fullName: string
  email: string
  password: string
  studentCode: string
  schoolName: string
  className: string
  major: string
}
export interface ChangePasswordInput { currentPassword: string; newPassword: string }
