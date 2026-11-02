import type { AuthCredentials, UserRole } from '../types/auth'

const SESSION_KEY = 'studyplanner.auth.v1'

export function jwtClaims(token: string): Record<string, unknown> {
  try {
    const segment = token.split('.')[1]
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (char) => char.charCodeAt(0))
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
  } catch { return {} }
}

export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null
  const role = value.toLowerCase()
  return role === 'admin' ? 'admin' : ['sinhvien', 'student'].includes(role) ? 'sinhvien' : null
}

export function tokenExpiry(token: string, expiresAt?: unknown) {
  const exp = jwtClaims(token).exp
  const jwtExpiry = typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : NaN
  const serverExpiry = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN
  const valid = [jwtExpiry, serverExpiry].filter(Number.isFinite)
  return valid.length ? Math.min(...valid) : 0
}

export function readAuthCredentials(): AuthCredentials | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return null
    const { token, expiresAt } = saved as Partial<AuthCredentials>
    if (typeof token !== 'string' || typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) { clearAuthCredentials(); return null }
    const expiry = tokenExpiry(token)
    if (!expiry || Math.min(expiresAt, expiry) <= Date.now()) { clearAuthCredentials(); return null }
    return { token, expiresAt: Math.min(expiresAt, expiry) }
  } catch { return null }
}

export function saveAuthCredentials(credentials: AuthCredentials) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: credentials.token, expiresAt: credentials.expiresAt })) } catch { /* Keep the session in memory if storage is unavailable. */ }
}
export function clearAuthCredentials() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* Storage can be unavailable in private browsing. */ }
}

export function roleHome(role: UserRole) { return role === 'admin' ? '/admin/students' : '/today' }
