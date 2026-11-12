import type { AuthUser, UserRole } from '../types/auth'
import { ApiError } from '../api/client'

export const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true'
export const DEMO_ACCOUNT = { email: 'demo@studyplanner.vn', password: '123456' }
export const ADMIN_DEMO_ACCOUNT = { email: 'admin@studyplanner.vn', password: '123456' }
const DEMO_SESSION_KEY = 'studyplanner.demo.v1'

function demoUser(role: UserRole): AuthUser {
  const admin = role === 'admin'
  return { name: admin ? 'Quản trị viên' : 'Sinh viên mẫu', email: admin ? ADMIN_DEMO_ACCOUNT.email : DEMO_ACCOUNT.email, studentId: '', school: '', className: '', major: '', role, isActive: true }
}

export function tryDemoLogin(email: string, password: string): AuthUser | null {
  if (!demoEnabled) return null
  const normalizedEmail = email.trim().toLowerCase()
  const accountRole = normalizedEmail === DEMO_ACCOUNT.email ? 'sinhvien' : normalizedEmail === ADMIN_DEMO_ACCOUNT.email ? 'admin' : null
  if (!accountRole) return null
  const account = accountRole === 'admin' ? ADMIN_DEMO_ACCOUNT : DEMO_ACCOUNT
  if (password !== account.password) throw new ApiError('Email hoặc mật khẩu không đúng.')
  return demoUser(accountRole)
}

export function readDemoSession(): AuthUser | null {
  if (!demoEnabled) return null
  try {
    const saved = sessionStorage.getItem(DEMO_SESSION_KEY)
    return saved === 'active' ? demoUser('sinhvien') : saved === 'admin' ? demoUser('admin') : null
  }
  catch { return null }
}
export function saveDemoSession(role: UserRole = 'sinhvien') {
  try { sessionStorage.setItem(DEMO_SESSION_KEY, role === 'admin' ? 'admin' : 'active') } catch { /* Keep the session in memory when storage is unavailable. */ }
}
export function clearDemoSession() {
  try { sessionStorage.removeItem(DEMO_SESSION_KEY) } catch { /* Storage may be unavailable. */ }
}
