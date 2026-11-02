import { createContext, useContext } from 'react'
import type { AuthUser, ChangePasswordInput, RegisterInput, UserRole } from '../types/auth'
import type { Profile } from '../types/planner'

export interface AuthContextValue {
  user: AuthUser | null
  isDemo: boolean
  status: 'anonymous' | 'loading' | 'authenticated' | 'error'
  notice: string
  error: string
  login: (taiKhoan: string, password: string, role: UserRole) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  changePassword: (input: ChangePasswordInput) => Promise<void>
  logout: () => void
  retry: () => void
  getAccessToken: () => string
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is required')
  return context
}
